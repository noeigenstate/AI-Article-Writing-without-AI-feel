import "dotenv/config";

export const config = {
  llm: {
    baseURL: process.env.LLM_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "mimo-v2.5-pro",
    temperature: Number(process.env.LLM_TEMPERATURE ?? "0.7"),
  },
  port: Number(process.env.PORT ?? "8787"),
};
