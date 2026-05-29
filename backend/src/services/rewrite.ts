import { chat } from "./llm.js";
import {
  styleProfilePrompt,
  rewriteDocPrompt,
  alternativesPrompt,
} from "../prompts.js";

/** 容错解析模型返回的 JSON（去掉可能的 ```json 包裹） */
function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 截取首个 [ 或 { 到末尾对应括号
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  return JSON.parse(s) as T;
}

/** 从范文提取风格要点 */
export async function extractStyleProfile(samples: string): Promise<string> {
  if (!samples.trim()) return "";
  return (await chat(styleProfilePrompt(samples), { temperature: 0.3 })).trim();
}

export interface RewriteResult {
  index: number;
  text: string;
}

/** 整篇按段改写。分块发送以控制单次长度。 */
export async function rewriteDocument(
  styleSummary: string,
  paragraphs: { index: number; kind: string; text: string }[],
  chunkSize = 12
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const todo = paragraphs.filter((p) => p.text.trim().length > 0);

  // 分块
  const chunks: typeof todo[] = [];
  for (let i = 0; i < todo.length; i += chunkSize) chunks.push(todo.slice(i, i + chunkSize));

  // 各块并行调用，缩短整篇等待时间
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const raw = await chat(rewriteDocPrompt(styleSummary, chunk), { temperature: 0.7 });
        const items = parseJson<{ index: number | string; text: unknown }[]>(raw);
        for (const it of items) {
          const idx = Number(it.index); // 模型可能把序号返回成字符串
          if (Number.isInteger(idx) && typeof it.text === "string") {
            result.set(idx, it.text);
          }
        }
      } catch {
        // 解析失败：保留原文，避免整篇崩
        for (const p of chunk) result.set(p.index, p.text);
      }
    })
  );
  return result;
}

/** 单句生成多个候选 */
export async function generateAlternatives(
  styleSummary: string,
  context: string,
  sentence: string,
  n = 3
): Promise<string[]> {
  const raw = await chat(alternativesPrompt(styleSummary, context, sentence, n), {
    temperature: 0.9,
  });
  try {
    const arr = parseJson<string[]>(raw);
    return arr.filter((x) => typeof x === "string" && x.trim()).slice(0, n);
  } catch {
    return [];
  }
}
