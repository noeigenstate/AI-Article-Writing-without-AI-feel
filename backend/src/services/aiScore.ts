/**
 * 「AI 味」评分 —— 纯本地、零模型调用的启发式打分。
 * Local, deterministic "AI smell" score. No LLM call, no network — your text never leaves the machine.
 *
 * 输出 0–100：越高越像 AI 写的。附带命中明细，方便前端展示「为什么扣分」。
 * Returns 0–100 (higher = more AI-flavored) plus a breakdown of which tells were hit.
 *
 * 它衡量「读起来像不像 AI」，不是「能不能骗过检测器」——我们刻意不做后者。
 */

import type { Lang } from "../core/i18n.js";

export interface ScoreSignal {
  id: string;
  label: string;
  hits: number;
  points: number; // 该类贡献的扣分（已封顶）
}

export interface AiScore {
  score: number; // 0–100，越高越「AI」
  level: "low" | "medium" | "high";
  signals: ScoreSignal[]; // 仅返回命中的项，按扣分降序
}

interface PhraseGroup {
  id: string;
  label: string;
  phrases: string[]; // 直接子串匹配（中文）或单词匹配（英文）
  atSentenceStart?: boolean; // 仅统计句首命中
  scale: number; // 密度 → 分数的放大系数
  max: number; // 该类封顶
}

interface RegexGroup {
  id: string;
  label: string;
  patterns: RegExp[];
  scale: number;
  max: number;
}

const ZH_PHRASES: PhraseGroup[] = [
  {
    id: "opener",
    label: "套话开头/收尾",
    phrases: ["综上所述", "总而言之", "总的来说", "总之", "一言以蔽之", "由此可见", "在当今", "当今社会", "在这个", "归根结底"],
    scale: 60,
    max: 26,
  },
  {
    id: "filler",
    label: "正确的废话/空泛评注",
    phrases: ["值得注意的是", "值得一提的是", "不难发现", "不难看出", "显而易见", "毫无疑问", "众所周知", "不可忽视", "正因如此", "重要的是"],
    scale: 60,
    max: 22,
  },
  {
    id: "buzz",
    label: "营销黑话",
    phrases: ["赋能", "新范式", "深度融合", "未来可期", "持续发力", "生态闭环", "降本增效", "底层逻辑", "护城河", "强强联合"],
    scale: 55,
    max: 18,
  },
  {
    id: "connective",
    label: "机械连接词起头",
    phrases: ["此外", "然而", "因此", "首先", "其次", "再者", "最后", "与此同时", "另一方面", "综上"],
    atSentenceStart: true,
    scale: 45,
    max: 18,
  },
  {
    id: "frame",
    label: "泛化套路句式",
    phrases: ["是一种", "关键在于", "重点在于", "核心在于", "我们可以", "我们需要", "这种现象", "这一", "对于"],
    scale: 30,
    max: 14,
  },
];

const EN_PHRASES: PhraseGroup[] = [
  {
    id: "opener",
    label: "Boilerplate opener/closer",
    phrases: ["in conclusion", "in today's", "in the modern world", "in summary", "to sum up", "all in all", "at the end of the day", "in this day and age"],
    scale: 70,
    max: 26,
  },
  {
    id: "filler",
    label: "Empty filler / hedging",
    phrases: ["it is worth noting", "it is important to note", "needless to say", "it goes without saying", "it cannot be denied", "undoubtedly", "without a doubt"],
    scale: 70,
    max: 22,
  },
  {
    id: "buzz",
    label: "AI buzzwords",
    phrases: ["leverage", "empower", "seamless", "game-changer", "cutting-edge", "delve into", "tapestry", "testament to", "navigate the", "in the realm of", "ever-evolving"],
    scale: 55,
    max: 20,
  },
  {
    id: "connective",
    label: "Mechanical sentence-start connective",
    phrases: ["moreover", "furthermore", "however", "therefore", "additionally", "firstly", "secondly", "finally", "in addition", "consequently"],
    atSentenceStart: true,
    scale: 50,
    max: 18,
  },
  {
    id: "frame",
    label: "Generic frame",
    phrases: ["is a kind of", "the key is", "plays a crucial role", "plays a vital role", "when it comes to", "a wide range of"],
    scale: 35,
    max: 14,
  },
];

const PARALLEL_ZH: RegexGroup = {
  id: "parallel",
  label: "排比/对仗堆砌",
  patterns: [
    /不仅[^。！？\n]{0,40}(而且|还|也|更)/g,
    /既[^。！？\n]{0,30}又/g,
    /无论[^。！？\n]{0,30}(还是|都)/g,
    /一方面[^。！？\n]{0,40}另一方面/g,
  ],
  scale: 60,
  max: 16,
};

const PARALLEL_EN: RegexGroup = {
  id: "parallel",
  label: "Piled-up parallelism",
  patterns: [/not only\b[^.!?\n]{0,60}\bbut also/gi, /\bboth\b[^.!?\n]{0,40}\band\b/gi],
  scale: 55,
  max: 14,
};

