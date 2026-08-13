/**
 * Prompt builders for the article-generation flow: topic planning and full drafts.
 * Both are bilingual (en/zh) and embed the shared anti-AI ruleset.
 */

import type {
  GeneratedArticle,
  GenerateArticleInput,
  ResearchCoverageSummary,
  TopicOption,
} from "../services/article.js";
import type { Lang } from "../core/i18n.js";
import { getArticleLengthSpec, type ArticleLengthTier } from "../services/articleLength.js";
import { ANTI_AI_RULES_ZH, ANTI_AI_RULES_EN } from "./rules.js";

/**
 * Build the prompt that proposes article topics for a domain.
 *
 * @param domainName Human-readable domain name.
 * @param domainDesc Short description of the domain.
 * @param n Number of topics to request.
 * @param researchContext Optional live-source context to ground the topics.
 * @param lang Output language.
 * @returns A prompt requesting a JSON array of topic objects.
 */
export function articleTopicsPrompt(
  domainName: string,
  domainDesc: string,
  n: number,
  researchContext = "",
  lang: Lang = "en",
  researchCoverage?: ResearchCoverageSummary
): string {
  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

你是一个公众号选题策划。请围绕下面领域生成 ${n} 个适合公众号文章的一手选题。

领域：${domainName}
领域说明：${domainDesc}

最新参考资料：
${researchContext || "（暂无实时资料，按领域常识生成，但不要编造具体事实。）"}

选题要求：
1. 选题要具体，不要泛泛写"趋势""启示""思考"。
2. 每个选题要有清晰切口，读者一看就知道文章会讲什么。
3. 避开营销号标题党，不能承诺无法验证的结果。
4. 优先给出能写成长文、能展开案例和观点的题目。
5. ${topicRegionRule("zh", researchCoverage)}

严格只输出 JSON 数组，每项形如：
{"title":"选题标题","angle":"文章切入角度","audience":"适合读者","keywords":["关键词1","关键词2"]}
不要任何额外文字、不要 markdown 代码块。`;
  }

  return `${ANTI_AI_RULES_EN}

You are an editorial topic planner. Propose ${n} first-hand article topics for the domain below.

Domain: ${domainName}
Domain notes: ${domainDesc}

Latest reference material:
${researchContext || "(no live material; use domain common sense, but do not invent specific facts.)"}

Requirements:
1. Topics must be specific — no vague "trends", "lessons", or "reflections".
2. Each topic needs a clear angle so a reader immediately knows what the piece will cover.
3. Avoid clickbait; do not promise results that cannot be verified.
4. Prefer topics that can sustain a long piece with cases and a point of view.
5. ${topicRegionRule("en", researchCoverage)}

Output strictly a JSON array, each item like:
{"title":"Topic title","angle":"Entry angle","audience":"Intended reader","keywords":["keyword1","keyword2"]}
No extra text, no markdown code block.`;
}

/**
 * Build the prompt that writes a full, publishable article from a topic.
 *
 * Length guidance and citation rules vary by language; figures/tables/references
 * are added later by the article service, so the model writes body text only.
 *
 * @param input Domain, topic, style, target length, research context, and language.
 * @returns A prompt requesting a JSON object `{title, paragraphs}`.
 */
export function articleDraftPrompt(input: GenerateArticleInput): string {
  const lang: Lang = input.lang ?? "en";
  const topic = typeof input.topic === "string" ? { title: input.topic } : (input.topic as TopicOption);
  const targetLength = input.targetLength ?? "medium";
  const lengthHint = articleLengthHint(lang, targetLength);
  const lengthRule = articleLengthRule(lang, targetLength);

  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

你要直接写一篇可发布的中文文章。不要写提纲，不要解释写作思路。

领域：${input.domainName}
选题：${topic.title}
切入角度：${"angle" in topic ? topic.angle : "围绕选题展开"}
目标读者：${"audience" in topic ? topic.audience : "公众号读者"}
目标长度：${lengthHint}

要模仿的风格：
${input.styleSummary || "（无特定范文，按去 AI 味原则写，短句优先，信息密度高。）"}

最新参考资料：
${input.researchContext || "（暂无实时资料。不要编造新闻、论文或数据。）"}

写作要求：
1. 开头直接进入问题或场景，不要说"在当今时代""随着发展"。
2. 只使用上方参考资料能支撑的事实、数据、机构名、论文结论、网页文章和新闻事件。资料里没有的内容，不要写。
3. 每个事实或判断段必须有论文、网页文章或新闻来源支撑，并在相关句末使用引用编号，如 [1]、[2]。引用编号只能来自"来源资料 N"。
4. "公开评论/讨论"只能用来呈现个人体验、舆论分歧或反方视角。必须写清是谁、在哪个平台表达，不能把个别评论写成普遍事实、统计结论或权威证据。
5. 摘录默认转述。只有原话本身有分析价值时才直接引用；中文原话每处不超过 60 个字，英文不超过 25 个词，不拼接多段原文，并在引号后立刻标注引用编号。
6. ${articleRegionRule("zh", input.researchCoverage)}
7. 段落按逻辑推进：事实背景、关键证据、机制解释、反方或限制、可落地判断。每段只推进一个意思。
8. ${lengthRule}不同长度档位要有明显差别，不能只多写一两段。
9. 禁止 AI 口头禅和废话：不要写"值得注意的是""不可忽视""赋能""新范式""深度融合""未来可期""综上所述"。
10. 不要擅自发散，不要写无法验证的预测，不要把推测写成事实。
11. 语言凝练通俗，论点先行，论据跟上。短句优先，不堆形容词。多用具体例子、画面感和形象比喻，把专业概念讲得外行也能一眼看懂；开头一段留个钩子抓住读者，但不夸大、不做无法验证的承诺。
12. 不输出 Markdown，不用列表符号。配图和参考文献由系统根据来源自动生成，你只负责写正文。

严格只输出 JSON 对象，格式如下：
{"title":"文章标题","paragraphs":["第一段正文","第二段正文"]}
不要任何额外文字、不要 markdown 代码块。`;
  }

  return `${ANTI_AI_RULES_EN}

Write a publishable English article directly. Do not write an outline and do not explain your process.

Domain: ${input.domainName}
Topic: ${topic.title}
Angle: ${"angle" in topic ? topic.angle : "develop around the topic"}
Audience: ${"audience" in topic ? topic.audience : "general readers"}
Target length: ${lengthHint}

Style to imitate:
${input.styleSummary || "(no specific sample; write with the de-AI principles, short sentences first, high information density.)"}

Latest reference material:
${input.researchContext || "(no live material. Do not invent news, papers, or data.)"}

Requirements:
1. Open straight into the problem or scene; do not say "In today's era" or "With the development of".
2. Use only facts, numbers, institution names, paper findings, web articles, and news events that the material above can support. If it is not in the material, do not write it.
3. Every factual or judgment paragraph must be backed by a paper, web article, or news source, with a citation number on the relevant sentence, e.g. [1], [2]. Citation numbers may only come from "source material N".
4. Treat "public comment/discussion" only as personal experience, disagreement, or a counterpoint. Attribute the speaker and platform; never turn one comment into a general fact, statistic, or authoritative evidence.
5. Paraphrase excerpts by default. Quote directly only when the wording itself matters: no more than 25 English words or 60 Chinese characters per quote, never stitch passages together, and place the citation immediately after the quote.
6. ${articleRegionRule("en", input.researchCoverage)}
7. Let paragraphs progress logically: factual background, key evidence, mechanism, counterpoint or limits, actionable judgment. Each paragraph advances one idea.
8. ${lengthRule} The three modes must feel substantially different, not just one or two extra paragraphs.
9. No AI filler: avoid "It is worth noting", "cannot be ignored", "empower", "new paradigm", "deep integration", "a promising future", "in conclusion".
10. Do not wander, do not write unverifiable predictions, do not present speculation as fact.
11. Tight, plain prose, claim first then evidence. Short sentences first, no piled-up adjectives. Use concrete examples, vivid imagery, and everyday analogies so a non-expert grasps each idea at a glance; open with a hook that pulls the reader in, without hype or unverifiable promises.
12. Output no Markdown and no list bullets. Figures and references are generated by the system from sources — you only write the body.

Output strictly a JSON object in this format:
{"title":"Article title","paragraphs":["First paragraph","Second paragraph"]}
No extra text, no markdown code block.`;
}

