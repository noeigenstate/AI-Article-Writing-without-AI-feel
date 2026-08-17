/**
 * 内置风格画像（蒸馏自作者作品的「skill」）。
 * Built-in style profiles (distilled "skills"). Selecting one aligns the model's
 * voice without uploading samples each time.
 *
 * 注意：画像只描述「怎么表达」，不是新事实来源。改写不得增加原文信息；
 * 生成时可重组已有资料的段落与叙事次序，但不得新增事实。
 * Note: a profile describes HOW to express and is never a source of new facts.
 * Rewriting may not add information; generation may reorganize supported material
 * into paragraphs and narrative beats without inventing facts.
 */

import type { Lang } from "../core/i18n.js";

export interface BuiltinStyle {
  id: string;
  name: string;
  desc: string;
  profile: string;
}

interface BuiltinStyleDef {
  id: string;
  name: { en: string; zh: string };
  desc: { en: string; zh: string };
  profile: { en: string; zh: string };
}

/** 蒸馏自 15 篇前沿科技 / 科研论文解读文章 / Distilled from 15 tech & research explainer pieces */
const DLR_TECH_ZH = `作者笔法：前沿科技与科研论文解读（科普评论，题材如 AI、量子计算、流体力学）。
使用以下表达特征。改写时不新增原文信息；生成时可把参考资料合并、拆分和重排成新段落，但不得增加资料无法支撑的信息、数据、人物经历或场景细节。

【语气与人称】专业但亲切，像懂行的朋友在讲解。常用第一人称"我们"带读者一起看，偶尔直接对"你"说话（"说白了……""你可能会说……"）。以客观转述为主，可夹带明确而有分寸的判断。不只写结论，也关心技术对研究者、使用者和普通人的具体意味；人文温度来自有资料依据的处境、选择与代价，不靠夸张感叹。

【叙事与情绪】先把重复资料合并成几个问题，再按“读者为什么要关心—证据说明什么—机制如何运作—边界在哪里”推进，不按来源顺序摘抄。可用一处真实可支撑的场景把抽象技术落到人身上，并在结尾回扣；情绪从疑问或落差走向理解和判断。欲扬先抑、拟人和比喻只选真正有助理解的一两处，不把修辞当成任务清单。

【句子】信息密度高，敢用长句，用分号把若干相关分句串接起来；但每隔几句要插一句大白话，把术语"翻译"成直觉（"说白了，就是……""所谓……"）。不要短句排比、不要口号式整齐对仗。

【用词】
- 专有名词、模型名、英文术语保留原文，必要时配中文对照：如 World Model（世界模型）、start-stop（启停）、Sota。
- 可少量点缀成语/文言增色：由来已久、毋庸置疑、相辅相成、一拍即合、迎头而上、命中注定——点到为止，绝不堆砌。
- 数字、参数、单位、公式、文献严格照原文，不改动、不省略、不杜撰。

【标题】作者标题套路：一句话概括全文、第一眼抓注意力。常见手法——
- 张力词起手或收尾：首次 / 刚刚 / 来了 / 解决 / 史上首次。
- 数字+反差："一个困扰了流体界60年的湍流谜题被解决"。
- "事件：判断"冒号结构："IQM上机成功：AI+量子时代来临"。
- 点出具体主体（模型名/机构/系统名），不泛泛而谈；可用感叹号，但不堆形容词、不喊空口号。

【避免】套话开头结尾；空泛拔高的正确废话；机械过渡词（首先/其次/此外/总之/然而连用）；把判断写成谁都不会反对的废话。`;

const DLR_TECH_EN = `Author voice: frontier tech and research-paper explainers (popular-science commentary on topics like AI, quantum computing, fluid dynamics).
Use the expressive traits below. In rewriting, add no information beyond the original. In generation, you may merge, split, and reorder supported reference material into new paragraphs, but never add facts, data, personal experiences, or scene details that the material does not support.

[Tone & person] Expert but warm, like a knowledgeable friend explaining. Often uses "we" to take the reader along, and occasionally speaks to "you" directly ("Put simply...", "You might ask..."). Mostly objective reporting, but allowed a clear and measured judgment now and then. Do not stop at technical outcomes: show what the work means for researchers, users, and ordinary people. Human warmth must come from supported circumstances, choices, and costs, not inflated sentiment.

[Narrative & emotion] First merge repeated material into a few reader questions, then move through why the reader should care, what the evidence shows, how the mechanism works, and where the limits are. Never summarize one source after another. One supported concrete scene may bring an abstract technology down to human scale and echo at the close. Let the emotional movement travel from a question or gap toward understanding and judgment. Use contrast-before-reveal, personification, or metaphor only once or twice where it genuinely improves comprehension; never treat them as a checklist.

[Sentences] High information density; not afraid of longer sentences that chain related clauses. But every few sentences, drop in one plain-language line that "translates" the jargon into intuition ("Put simply, it means...", "What this really is..."). No short-sentence parallelism, no slogan-like symmetry.

[Word choice]
- Keep proper nouns, model names, and technical terms as-is; gloss them on first use when helpful (e.g., World Model, start-stop, SOTA).
- Numbers, parameters, units, formulas, and references follow the source exactly — no changes, omissions, or fabrication.

[Titles] One-line summary of the whole piece that grabs attention on first read. Common moves —
- Tension words to open or close: first / just / here / solved / ever.
- Number + contrast: "A 60-year turbulence puzzle in fluid dynamics, finally solved".
- "Event: takeaway" colon structure: "IQM goes live: the AI + quantum era arrives".
- Name a concrete subject (model/lab/system), never vague; an exclamation is fine, but no piled-up adjectives and no empty slogans.

[Avoid] Boilerplate openers/closers; vague correct-but-empty filler; mechanical transitions (Firstly/Secondly/Moreover/However strung together); judgments phrased so no one could disagree.`;

const BUILTIN_STYLE_DEFS: BuiltinStyleDef[] = [
  {
    id: "dlr-tech",
    name: { en: "My style · Tech & research explainer", zh: "我的风格 · 前沿科技/论文解读" },
    desc: {
      en: "Distilled from 15 articles: expert yet warm, long sentences + plain talk, term glosses, sparing flourishes.",
      zh: "蒸馏自 15 篇文章：专业亲切、长句+大白话、中英术语对照、少量成语点缀。",
    },
    profile: { en: DLR_TECH_EN, zh: DLR_TECH_ZH },
  },
];

/**
 * List the built-in style profiles, localized to the given language.
 *
 * @param lang Target language.
 * @returns The available styles.
 */
export function getBuiltinStyles(lang: Lang): BuiltinStyle[] {
  return BUILTIN_STYLE_DEFS.map((s) => ({
    id: s.id,
    name: s.name[lang],
    desc: s.desc[lang],
    profile: s.profile[lang],
  }));
}

/**
 * Look up a single built-in style by id.
 *
 * @param id The style id.
 * @param lang Target language (defaults to English).
 * @returns The style, or undefined if not found.
 */
export function getBuiltinStyle(id: string, lang: Lang = "en"): BuiltinStyle | undefined {
  return getBuiltinStyles(lang).find((s) => s.id === id);
}
