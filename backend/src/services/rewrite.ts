import { chat } from "./llm.js";
import {
  styleProfilePrompt,
  rewriteDocPrompt,
  alternativesPrompt,
  rewriteTitlePrompt,
} from "../prompts.js";
import type { Lang } from "../i18n.js";

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
export async function extractStyleProfile(samples: string, lang: Lang = "en"): Promise<string> {
  if (!samples.trim()) return "";
  return (await chat(styleProfilePrompt(samples, lang), { temperature: 0.3 })).trim();
}

export interface RewriteResult {
  index: number;
  text: string;
}

/** 整篇拼成纯文本（用于标题概括全文） */
export function fullText(paragraphs: { text: string }[]): string {
  return paragraphs.map((p) => p.text).filter((t) => t.trim()).join("\n");
}

/** 文档标题 = 第一个非空段落的序号；无则 -1 */
export function titleIndexOf(paragraphs: { index: number; text: string }[]): number {
  const first = paragraphs.find((p) => p.text.trim().length > 0);
  return first ? first.index : -1;
}

/** 基于全文生成多个标题候选 */
export async function generateTitles(
  styleSummary: string,
  text: string,
  n = 3,
  lang: Lang = "en"
): Promise<string[]> {
  const raw = await chat(rewriteTitlePrompt(styleSummary, text, n, lang), { temperature: 0.85 });
  try {
    const arr = parseJson<string[]>(raw);
    return arr.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, n);
  } catch {
    return [];
  }
}

/** 整篇按段改写。分块发送以控制单次长度；标题单独按"概括全文+抓注意力"改写。 */
export async function rewriteDocument(
  styleSummary: string,
  paragraphs: { index: number; kind: string; text: string }[],
  chunkSize = 12,
  lang: Lang = "en"
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const nonEmpty = paragraphs.filter((p) => p.text.trim().length > 0);
  const titleIndex = titleIndexOf(paragraphs);

  // 标题：独立逻辑，读全文概括起标题（取第一个候选）
  if (titleIndex >= 0) {
    const titles = await generateTitles(styleSummary, fullText(paragraphs), 1, lang);
    const original = nonEmpty.find((p) => p.index === titleIndex)!.text;
    result.set(titleIndex, titles[0] ?? original);
  }

  // 正文：排除标题后分块
  const todo = nonEmpty.filter((p) => p.index !== titleIndex);
  const chunks: typeof todo[] = [];
  for (let i = 0; i < todo.length; i += chunkSize) chunks.push(todo.slice(i, i + chunkSize));

  // 各块并行调用，缩短整篇等待时间
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const raw = await chat(rewriteDocPrompt(styleSummary, chunk, lang), { temperature: 0.7 });
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
  n = 3,
  lang: Lang = "en"
): Promise<string[]> {
  const raw = await chat(alternativesPrompt(styleSummary, context, sentence, n, lang), {
    temperature: 0.9,
  });
  try {
    const arr = parseJson<string[]>(raw);
    return arr.filter((x) => typeof x === "string" && x.trim()).slice(0, n);
  } catch {
    return [];
  }
}