/**
 * Build the corrective prompt that expands or condenses a draft to its length band.
 *
 * Used when the first draft misses the target-length band: the model gets its
 * own draft back plus the research context and must return the same JSON shape.
 *
 * @param article The off-target draft.
 * @param input The original generation input (for research context and language).
 * @param currentLength Measured body length (chars for zh, words for en).
 * @returns A prompt requesting a JSON object `{title, paragraphs}`.
 */
export function articleLengthFixPrompt(
  article: GeneratedArticle,
  input: GenerateArticleInput,
  currentLength: number
): string {
  const lang: Lang = input.lang ?? "en";
  const tier = input.targetLength ?? "medium";
  const spec = getArticleLengthSpec(lang, tier);
  const expand = currentLength < spec.min;
  const draftJson = JSON.stringify({ title: article.title, paragraphs: article.paragraphs });

  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

下面这篇文章草稿的正文目前约 ${currentLength} 字，但目标长度是 ${spec.min}-${spec.max} 字。请把它${
      expand ? "扩写" : "压缩"
    }到目标区间，直接输出改后的完整文章。

原稿（JSON）：
${draftJson}

参考资料：
${input.researchContext || "（暂无实时资料。不要编造新闻、论文或数据。）"}

要求：
1. ${
      expand
        ? `扩写只能基于参考资料展开：${expansionRegionPriority("zh", input.researchCoverage)}再补案例细节、数据对比、机制解释、反方观点和限制条件；不要重复原有内容，资料里没有的事实一律不写。`
        : "压缩时删掉重复表述和空话，优先合并同义段落；所有关键事实、数据和判断必须保留。"
    }
2. 保留原有的引用编号（如 [1]、[2]），不要新增指向不存在来源的编号。
3. 公开评论仍只能作为个人观点或争议视角，不能扩写成事实；直接摘录仍须保持简短并明确归属。
4. ${articleRegionRule("zh", input.researchCoverage)}
5. 保持原稿的语气和行文规则：短句优先，不用 AI 口头禅，不输出 Markdown，不用列表符号。
6. 改完后的正文总字数必须落在 ${spec.min}-${spec.max} 字之间。只统计 paragraphs 正文，不含标题和 [n] 引用编号；去除空白后按 Unicode 字符计数。

严格只输出 JSON 对象：
{"title":"文章标题","paragraphs":["第一段正文","第二段正文"]}
不要任何额外文字、不要 markdown 代码块。`;
  }

  return `${ANTI_AI_RULES_EN}

The article body below is about ${currentLength} words, but the target length is ${spec.min}-${spec.max} words. ${
    expand ? "Expand" : "Condense"
  } it into the target band and output the full revised article directly.

Draft (JSON):
${draftJson}

Reference material:
${input.researchContext || "(no live material. Do not invent news, papers, or data.)"}

Requirements:
1. ${
    expand
      ? `Expand only from the reference material: ${expansionRegionPriority("en", input.researchCoverage)}then add case detail, data comparisons, mechanism, counterpoints, and limits. Do not repeat existing material or write unsupported facts.`
      : "Cut repetition and filler, merge redundant paragraphs; keep every key fact, number, and judgment."
  }
2. Keep existing citation markers (e.g. [1], [2]); do not add markers that point to no source.
3. Public comments remain personal viewpoints or counterpoints, never facts; any direct excerpt must stay short and attributed.
4. ${articleRegionRule("en", input.researchCoverage)}
5. Keep the draft's voice and rules: short sentences first, no AI filler, no Markdown, no list bullets.
6. The revised body must land between ${spec.min} and ${spec.max} words. Count only the paragraphs, excluding the title and [n] citation markers; words are whitespace-delimited tokens.

Output strictly a JSON object:
{"title":"Article title","paragraphs":["First paragraph","Second paragraph"]}
No extra text, no markdown code block.`;
}

/** Repair missing/out-of-range inline citations without inventing attribution. */
export function articleCitationFixPrompt(
  article: GeneratedArticle,
  input: GenerateArticleInput,
  referenceCount: number
): string {
  const lang: Lang = input.lang ?? "en";
  const tier = input.targetLength ?? "medium";
  const spec = getArticleLengthSpec(lang, tier);
  const draftJson = JSON.stringify({ title: article.title, paragraphs: article.paragraphs });

  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

下面的文章有段落缺少有效来源编号，或使用了不存在的编号。请只修复引用与必要的事实表述。

原稿（JSON）：
${draftJson}

参考资料：
${input.researchContext || "（无资料）"}

要求：
1. 每个正文段落至少包含一个由该段内容真正支持的引用编号 [n]；n 只能是 1-${referenceCount}。
2. 不要为了补编号而随意挂来源。若资料不能支持某句话，改成资料能支持的准确表述或删除它。
3. 公开评论只能支撑个人体验、争议或反方观点，不能支撑事实或统计。
4. 除引用和必要的事实校正外，不改变标题、结构、语气和篇幅。
5. 正文仍须保持在 ${spec.min}-${spec.max} 字之间；[n] 不计入字数。

严格只输出 JSON 对象：
{"title":"文章标题","paragraphs":["第一段正文 [1]","第二段正文 [2]"]}`;
  }

  return `${ANTI_AI_RULES_EN}

The article below has paragraphs with missing or out-of-range source markers. Repair only the citations and any factual wording needed to make those citations honest.

Draft (JSON):
${draftJson}

Reference material:
${input.researchContext || "(none)"}

Requirements:
1. Every body paragraph must contain at least one citation [n] that genuinely supports that paragraph; n may only be 1-${referenceCount}.
2. Never attach a source merely to fill a marker. If the evidence cannot support a sentence, rewrite it accurately from the material or remove it.
3. Public comments may support personal experience, disagreement, or counterpoints only—not facts or statistics.
4. Apart from citation and necessary factual correction, preserve the title, structure, voice, and length.
5. Keep the body within ${spec.min}-${spec.max} words; [n] markers do not count toward length.

Output strictly one JSON object:
{"title":"Article title","paragraphs":["First paragraph [1]","Second paragraph [2]"]}`;
}