/** Markdown 残留：这些符号会原样进 Word，是最直接的 AI 痕迹 */
const MARKDOWN: RegexGroup = {
  id: "markdown",
  label: "Markdown 残留 / leaked Markdown",
  patterns: [/^#{1,6}\s/gm, /\*\*[^*\n]+\*\*/g, /^\s*[-*]\s+/gm, /^\s*>\s/gm, /`[^`\n]+`/g],
  scale: 40,
  max: 20,
};

/**
 * Split text into rough sentences for both languages (heuristic, scoring only).
 *
 * @param text The text to split.
 * @returns Non-empty, trimmed sentence-ish pieces.
 */
function splitForScoring(text: string): string[] {
  return text
    .split(/[。.!?！？;；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Count non-overlapping occurrences of a phrase.
 *
 * @param text Haystack.
 * @param phrase Needle.
 * @returns Occurrence count (0 for an empty needle).
 */
function countPhrase(text: string, phrase: string): number {
  if (!phrase) return 0;
  return text.split(phrase).length - 1;
}

/**
 * Score one phrase group as length-normalized, capped points.
 *
 * @param group The phrase group definition.
 * @param text Lowercased-internally haystack.
 * @param sentences Pre-split sentences (for sentence-start matching).
 * @param units Length units (per ~100–120 chars/words) for normalization.
 * @returns The group's hits and capped point contribution.
 */
function phraseGroupScore(group: PhraseGroup, text: string, sentences: string[], units: number): ScoreSignal {
  const haystack = text.toLowerCase();
  let hits = 0;
  if (group.atSentenceStart) {
    for (const s of sentences) {
      const head = s.toLowerCase().replace(/^[^0-9a-z一-龥]+/, "");
      if (group.phrases.some((p) => head.startsWith(p.toLowerCase()))) hits++;
    }
  } else {
    for (const p of group.phrases) hits += countPhrase(haystack, p.toLowerCase());
  }
  const density = hits / units;
  const points = Math.min(group.max, density * group.scale);
  return { id: group.id, label: group.label, hits, points };
}

/**
 * Score one regex group (parallelism, leaked Markdown) as capped points.
 *
 * @param group The regex group definition.
 * @param text Haystack.
 * @param units Length units for normalization.
 * @returns The group's hits and capped point contribution.
 */
function regexGroupScore(group: RegexGroup, text: string, units: number): ScoreSignal {
  let hits = 0;
  for (const re of group.patterns) hits += (text.match(re) ?? []).length;
  const density = hits / units;
  const points = Math.min(group.max, density * group.scale);
  return { id: group.id, label: group.label, hits, points };
}

/**
 * Penalize overly uniform sentence lengths (humans vary more; low CV is an AI tell).
 *
 * @param sentences Pre-split sentences.
 * @param lang Language (decides char vs word length).
 * @returns A signal worth up to ~12 points; 0 when there are too few sentences.
 */
function uniformitySignal(sentences: string[], lang: Lang): ScoreSignal {
  const lens = sentences
    .map((s) => (lang === "zh" ? Array.from(s).length : s.split(/\s+/).filter(Boolean).length))
    .filter((n) => n > 1);
  if (lens.length < 5) return { id: "uniformity", label: "句长单一", hits: 0, points: 0 };
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const cv = Math.sqrt(variance) / (mean || 1); // 变异系数
  // CV 越低越均匀越像 AI。0.25 以下满扣，0.55 以上不扣。
  const norm = Math.max(0, Math.min(1, (0.55 - cv) / 0.3));
  return { id: "uniformity", label: lang === "zh" ? "句长过于均匀" : "Uniform sentence length", hits: 0, points: norm * 12 };
}

/**
 * Score text for "AI smell" on a 0–100 scale (higher = more AI-flavored).
 *
 * Fully local and deterministic: matches language-specific tells (boilerplate,
 * buzzwords, mechanical connectives, leaked Markdown, parallelism, uniform
 * sentence length), normalizes by length, caps each category, and sums.
 *
 * @param text The text to score.
 * @param lang Language selecting the pattern sets.
 * @returns The score, a coarse level, and the hit breakdown (descending).
 */
export function scoreText(text: string, lang: Lang): AiScore {
  const clean = (text ?? "").trim();
  const sentences = splitForScoring(clean);
  const len = lang === "zh" ? Array.from(clean).length : clean.split(/\s+/).filter(Boolean).length;
  const units = Math.max(1, len / (lang === "zh" ? 120 : 100));

  const groups = lang === "zh" ? ZH_PHRASES : EN_PHRASES;
  const parallel = lang === "zh" ? PARALLEL_ZH : PARALLEL_EN;

  const signals: ScoreSignal[] = [
    ...groups.map((g) => phraseGroupScore(g, clean, sentences, units)),
    regexGroupScore(parallel, clean, units),
    regexGroupScore(MARKDOWN, clean, units),
    uniformitySignal(sentences, lang),
  ];

  const raw = signals.reduce((a, s) => a + s.points, 0);
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const level: AiScore["level"] = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const shown = signals
    .filter((s) => s.points >= 0.5)
    .sort((a, b) => b.points - a.points)
    .map((s) => ({ ...s, points: Math.round(s.points) }));

  return { score, level, signals: shown };
}
