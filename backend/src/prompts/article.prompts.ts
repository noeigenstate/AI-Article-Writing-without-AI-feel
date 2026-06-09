/**
 * Prompt builders for the article-generation flow: topic planning and full drafts.
 * Both are bilingual (en/zh) and embed the shared anti-AI ruleset.
 */

import type { GenerateArticleInput, TopicOption } from "../services/article.js";
import type { Lang } from "../core/i18n.js";
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
  lang: Lang = "en"
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

  if (lang === "zh") {
    const lengthHint =
      input.targetLength === "short"
        ? "约 500 字，控制在 450-650 字，4-6 个短段落，适合快速发布。"
        : input.targetLength === "long"
          ? "3000 字以上，建议 3000-3800 字，至少 14 个段落，需要充分展开案例、证据、机制、反方观点和收束判断。"
          : "常规文章不少于 1000 字，建议 1000-1300 字，8-10 个段落，适合标准公众号文章。";

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
2. 只使用上方参考资料能支撑的事实、数据、机构名、论文结论和新闻事件。资料里没有的内容，不要写。
3. 每个判断段必须有数据、论文或新闻来源支撑，并在句末使用引用编号，如 [1]、[2]。引用编号只能来自"来源资料 N"。
4. 段落按逻辑推进：事实背景、关键证据、机制解释、反方或限制、可落地判断。每段只推进一个意思。
5. 严格执行目标长度：短文约 500 字即可；常规必须足 1000 字；长文必须超过 3000 字。不同长度档位要有明显差别，不能只多写一两段。
6. 禁止 AI 口头禅和废话：不要写"值得注意的是""不可忽视""赋能""新范式""深度融合""未来可期""综上所述"。
7. 不要擅自发散，不要写无法验证的预测，不要把推测写成事实。
8. 语言凝练，论点先行，论据跟上。短句优先，不堆形容词。
9. 不输出 Markdown，不用列表符号。图、表、参考文献由系统根据来源自动生成，你只负责写正文。

严格只输出 JSON 对象，格式如下：
{"title":"文章标题","paragraphs":["第一段正文","第二段正文"]}
不要任何额外文字、不要 markdown 代码块。`;
  }

  const lengthHint =
    input.targetLength === "short"
      ? "about 350-500 words, 4-6 short paragraphs, good for a quick post."
      : input.targetLength === "long"
        ? "at least 2200 words, ideally 2200-2800 words, with at least 14 paragraphs, fuller cases, evidence, counterpoints, and a closing judgment."
        : "at least 850 words, ideally 850-1100 words, 8-10 paragraphs, a standard article length.";

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
2. Use only facts, numbers, institution names, paper findings, and news events that the material above can support. If it is not in the material, do not write it.
3. Every claim paragraph must be backed by a data/paper/news source, with a citation number at the end of the sentence, e.g. [1], [2]. Citation numbers may only come from "source material N".
4. Let paragraphs progress logically: factual background, key evidence, mechanism, counterpoint or limits, actionable judgment. Each paragraph advances one idea.
5. Strictly follow the target length. Short is roughly 350-500 English words; regular must be at least 850 English words; long must exceed 2200 English words. The three modes must feel substantially different, not just one or two extra paragraphs.
6. No AI filler: avoid "It is worth noting", "cannot be ignored", "empower", "new paradigm", "deep integration", "a promising future", "in conclusion".
7. Do not wander, do not write unverifiable predictions, do not present speculation as fact.
8. Tight prose, claim first then evidence. Short sentences first, no piled-up adjectives.
9. Output no Markdown and no list bullets. Figures, tables, and references are generated by the system from sources — you only write the body.

Output strictly a JSON object in this format:
{"title":"Article title","paragraphs":["First paragraph","Second paragraph"]}
No extra text, no markdown code block.`;
}
