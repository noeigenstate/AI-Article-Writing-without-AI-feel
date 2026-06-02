/**
 * Prompt builders for the de-AI rewrite flow: style extraction, whole-doc rewrite,
 * title alternatives, and per-sentence alternatives. All are bilingual (en/zh).
 */

import type { Lang } from "../core/i18n.js";
import { ANTI_AI_RULES_ZH, ANTI_AI_RULES_EN } from "./rules.js";

/**
 * Build the prompt that distills a style profile from sample text.
 *
 * @param samples Concatenated sample excerpts.
 * @param lang Output language.
 * @returns The style-extraction prompt.
 */
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

/**
 * Build the whole-document, paragraph-aligned rewrite prompt.
 *
 * @param styleSummary Style profile to imitate (may be empty).
 * @param paragraphs Source paragraphs tagged with index and kind.
 * @param lang Output language.
 * @returns A prompt requesting a JSON array of `{index, text}` items.
 */
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

/** Chinese title-writing rules: summarize the whole piece and grab attention. */
const TITLE_RULES_ZH = `这是文章标题，要求和正文完全不同：
1. 用一句话概括全文核心，第一眼就能抓住读者注意力。
2. 必须基于文章真实内容，点出最具体、最有信息量或最有反差的那个点；不要泛泛而谈，也不要夸大或与正文不符的标题党。
3. 简洁有力：多用具体名词、数字，以及"首次/刚刚/解决/来了/史上"等带张力的词；可用"事件：判断"的冒号结构或感叹收尾。
4. 不堆形容词、不喊空口号。只输出标题文字本身，不要书名号或引号包裹。`;

/** English title-writing rules: summarize the whole piece and grab attention. */
const TITLE_RULES_EN = `This is the article title, and the rules differ from the body:
1. Capture the core of the whole piece in one line that grabs attention on first read.
2. Ground it in the real content — surface the most concrete, most informative, or most surprising point. No vague phrasing, and no clickbait that overstates or contradicts the body.
3. Tight and punchy: prefer concrete nouns and numbers, plus tension words like "first/just/solved/here/ever"; a "event: takeaway" colon structure or an exclamation can work.
4. No piled-up adjectives, no empty slogans. Output only the title text, with no surrounding quotes or brackets.`;

/**
 * Build the prompt that generates N title candidates from the full article text.
 *
 * @param styleSummary Style profile to imitate (may be empty).
 * @param fullText The full article body.
 * @param n Number of titles to request.
 * @param lang Output language.
 * @returns A prompt requesting a JSON array of title strings.
 */
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

/**
 * Build the prompt that offers N alternative phrasings for a single sentence.
 *
 * @param styleSummary Style profile to imitate (may be empty).
 * @param context The paragraph the sentence appears in.
 * @param sentence The target sentence to rephrase.
 * @param n Number of alternatives to request.
 * @param lang Output language.
 * @returns A prompt requesting a JSON array of phrasing strings.
 */
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