/** Build tier-specific prompt guidance from the shared runtime specification. */
function articleLengthHint(lang: Lang, tier: ArticleLengthTier): string {
  const spec = getArticleLengthSpec(lang, tier);
  if (lang === "zh") {
    const shape =
      tier === "short"
        ? "4-6 个短段落，适合快速发布"
        : tier === "long"
          ? "至少 14 个段落，充分展开案例、证据、机制、反方观点和收束判断"
          : "8-10 个段落，适合标准公众号文章";
    return `${spec.min}-${spec.max} 字正文（不含标题和 [n] 引用编号；去除空白后按 Unicode 字符计数），${shape}。`;
  }

  const shape =
    tier === "short"
      ? "4-6 short paragraphs for a quick post"
      : tier === "long"
        ? "at least 14 paragraphs with fuller cases, evidence, counterpoints, and a closing judgment"
        : "8-10 paragraphs for a standard article";
  return `${spec.min}-${spec.max} body words (title and [n] citation markers excluded; words are whitespace-delimited tokens), ${shape}.`;
}

/** Build the strict length rule without duplicating numeric ranges. */
function articleLengthRule(lang: Lang, tier: ArticleLengthTier): string {
  const spec = getArticleLengthSpec(lang, tier);
  return lang === "zh"
    ? `正文必须落在 ${spec.min}-${spec.max} 字；只统计 paragraphs，不含标题和 [n] 引用编号，去除空白后按 Unicode 字符计数。`
    : `The body must contain ${spec.min}-${spec.max} words; count paragraphs only, exclude the title and [n] citation markers, and treat whitespace-delimited tokens as words.`;
}

