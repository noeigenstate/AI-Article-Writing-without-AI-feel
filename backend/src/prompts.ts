/**
 * 提示词模板 —— 去 AI 味改写的核心逻辑都在这里，便于单独调优。
 * Prompt templates — the core "de-AI" logic lives here so it can be tuned in one place.
 * Every builder takes a `lang` ("en" | "zh") so generated content matches the UI language.
 */

import type { GenerateArticleInput, TopicOption } from "./services/article.js";
import type { Lang } from "./i18n.js";

/** 「AI 味」的可操作定义，所有改写共用 / Operational definition of "AI smell", shared by all rewrites */
const ANTI_AI_RULES_ZH = `你在帮中文作者去除文章里的"AI 味"。AI 味的典型表现：
1. 套话式开头/收尾：综上所述、总而言之、值得注意的是、在当今社会、随着……的发展。
2. 空泛的总结句和正确的废话，信息密度低。
3. 排比和对仗堆砌，句式过于整齐对称。
4. 形容词、副词过度修饰；"不仅……而且""既……又"滥用。
5. 机械的过渡词：首先/其次/然而/因此 连用。
6. 把简单意思绕成长句、用力拔高。

本模型（MiMo）实测出的高频口头禅，尤其要避开：
- 句首连接词"此外""总之""当然"——能不用就不用，需要承接时换更自然的说法或直接去掉。
- 泛化套路句式"……是一种……""关键/重点在于……""这种……""我们……"——尽量改成具体主语和动词。

格式硬规则：只输出纯文本。禁止任何 Markdown 标记（## 标题、** 加粗、- / * 列表、> 引用、\`代码\` 等），这些符号会原样出现在 Word 文档里。

改写目标：说人话。短句优先、信息密度高、有具体细节、语气自然，像一个真人专栏作者写的。
绝不能改变原文的事实、数据、人名、观点立场。只改表达，不改信息。`;

const ANTI_AI_RULES_EN = `You help writers strip the "AI smell" out of their text. Typical tells of AI writing:
1. Boilerplate openers/closers: "In conclusion", "It is worth noting that", "In today's society", "With the development of...".
2. Vague summary sentences and correct-but-empty filler with low information density.
3. Piled-up parallelism and symmetry; sentence shapes that are too neat and balanced.
4. Over-modification with adjectives/adverbs; overuse of "not only... but also", "both... and".
5. Mechanical transitions: "Firstly/Secondly/However/Therefore" strung together.
6. Twisting a simple point into a long sentence and over-inflating it.

Phrases to avoid especially:
- Sentence-initial connectives like "Moreover", "In summary", "Of course" — drop them when possible, or use a more natural link.
- Generic frames like "... is a kind of ...", "The key/point is ...", "This sort of ...", "We ..." — prefer concrete subjects and verbs.

Hard formatting rule: output plain text only. No Markdown whatsoever (## headings, ** bold, - / * lists, > quotes, \`code\`); those symbols would show up literally in the Word document.

Goal: write like a human. Short sentences first, high information density, concrete detail, a natural voice — like a real columnist wrote it.
Never change the facts, numbers, names, or stance of the original. Change only the wording, not the information.`;

export function antiAiRules(lang: Lang): string {
  return lang === "zh" ? ANTI_AI_RULES_ZH : ANTI_AI_RULES_EN;
}

/** 从范文提取风格画像 / Extract a style profile from sample text */
export function styleProfilePrompt(samples: string, lang: Lang): string {
  if (lang === "zh") {
    return `下面是若干篇风格相近的范文片段。请用 5 条以内的要点，总结它们的写作风格特征（句长、用词习惯、语气、节奏、标点偏好等），供后续改写对齐。只输出要点，不要解释。

范文：
"""
${samples}
"""`;
  }
  return `Below are several excerpts written in a similar style. Summarize their writing-style traits in at most 5 bullet points (sentence length, word choice, tone, rhythm, punctuation habits, etc.) so later rewriting can align to them. Output the points only, no explanation.

Samples:
"""
${samples}
"""`;
}

