/**
 * M2 验收：模型连通性 + 单句改写候选。需要有效的 LLM_API_KEY。
 * 用法：npm run test:llm
 */
import { health } from "../services/llm.js";
import { generateAlternatives } from "../services/rewrite.js";

const h = await health();
console.log("健康检查:", h);
if (!h.ok) {
  console.error("\n模型不通，请检查 .env 里的 LLM_API_KEY / LLM_MODEL / LLM_BASE_URL。");
  process.exit(1);
}

const sentence = "随着人工智能技术的不断发展，AI 在金融领域的应用也日益广泛。";
const context = sentence;
console.log("\n原句:", sentence);
const alts = await generateAlternatives("", context, sentence, 3);
console.log("候选:");
alts.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
