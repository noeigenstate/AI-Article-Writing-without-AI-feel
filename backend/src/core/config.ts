import "dotenv/config";

const baseURL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com";

/** Safe local-development network defaults. */
export const DEFAULT_BIND_HOST = "127.0.0.1";
export const DEFAULT_CORS_ORIGINS = ["http://localhost:51773", "http://127.0.0.1:51773"] as const;

export function configuredCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_CORS_ORIGINS];

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || value === "*") return false;
      try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
      } catch {
        return false;
      }
    });
  return origins.length ? [...new Set(origins)] : [...DEFAULT_CORS_ORIGINS];
}

/**
 * Runtime configuration, resolved once from environment variables.
 *
 * `LLM_API_KEY` takes precedence over `DEEPSEEK_API_KEY`. The `thinkingType`
 * and `reasoningEffort` fields are cloud-only extras; set them to "off" for
 * local OpenAI-compatible servers (see {@link ../services/llm.ts}).
 */
export const config = {
  llm: {
    baseURL,
    apiKey: process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "deepseek-v4-pro",
    temperature: Number(process.env.LLM_TEMPERATURE ?? "0.7"),
    thinkingType: process.env.LLM_THINKING_TYPE ?? "enabled",
    reasoningEffort: process.env.LLM_REASONING_EFFORT ?? "high",
  },
  port: Number(process.env.PORT ?? "8787"),
  host: process.env.HOST?.trim() || DEFAULT_BIND_HOST,
  corsOrigins: configuredCorsOrigins(process.env.CORS_ORIGINS),
};