/** 整篇按段改写。要求逐段对齐返回 JSON。 / Whole-doc paragraph rewrite, returns aligned JSON */
export function rewriteDocPrompt(
  styleSummary: string,
  paragraphs: { index: number; kind: string; text: string }[],
  lang: Lang
): string {
  const list = paragraphs.map((p) => `[${p.index}] (${p.kind}) ${p.text}`).join("\n");

  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

要模仿的风格：
${styleSummary || "（无范文，按上面的去 AI 味原则即可）"}

下面是原文段落，每行以 [序号] (类型) 开头。请逐段改写，保持段落数量和顺序完全一致。
标题（heading*）只做轻微润色、不要扩写。列表（list）保持简短。

严格只输出 JSON 数组，每项形如 {"index": 序号, "text": "改写后的整段文本"}，不要任何额外文字、不要 markdown 代码块。

原文：
${list}`;
  }

  return `${ANTI_AI_RULES_EN}

Style to imitate:
${styleSummary || "(no samples; just apply the de-AI principles above)"}

Below are the source paragraphs, each line starting with [index] (kind). Rewrite paragraph by paragraph, keeping the exact same count and order.
Headings (heading*) get only light polishing — do not expand them. Keep lists (list) short.

Output strictly a JSON array, each item like {"index": <number>, "text": "rewritten paragraph"}, with no extra text and no markdown code block.

Source:
${list}`;
}

/** 标题改写规则：概括全文 + 抓住注意力 / Title rules: summarize + grab attention */
const TITLE_RULES_ZH = `这是文章标题，要求和正文完全不同：
1. 用一句话概括全文核心，第一眼就能抓住读者注意力。
2. 必须基于文章真实内容，点出最具体、最有信息量或最有反差的那个点；不要泛泛而谈，也不要夸大或与正文不符的标题党。
3. 简洁有力：多用具体名词、数字，以及"首次/刚刚/解决/来了/史上"等带张力的词；可用"事件：判断"的冒号结构或感叹收尾。
4. 不堆形容词、不喊空口号。只输出标题文字本身，不要书名号或引号包裹。`;

const TITLE_RULES_EN = `This is the article title, and the rules differ from the body:
1. Capture the core of the whole piece in one line that grabs attention on first read.
2. Ground it in the real content — surface the most concrete, most informative, or most surprising point. No vague phrasing, and no clickbait that overstates or contradicts the body.
3. Tight and punchy: prefer concrete nouns and numbers, plus tension words like "first/just/solved/here/ever"; a "event: takeaway" colon structure or an exclamation can work.
4. No piled-up adjectives, no empty slogans. Output only the title text, with no surrounding quotes or brackets.`;

/** 标题改写：基于全文生成多个标题候选 / Title rewrite: N candidates from full text */
export function rewriteTitlePrompt(styleSummary: string, fullText: string, n: number, lang: Lang): string {
  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

要模仿的风格：
${styleSummary || "（按下面的标题规则即可）"}

${TITLE_RULES_ZH}

下面是整篇文章。请基于全文，拟 ${n} 个不同的标题（角度或句式可以不同）。
严格只输出 JSON 字符串数组，如 ["标题一","标题二"]，不要任何额外文字、不要 markdown 代码块。

全文：
"""
${fullText}
"""`;
  }

  return `${ANTI_AI_RULES_EN}

Style to imitate:
${styleSummary || "(just follow the title rules below)"}

${TITLE_RULES_EN}

Below is the full article. Based on it, draft ${n} different titles (vary the angle or structure).
Output strictly a JSON array of strings, e.g. ["Title one","Title two"], with no extra text and no markdown code block.

Full text:
"""
${fullText}
"""`;
}

/** 单句生成多个候选表达 / Multiple alternative phrasings for one sentence */
export function alternativesPrompt(
  styleSummary: string,
  context: string,
  sentence: string,
  n: number,
  lang: Lang
): string {
  if (lang === "zh") {
    return `${ANTI_AI_RULES_ZH}

要模仿的风格：
${styleSummary || "（按去 AI 味原则即可）"}

下面这句话出现在这段上下文里：
"""
${context}
"""

请只针对【目标句】给出 ${n} 个不同的表达方式，长短、语气可以有差异，但必须保持原意和事实不变。
目标句：${sentence}

严格只输出 JSON 字符串数组，例如 ["写法一","写法二"]，不要任何额外文字、不要 markdown 代码块。`;
  }

  return `${ANTI_AI_RULES_EN}

Style to imitate:
${styleSummary || "(just apply the de-AI principles)"}

The sentence below appears in this context:
"""
${context}
"""

For the TARGET sentence only, give ${n} different phrasings. Length and tone may vary, but the meaning and facts must stay unchanged.
Target sentence: ${sentence}

Output strictly a JSON array of strings, e.g. ["Option one","Option two"], with no extra text and no markdown code block.`;
}

/** 按领域自动生成选题 / Auto-generate article topics for a domain */
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

/** 从选题生成完整文章 / Generate a full article from a topic */
export function articleDraftPrompt(input: GenerateArticleInput): string {
  const lang: Lang = input.lang ?? "en";
  const topic = typeof input.topic === "string" ? { title: input.topic } : (input.topic as TopicOption);

  if (lang === "zh") {
    const lengthHint =
      input.targetLength === "short"
        ? "约 900-1200 字，段落更短，适合快速发布。"
        : input.targetLength === "long"
          ? "约 1800-2400 字，需要有更充分的案例、判断和收束。"
          : "约 1300-1800 字，适合常规公众号文章。";

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
5. 禁止 AI 口头禅和废话：不要写"值得注意的是""不可忽视""赋能""新范式""深度融合""未来可期""综上所述"。
6. 不要擅自发散，不要写无法验证的预测，不要把推测写成事实。
7. 语言凝练，论点先行，论据跟上。短句优先，不堆形容词。
8. 不输出 Markdown，不用列表符号。图、表、参考文献由系统根据来源自动生成，你只负责写正文。

严格只输出 JSON 对象，格式如下：
{"title":"文章标题","paragraphs":["第一段正文","第二段正文"]}
不要任何额外文字、不要 markdown 代码块。`;
  }

  const lengthHint =
    input.targetLength === "short"
      ? "about 600-900 words, shorter paragraphs, good for a quick post."
      : input.targetLength === "long"
        ? "about 1300-1800 words, with fuller cases, judgment, and a closing."
        : "about 900-1300 words, a standard article length.";

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
5. No AI filler: avoid "It is worth noting", "cannot be ignored", "empower", "new paradigm", "deep integration", "a promising future", "in conclusion".
6. Do not wander, do not write unverifiable predictions, do not present speculation as fact.
7. Tight prose, claim first then evidence. Short sentences first, no piled-up adjectives.
8. Output no Markdown and no list bullets. Figures, tables, and references are generated by the system from sources — you only write the body.

Output strictly a JSON object in this format:
{"title":"Article title","paragraphs":["First paragraph","Second paragraph"]}
No extra text, no markdown code block.`;
}