function hasRegion(coverage: ResearchCoverageSummary | undefined, region: "domestic" | "international"): boolean {
  return !coverage || coverage[region] > 0;
}

/** Make the cross-region instruction match the evidence actually retrieved. */
function articleRegionRule(lang: Lang, coverage?: ResearchCoverageSummary): string {
  const domestic = hasRegion(coverage, "domestic");
  const international = hasRegion(coverage, "international");
  if (domestic && international) {
    return lang === "zh"
      ? "同时使用国内外材料：比较共同事实、叙事差异、制度或市场语境与争议。不要把来源数量当成共识证据，也不要为求对称而制造虚假平衡；结论以可核验事实为准。"
      : "Use both domestic and international material. Compare shared facts, narrative differences, institutional or market context, and disputes. Source count is not evidence of consensus; do not create false balance for symmetry. Base conclusions on verifiable facts.";
  }
  if (domestic) {
    return lang === "zh"
      ? "当前资料只有可确认的国内来源；明确这一证据边界，不要虚构国际观点、案例或所谓海外共识。结论只基于可核验资料。"
      : "The retrieved evidence has confirmed domestic sources only. State that boundary; do not invent international views, cases, or overseas consensus. Base conclusions only on verifiable material.";
  }
  if (international) {
    return lang === "zh"
      ? "当前资料只有可确认的国际来源；明确这一证据边界，不要虚构国内观点、案例或所谓本土共识。结论只基于可核验资料。"
      : "The retrieved evidence has confirmed international sources only. State that boundary; do not invent domestic views, cases, or local consensus. Base conclusions only on verifiable material.";
  }
  return lang === "zh"
    ? "当前没有可确认地区的资料；不要编造国内外对照、新闻、案例或数据，只能明确资料缺口。"
    : "No regionally verified evidence was retrieved. Do not invent cross-region comparisons, news, cases, or data; state the evidence gap plainly.";
}

