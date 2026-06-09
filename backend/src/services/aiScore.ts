/**
 * 「人类感」评分 —— 纯本地、零模型调用的启发式打分。
 * Local, deterministic human-likeness score. No LLM call, no network — your text never leaves the machine.
 *
 * 输出 0–100：越高越像人类文章。附带 AI 痕迹扣分明细，方便前端展示「为什么扣分」。
 * Returns 0–100 (higher = more human-like) plus a deduction breakdown of AI tells.
 *
 * 它衡量「读起来像不像真人文章」，不是「能不能骗过检测器」——我们刻意不做后者。
 */

import type { Lang } from "../core/i18n.js";

export interface ScoreSignal {
  id: string;
  label: string;
  hits: number;
  points: number; // 该类贡献的扣分（已封顶）
}

export interface AiScore {
  score: number; // 0–100，越高越像人类文章
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
    phrases: [
      "赋能",
      "新范式",
      "深度融合",
      "未来可期",
      "持续发力",
      "生态闭环",
      "降本增效",
      "底层逻辑",
      "护城河",
      "强强联合",
      "颗粒度",
      "抓手",
      "打法",
      "心智",
      "势能",
      "链路",
      "闭环",
      "方法论",
    ],
    scale: 55,
    max: 18,
  },
  {
    id: "model-catchphrase",
    label: "模型腔口头禅",
    phrases: [
      "稳稳拖住",
      "先接住",
      "接住",
      "更狠一点",
      "更猛一点",
      "直接拉满",
      "一把梭",
      "给到",
      "打透",
      "说白了",
      "翻译成人话",
      "这事儿",
      "这波",
      "狠狠",
      "拿捏",
      "破防",
      "杀疯了",
      "封神",
      "天花板",
      "闭眼入",
      "不允许还有人不知道",
    ],
    scale: 70,
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
    phrases: [
      "leverage",
      "empower",
      "seamless",
      "game-changer",
      "cutting-edge",
      "delve into",
      "delve",
      "tapestry",
      "testament to",
      "navigate the",
      "in the realm of",
      "ever-evolving",
      "underscore",
      "pivotal",
      "robust",
      "holistic",
      "nuanced",
      "unlock",
      "transformative",
      "foster",
      "elevate",
    ],
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

const SCORE_FORMULA = {
  zhUnitChars: 120,
  enUnitWords: 100,
  shortZhChars: 40,
  shortEnWords: 25,
  shortTextConfidence: 0.65,
  thresholds: { high: 70, medium: 40 },
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

function repetitionSignal(text: string, lang: Lang, units: number): ScoreSignal {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "has",
    "will",
    "一个",
    "我们",
    "他们",
    "这些",
    "那些",
    "可以",
    "因为",
    "但是",
  ]);
  const tokens =
    lang === "zh"
      ? Array.from(text.matchAll(/[\u4e00-\u9fff]{2,4}/g), (m) => m[0])
      : (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (stop.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const repeated = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 2), 0);
  const points = Math.min(10, (repeated / units) * 3.5);
  return { id: "repetition", label: lang === "zh" ? "词语重复偏多" : "Repeated wording", hits: repeated, points };
}

function concretenessSignal(text: string, lang: Lang, units: number): ScoreSignal {
  const anchors =
    (text.match(/\d+(?:[.,]\d+)?%?/g) ?? []).length +
    (text.match(/[《"][^《》"]{2,}[》"]/g) ?? []).length +
    (text.match(/\[[0-9]+\]/g) ?? []).length +
    (lang === "en" ? (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? []).length : 0);
  const density = anchors / units;
  const points = Math.min(8, Math.max(0, (0.45 - density) / 0.45) * 8);
  return { id: "concreteness", label: lang === "zh" ? "具体锚点不足" : "Few concrete anchors", hits: anchors, points };
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
 * Score text for human-likeness on a 0–100 scale (higher = more human-like).
 *
 * Fully local and deterministic: matches language-specific AI tells
 * (boilerplate, buzzwords, mechanical connectives, leaked Markdown,
 * parallelism, uniform sentence length), normalizes by length, caps each
 * category, and converts the AI-tell penalty into a human-likeness score.
 *
 * @param text The text to score.
 * @param lang Language selecting the pattern sets.
 * @returns The score, a coarse level, and the hit breakdown (descending).
 */
export function scoreText(text: string, lang: Lang): AiScore {
  const clean = (text ?? "").trim();
  const sentences = splitForScoring(clean);
  const len = lang === "zh" ? Array.from(clean).length : clean.split(/\s+/).filter(Boolean).length;
  const units = Math.max(1, len / (lang === "zh" ? SCORE_FORMULA.zhUnitChars : SCORE_FORMULA.enUnitWords));

  const groups = lang === "zh" ? ZH_PHRASES : EN_PHRASES;
  const parallel = lang === "zh" ? PARALLEL_ZH : PARALLEL_EN;

  const signals: ScoreSignal[] = [
    ...groups.map((g) => phraseGroupScore(g, clean, sentences, units)),
    regexGroupScore(parallel, clean, units),
    regexGroupScore(MARKDOWN, clean, units),
    uniformitySignal(sentences, lang),
    repetitionSignal(clean, lang, units),
    concretenessSignal(clean, lang, units),
  ];

  const penalty = Math.max(0, Math.min(100, signals.reduce((a, s) => a + s.points, 0)));
  const enoughText = len >= (lang === "zh" ? SCORE_FORMULA.shortZhChars : SCORE_FORMULA.shortEnWords);
  const lengthConfidence = len === 0 ? 0 : enoughText ? 1 : SCORE_FORMULA.shortTextConfidence;
  const score = Math.round(Math.max(0, Math.min(100, (100 - penalty) * lengthConfidence)));
  const level: AiScore["level"] =
    score >= SCORE_FORMULA.thresholds.high ? "high" : score >= SCORE_FORMULA.thresholds.medium ? "medium" : "low";

  const shown = signals
    .filter((s) => s.points >= 0.5)
    .sort((a, b) => b.points - a.points)
    .map((s) => ({ ...s, points: Math.round(s.points) }));

  return { score, level, signals: shown };
}
