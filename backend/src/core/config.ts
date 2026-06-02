import "dotenv/config";

const baseURL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com";

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
};
