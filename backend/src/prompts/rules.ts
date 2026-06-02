/**
 * The operational definition of "AI smell", shared by every rewrite/generation prompt.
 * Keeping it in one place lets the de-AI policy be tuned without touching call sites.
 */

import type { Lang } from "../core/i18n.js";

/** Chinese anti-AI ruleset, embedded verbatim into Chinese prompts. */
export const ANTI_AI_RULES_ZH = `你在帮中文作者去除文章里的"AI 味"。AI 味的典型表现：
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

/** English anti-AI ruleset, embedded verbatim into English prompts. */
export const ANTI_AI_RULES_EN = `You help writers strip the "AI smell" out of their text. Typical tells of AI writing:
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

/**
 * Return the anti-AI ruleset for the given UI language.
 *
 * @param lang Target language.
 * @returns The Chinese or English ruleset string.
 */
export function antiAiRules(lang: Lang): string {
  return lang === "zh" ? ANTI_AI_RULES_ZH : ANTI_AI_RULES_EN;
}