function topicRegionRule(lang: Lang, coverage?: ResearchCoverageSummary): string {
  const domestic = hasRegion(coverage, "domestic");
  const international = hasRegion(coverage, "international");
  if (domestic && international) {
    return lang === "zh"
      ? "选题角度优先利用国内外视角的共同点、叙事差异和制度或市场语境，不要只追热点。"
      : "Prefer angles that use shared facts, narrative differences, and institutional or market context across domestic and international perspectives instead of merely chasing trends.";
  }
  return lang === "zh"
    ? "只从已检索到的地区视角提炼选题，并明确缺失的另一侧证据；不要为了国际化而补造材料。"
    : "Build angles only from the regional perspectives actually retrieved, and make the missing side explicit; never fabricate material merely to appear international.";
}

function expansionRegionPriority(lang: Lang, coverage?: ResearchCoverageSummary): string {
  const domestic = hasRegion(coverage, "domestic");
  const international = hasRegion(coverage, "international");
  if (domestic && international) {
    return lang === "zh"
      ? "优先补充国内外材料的跨区域对照，"
      : "prioritize cross-regional comparisons between domestic and international material, ";
  }
  return lang === "zh"
    ? "只补充已检索资料能支撑的地区视角，明确另一侧资料缺失，"
    : "expand only the regional perspective supported by retrieved evidence and state that the other side is missing, ";
}
