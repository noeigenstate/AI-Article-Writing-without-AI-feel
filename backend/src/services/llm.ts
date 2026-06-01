import OpenAI from "openai";
import { config } from "../config.js";

const client = new OpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey,
});

export interface ChatOptions {
  system?: string;
  temperature?: number;
}

/** 一次性获取完整回复 */
export async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const res = await client.chat.completions.create({
    model: config.llm.model,
    temperature: opts.temperature ?? config.llm.temperature,
    messages,
    stream: false,
    ...deepSeekOptions(),
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & Record<string, unknown>);
  return res.choices[0]?.message?.content ?? "";
}

/** 流式获取回复，逐块回调 */
export async function chatStream(
  prompt: string,
  onDelta: (chunk: string) => void,
  opts: ChatOptions = {}
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const stream = await client.chat.completions.create({
    model: config.llm.model,
    temperature: opts.temperature ?? config.llm.temperature,
    messages,
    stream: true,
    ...deepSeekOptions(),
  } as OpenAI.Chat.ChatCompletionCreateParamsStreaming & Record<string, unknown>);

  let full = "";
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  return full;
}

/** 健康检查：能否连通模型 */
export async function health(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const reply = await chat("回复「ok」两个字即可。", { temperature: 0 });
    return { ok: true, model: config.llm.model, error: reply ? undefined : "空回复" };
  } catch (e) {
    return { ok: false, model: config.llm.model, error: (e as Error).message };
  }
}

function deepSeekOptions(): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (config.llm.thinkingType) extra.thinking = { type: config.llm.thinkingType };
  if (config.llm.reasoningEffort) extra.reasoning_effort = config.llm.reasoningEffort;
  return extra;
}
