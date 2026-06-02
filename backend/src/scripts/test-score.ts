/**
 * 实际效果测试：AI 味评分 + 改写前后对照。
 * Real-effect test for the AI-smell score and the de-AI rewrite.
 *
 *   npm run test:score          只跑本地评分（无需 API Key，离线即可）
 *   npm run test:score -- --rewrite   额外调用模型改写，打印「前 → 后」分数（需有效 Key）
 */
import { scoreText, type AiScore } from "../services/aiScore.js";
import { rewriteDocument } from "../services/rewrite.js";
import { splitSentences } from "../services/splitter.js";
import type { Lang } from "../core/i18n.js";

/** 故意写得很有 AI 味的样本（套话、黑话、排比、机械连接词、句长均匀） */
const SAMPLES: { lang: Lang; title: string; text: string }[] = [
  {
    lang: "zh",
    title: "中文·满满 AI 味",
    text: `在当今社会，随着人工智能的不断发展，我们的生活正在发生深刻的变化。首先，AI 赋能了千行百业，实现了降本增效。其次，它推动了产业的深度融合，构建了新的生态闭环。然而，我们也必须清醒地认识到，技术是一把双刃剑。值得注意的是，机遇与挑战并存。不仅企业需要拥抱变化，而且个人也需要持续学习。综上所述，未来可期，让我们携手共创美好明天。`,
  },
  {
    lang: "zh",
    title: "中文·人话版（对照）",
    text: `上周我帮一家做客服外包的小公司接了套 AI 工单系统。老板最在意的不是炫技，是每月省下两个人力。系统上线第一周漏判了三成的退款请求，被客户投诉到群里。我们把退款关键词单独拎出来做了规则兜底，第二周漏判降到百分之四。AI 能省人，但前提是有人盯着它犯的错。`,
  },
  {
    lang: "en",
    title: "EN · heavy AI smell",
    text: `In today's rapidly evolving world, artificial intelligence is undoubtedly a game-changer. Moreover, it empowers businesses to leverage cutting-edge solutions. Furthermore, it plays a crucial role in navigating the ever-evolving landscape. However, it is worth noting that challenges remain. Not only do companies need to adapt, but also individuals must embrace change. In conclusion, the future is bright, and we must seize the opportunity together.`,
  },
];

function bar(score: number): string {
  const filled = Math.round(score / 5);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

function printScore(label: string, s: AiScore) {
  console.log(`  ${label}: ${bar(s.score)} ${s.score}/100  [${s.level}]`);
  for (const sig of s.signals) console.log(`      · ${sig.label} ×${sig.hits}  (+${sig.points})`);
}

const doRewrite = process.argv.includes("--rewrite");

for (const sample of SAMPLES) {
  console.log(`\n=== ${sample.title} ===`);
  printScore("原文 before", scoreText(sample.text, sample.lang));
}

if (doRewrite) {
  console.log(`\n\n########## 改写效果对照（调用模型） ##########`);
  for (const sample of SAMPLES.filter((s) => !s.title.includes("对照"))) {
    console.log(`\n=== ${sample.title} ===`);
    const before = scoreText(sample.text, sample.lang);
    printScore("before", before);
    try {
      const paras = splitSentences(sample.text).map((text, index) => ({ index, kind: "paragraph", text }));
      const map = await rewriteDocument("", paras, 6, sample.lang);
      const rewritten = paras.map((p) => map.get(p.index) ?? p.text).join("");
      const after = scoreText(rewritten, sample.lang);
      printScore("after ", after);
      const drop = before.score - after.score;
      console.log(`  Δ 降低 ${drop} 分（${before.score} → ${after.score}）`);
      console.log(`  ── 改写后正文 ──\n  ${rewritten.replace(/\n/g, "\n  ")}`);
    } catch (e) {
      console.error(`  ✗ 改写失败（检查 API Key / base_url）：${(e as Error).message}`);
    }
  }
} else {
  console.log(`\n（加 --rewrite 可额外测试模型改写后的分数对照，需有效 API Key）`);
}
