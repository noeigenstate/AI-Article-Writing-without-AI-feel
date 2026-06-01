/**
 * 内置风格画像（蒸馏自作者作品的「skill」）。
 * Built-in style profiles (distilled "skills"). Selecting one aligns the model's
 * voice without uploading samples each time.
 *
 * 注意：画像只描述「怎么表达」，不描述「加什么段落」——改写不得新增原文没有的信息。
 * Note: a profile describes HOW to express, not WHAT to add — rewriting must not add information.
 */

import type { Lang } from "./i18n.js";

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
改写时模仿以下特征，但绝不新增原文没有的信息、数据或段落。

【语气与人称】专业但亲切，像懂行的朋友在讲解。常用第一人称"我们"带读者一起看，偶尔直接对"你"说话（"说白了……""你可能会说……"）。以客观转述为主，可夹带明确判断（如"毋庸置疑""简直颠覆"），对科研工作者带一点人文温度。

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
Imitate the traits below, but never add information, data, or paragraphs that are not in the source.

[Tone & person] Expert but warm, like a knowledgeable friend explaining. Often uses "we" to take the reader along, and occasionally speaks to "you" directly ("Put simply...", "You might ask..."). Mostly objective reporting, but allowed a clear judgment now and then; a bit of human warmth toward researchers.

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

export function getBuiltinStyles(lang: Lang): BuiltinStyle[] {
  return BUILTIN_STYLE_DEFS.map((s) => ({
    id: s.id,
    name: s.name[lang],
    desc: s.desc[lang],
    profile: s.profile[lang],
  }));
}

export function getBuiltinStyle(id: string, lang: Lang = "en"): BuiltinStyle | undefined {
  return getBuiltinStyles(lang).find((s) => s.id === id);
}
