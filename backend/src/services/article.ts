import { chat, type ChatOptions } from "./llm.js";
import type { DocxBlock, ParaKind } from "./docx.js";
import type { ResearchItem } from "./research/types.js";
import { articleDraftPrompt, articleLengthFixPrompt, articleTopicsPrompt } from "../prompts/article.prompts.js";
import { escapeSvg, shortDate, slug, stringField, truncate } from "../lib/text.js";
import { parseJsonWithRepair } from "../lib/json.js";
import {
  ARTICLE_LABELS,
  tr,
  type Lang,
} from "../core/i18n.js";

export interface ArticleDomain {
  id: string;
  name: string;
  desc: string;
}

export interface TopicOption {
  id: string;
  title: string;
  angle: string;
  audience: string;
  keywords: string[];
}

export interface GeneratedArticle {
  title: string;
  paragraphs: string[];
  references?: ArticleReference[];
  /** Lead figure shown after the opening paragraph. */
  figure?: ArticleFigure;
  /** Extra source images placed near the body paragraph they match. */
  bodyFigures?: ArticleFigure[];
}

export interface ArticleReference {
  id: number;
  text: string;
}

export interface ArticleFigure {
  title: string;
  caption: string;
  svg: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  afterParagraphIndex?: number;
}

export interface ArticleDomainMatch {
  domain: ArticleDomain;
  score: number;
  reasons: string[];
}

export type ArticleRenderBlock =
  | { type: "paragraph"; kind: ParaKind; text: string; paragraphIndex?: number }
  | { type: "figure"; title: string; caption: string; svg: string; imageUrl?: string; sourceName?: string; sourceUrl?: string }
  | { type: "table"; title: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "references"; title: string; items: string[] };

export interface GenerateTopicOptionsInput {
  domain: ArticleDomain;
  n?: number;
  researchContext?: string;
  lang?: Lang;
}

export interface GenerateArticleInput {
  domainName: string;
  topic: TopicOption | string;
  styleSummary?: string;
  targetLength?: "short" | "medium" | "long";
  researchContext?: string;
  lang?: Lang;
}

type ChatFn = (prompt: string, opts?: ChatOptions) => Promise<string>;

interface ArticleDomainDef {
  id: string;
  name: { en: string; zh: string };
  desc: { en: string; zh: string };
}

const ARTICLE_DOMAIN_DEFS: ArticleDomainDef[] = [
  {
    id: "ai-tech",
    name: { en: "AI & Tech", zh: "AI 与科技" },
    desc: {
      en: "LLMs, products, tools, startups, and technology trends",
      zh: "大模型、产品、工具、创业与技术趋势",
    },
  },
  {
    id: "business",
    name: { en: "Business & Finance", zh: "商业与财经" },
    desc: {
      en: "Companies, industries, consumption, investing, and business models",
      zh: "公司、行业、消费、投资与商业模式",
    },
  },
  {
    id: "workplace",
    name: { en: "Work & Growth", zh: "职场与成长" },
    desc: {
      en: "Productivity, management, communication, career choices, and self-growth",
      zh: "效率、管理、沟通、职业选择与个人成长",
    },
  },
  {
    id: "education",
    name: { en: "Education & Learning", zh: "教育与学习" },
    desc: {
      en: "Learning methods, parenting, schooling, and knowledge services",
      zh: "学习方法、家庭教育、升学、知识服务",
    },
  },
  {
    id: "health-life",
    name: { en: "Health & Lifestyle", zh: "健康与生活方式" },
    desc: {
      en: "Body and mind, daily habits, city life, and consumer choices",
      zh: "身心健康、日常习惯、城市生活与消费选择",
    },
  },
  {
    id: "culture",
    name: { en: "Culture & Books", zh: "文化与读书" },
    desc: {
      en: "Books and film, history, people, aesthetics, and public expression",
      zh: "书影、历史、人物、审美和公共表达",
    },
  },
  {
    id: "society",
    name: { en: "Society", zh: "社会观察" },
    desc: {
      en: "Trending events, public issues, demographic shifts, and urban topics",
      zh: "热点事件、公共议题、人群变化和城市议题",
    },
  },
  {
    id: "personal-brand",
    name: { en: "Personal Brand & Creators", zh: "个人品牌与自媒体" },
    desc: {
      en: "Content operations, IP, newsletters, communities, and monetization",
      zh: "内容运营、IP、公众号、社群和变现",
    },
  },
];

const CUSTOM_DOMAIN_DESC = { en: "User-defined domain", zh: "用户自定义领域" };

/**
 * List the supported article domains, localized.
 *
 * @param lang Target language.
 * @returns The domains for that language.
 */
export function getArticleDomains(lang: Lang): ArticleDomain[] {
  return ARTICLE_DOMAIN_DEFS.map((d) => ({ id: d.id, name: d.name[lang], desc: d.desc[lang] }));
}

/** Backward-compatible default (English) list. Prefer getArticleDomains(lang). */
export const ARTICLE_DOMAINS: ArticleDomain[] = getArticleDomains("en");

/**
 * Resolve a domain from an id or a custom name, falling back to the first domain.
 *
 * @param domainId A known domain id, if any.
 * @param customDomain A free-text domain name, used when no id matches.
 * @param lang Target language.
 * @returns The resolved domain.
 */
export function resolveArticleDomain(domainId?: string, customDomain?: string, lang: Lang = "en"): ArticleDomain {
  const domains = getArticleDomains(lang);
  const picked = domains.find((d) => d.id === domainId);
  if (picked) return picked;
  const name = customDomain?.trim();
  if (name) return { id: "custom", name, desc: CUSTOM_DOMAIN_DESC[lang] };
  return domains[0];
}

/**
 * Infer the best-fitting domain for a user-supplied title via the model.
 *
 * @param title The article title.
 * @param lang Target language.
 * @param ask Chat function (injectable for testing).
 * @returns The matched domain with a confidence score and reasons.
 * @throws Error if the model returns no usable match.
 */
export async function matchArticleDomainFromTitle(
  title: string,
  lang: Lang = "en",
  ask: ChatFn = chat
): Promise<ArticleDomainMatch> {
  const raw = await ask(domainMatchPrompt(title, lang), { temperature: 0 });
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "domain-match JSON object");
  const match = normalizeDomainMatch(parsed, lang);
  if (match) {
    return match;
  }

  throw new Error("The model did not return a usable domain match.");
}

/**
 * Generate topic options for a domain.
 *
 * Accepts either a {@link GenerateTopicOptionsInput} object or the legacy
 * `(domain, n)` positional form. The chat function is injectable for testing.
 *
 * @returns Up to `n` normalized topic options.
 * @throws Error if the model returns no usable topics.
 */
export async function generateTopicOptions(
  input: GenerateTopicOptionsInput,
  ask?: ChatFn
): Promise<TopicOption[]>;
export async function generateTopicOptions(
  domain: ArticleDomain,
  n?: number,
  ask?: ChatFn
): Promise<TopicOption[]>;
export async function generateTopicOptions(
  inputOrDomain: GenerateTopicOptionsInput | ArticleDomain,
  nOrAsk: number | ChatFn = 6,
  maybeAsk: ChatFn = chat
): Promise<TopicOption[]> {
  const options =
    "domain" in inputOrDomain
      ? inputOrDomain
      : {
          domain: inputOrDomain,
          n: typeof nOrAsk === "number" ? nOrAsk : 6,
        };
  const ask = typeof nOrAsk === "function" ? nOrAsk : maybeAsk;
  const n = options.n ?? 6;
  const lang: Lang = "lang" in options && options.lang ? options.lang : "en";
  const raw = await ask(
    articleTopicsPrompt(options.domain.name, options.domain.desc, n, options.researchContext, lang),
    { temperature: 0.85 }
  );
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "topics JSON array");
  const topicItems = topicArray(parsed);
  if (!topicItems) {
    throw new Error("The model did not return usable topics; please retry.");
  }
  const topics = topicItems
    .map((item, index) => normalizeTopic(item, index, lang))
    .filter((item): item is TopicOption => Boolean(item))
    .slice(0, n);
  if (topics.length === 0) {
    throw new Error("The model did not return usable topics; please retry.");
  }
  return topics;
}

/**
 * Acceptance bands per length tier, wider than the prompt's ideal range so we
 * only trigger a corrective pass on clear misses. zh counts characters, en words.
 */
const LENGTH_BANDS: Record<Lang, Record<NonNullable<GenerateArticleInput["targetLength"]>, { min: number; max: number }>> = {
  zh: {
    short: { min: 380, max: 800 },
    medium: { min: 850, max: 1600 },
    long: { min: 2600, max: 4600 },
  },
  en: {
    short: { min: 250, max: 650 },
    medium: { min: 700, max: 1400 },
    long: { min: 1800, max: 3400 },
  },
};

/**
 * Output caps per length tier. Without an explicit cap the provider default
 * (often ~4k tokens) silently truncates long drafts, and the JSON-repair pass
 * then "recovers" a much shorter article.
 */
const DRAFT_MAX_TOKENS: Record<NonNullable<GenerateArticleInput["targetLength"]>, number> = {
  short: 2500,
  medium: 5000,
  long: 8192,
};

/** How many corrective passes to attempt when a draft misses its length band. */
const MAX_LENGTH_FIX_PASSES = 2;

/** Measure article body length: characters for zh, whitespace-separated words for en. */
export function articleBodyLength(article: GeneratedArticle, lang: Lang): number {
  const text = [article.title, ...article.paragraphs].join("\n");
  if (lang === "zh") {
    return text.replace(/\s+/g, "").length;
  }
  return text.trim().match(/\S+/g)?.length ?? 0;
}

/** Distance from a length to a band; 0 when inside the band. */
function distanceToBand(length: number, band: { min: number; max: number }): number {
  if (length < band.min) return band.min - length;
  if (length > band.max) return length - band.max;
  return 0;
}

/**
 * Generate a full article draft (title + paragraphs) from a topic.
 *
 * The draft is checked against the target-length band; on a clear miss the
 * model is asked to expand/condense its own draft (up to two passes), and a
 * pass is kept only when it moves the length toward the band.
 *
 * @param input Domain, topic, style, length, research context, and language.
 * @param ask Chat function (injectable for testing).
 * @returns The parsed article.
 * @throws Error if the model returns no usable article JSON.
 */
export async function generateArticleDraft(
  input: GenerateArticleInput,
  ask: ChatFn = chat
): Promise<GeneratedArticle> {
  const lang: Lang = input.lang ?? "en";
  const targetLength = input.targetLength ?? "medium";
  const maxTokens = DRAFT_MAX_TOKENS[targetLength];
  const raw = await ask(articleDraftPrompt(input), { temperature: 0.72, maxTokens });
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "article JSON object");
  let article = normalizeArticle(parsed);
  if (!article) {
    throw new Error("The model did not return a usable article JSON.");
  }

  const band = LENGTH_BANDS[lang][targetLength];
  for (let pass = 0; pass < MAX_LENGTH_FIX_PASSES; pass += 1) {
    const length = articleBodyLength(article, lang);
    const miss = distanceToBand(length, band);
    if (miss === 0) break;
    const fixedRaw = await ask(articleLengthFixPrompt(article, input, length, band), {
      temperature: 0.72,
      maxTokens,
    });
    const fixed = normalizeArticle(await parseJsonWithRepair<unknown>(fixedRaw, ask, "article JSON object"));
    if (!fixed) break;
    // 只在更接近目标区间时采用；否则保留上一版，避免越改越糟
    if (distanceToBand(articleBodyLength(fixed, lang), band) >= miss) break;
    article = fixed;
  }
  return article;
}

/**
 * Flatten an article to plain `{kind, text}` paragraphs (drops figures/tables).
 *
 * @param article The generated article.
 * @returns Paragraph blocks only.
 */
export function articleToDocParagraphs(article: GeneratedArticle): { kind: ParaKind; text: string }[] {
  return articleToDocBlocks(article)
    .filter((block): block is Extract<DocxBlock, { type: "paragraph" }> => block.type === "paragraph")
    .map(({ kind, text }) => ({ kind, text }));
}

/**
 * Spread body figures roughly evenly through the body paragraphs.
 *
 * @param figures Figures to place after body paragraphs.
 * @param paragraphCount Number of body paragraphs available.
 * @returns Map from body-paragraph index → figures to insert after it.
 */
function spreadFigures(figures: ArticleFigure[], paragraphCount: number): Map<number, ArticleFigure[]> {
  const placement = new Map<number, ArticleFigure[]>();
  if (figures.length === 0 || paragraphCount === 0) {
    return placement;
  }

  const unanchored: ArticleFigure[] = [];
  for (const figure of figures) {
    if (typeof figure.afterParagraphIndex === "number") {
      const after = Math.min(paragraphCount - 1, Math.max(0, figure.afterParagraphIndex - 1));
      const list = placement.get(after) ?? [];
      list.push(figure);
      placement.set(after, list);
    } else {
      unanchored.push(figure);
    }
  }

  const step = paragraphCount / unanchored.length;
  unanchored.forEach((figure, i) => {
    const after = Math.min(paragraphCount - 1, Math.max(0, Math.floor(step * (i + 1)) - 1));
    const list = placement.get(after) ?? [];
    list.push(figure);
    placement.set(after, list);
  });
  return placement;
}

/**
 * Lay out an article as ordered docx blocks: title, lead figure, body (with
 * interspersed figures), and references.
 *
 * @param article The generated (enriched) article.
 * @param lang Target language for section labels.
 * @returns Ordered docx blocks ready for {@link ./docx.ts}.
 */
export function articleToDocBlocks(article: GeneratedArticle, lang: Lang = "en"): DocxBlock[] {
  const blocks: DocxBlock[] = [
    { type: "paragraph", kind: "heading1", text: article.title },
  ];

  const firstParagraph = article.paragraphs[0];
  if (firstParagraph) {
    blocks.push({ type: "paragraph", kind: "normal", text: firstParagraph });
  }

  if (article.figure) {
    blocks.push({ type: "figure", ...article.figure });
  }

  const bodyParagraphs = article.paragraphs.slice(1);
  const bodyFigures = article.bodyFigures ?? [];
  const figuresAfter = spreadFigures(bodyFigures, bodyParagraphs.length);
  if (bodyParagraphs.length === 0) {
    for (const figure of bodyFigures) blocks.push({ type: "figure", ...figure });
  } else {
    bodyParagraphs.forEach((text, i) => {
      blocks.push({ type: "paragraph", kind: "normal", text });
      for (const figure of figuresAfter.get(i) ?? []) blocks.push({ type: "figure", ...figure });
    });
  }

  if (article.references && article.references.length > 0) {
    blocks.push({ type: "paragraph", kind: "heading2", text: tr(ARTICLE_LABELS.references, lang) });
    blocks.push(
      ...article.references.map((reference) => ({
        type: "paragraph" as const,
        kind: "normal" as const,
        text: reference.text,
      }))
    );
  }

  return blocks;
}

/**
 * Lay out an article as render blocks for the web editor.
 *
 * Mirrors {@link articleToDocBlocks}, but threads each body paragraph's stored
 * index so the editor can map sentences back to the document.
 *
 * @param article The generated (enriched) article.
 * @param paragraphs Parsed paragraphs (to recover indices by text match).
 * @param lang Target language for section labels.
 * @returns Ordered render blocks.
 */
export function articleToRenderBlocks(
  article: GeneratedArticle,
  paragraphs: { index: number; text: string }[] = [],
  lang: Lang = "en"
): ArticleRenderBlock[] {
  let cursor = 0;
  const takeParagraphIndex = (text: string): number | undefined => {
    for (let i = cursor; i < paragraphs.length; i += 1) {
      if (paragraphs[i].text === text) {
        cursor = i + 1;
        return paragraphs[i].index;
      }
    }
    return undefined;
  };

  const blocks: ArticleRenderBlock[] = [
    { type: "paragraph", kind: "heading1", text: article.title, paragraphIndex: takeParagraphIndex(article.title) },
  ];

  const firstParagraph = article.paragraphs[0];
  if (firstParagraph) {
    blocks.push({ type: "paragraph", kind: "normal", text: firstParagraph, paragraphIndex: takeParagraphIndex(firstParagraph) });
  }

  if (article.figure) {
    // 前端有 imageUrl 时直接用原图；不必把（可能内嵌了 base64 图片的）大 SVG 发给浏览器
    blocks.push({ type: "figure", ...article.figure, svg: article.figure.imageUrl ? "" : article.figure.svg });
  }

  const bodyParagraphs = article.paragraphs.slice(1);
  const bodyFigures = article.bodyFigures ?? [];
  const figuresAfter = spreadFigures(bodyFigures, bodyParagraphs.length);
  const pushFigure = (figure: ArticleFigure) =>
    // 前端有 imageUrl 时直接用原图；不必把（可能内嵌了 base64 图片的）大 SVG 发给浏览器
    blocks.push({ type: "figure", ...figure, svg: figure.imageUrl ? "" : figure.svg });
  if (bodyParagraphs.length === 0) {
    for (const figure of bodyFigures) pushFigure(figure);
  } else {
    bodyParagraphs.forEach((paragraph, i) => {
      blocks.push({ type: "paragraph", kind: "normal", text: paragraph, paragraphIndex: takeParagraphIndex(paragraph) });
      for (const figure of figuresAfter.get(i) ?? []) pushFigure(figure);
    });
  }

  if (article.references && article.references.length > 0) {
    blocks.push({
      type: "references",
      title: tr(ARTICLE_LABELS.references, lang),
      items: article.references.map((reference) => reference.text),
    });
  }

  return blocks;
}

/**
 * Attach references, relevant source images, and inline citations to an article.
 *
 * @param article The drafted article.
 * @param items Research items gathered for the topic.
 * @param accessedAt Access timestamp for the reference list.
 * @param lang Target language.
 * @returns A new article enriched with sourcing.
 */
export async function enrichArticleWithResearch(
  article: GeneratedArticle,
  items: ResearchItem[],
  accessedAt = new Date(),
  lang: Lang = "en"
): Promise<GeneratedArticle> {
  const evidenceItems = items.slice(0, 8);
  const references = formatReferences(evidenceItems, accessedAt);
  // 配图从全部资料里选（图注自带来源名和链接），不受参考文献前 8 条的限制
  const { lead, body } = await buildArticleFigures(article, items, lang);
  return {
    ...article,
    paragraphs: enforceInlineCitations(article.paragraphs, references.length),
    references,
    figure: lead,
    bodyFigures: body,
  };
}

/** Validate and normalize one raw topic object; returns null if it lacks a title. */
function normalizeTopic(item: unknown, index: number, lang: Lang = "en"): TopicOption | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const title = stringField(obj.title);
  if (!title) return null;
  const angle =
    stringField(obj.angle) || (lang === "zh" ? "从一个具体切口展开" : "develop from a specific angle");
  const audience = stringField(obj.audience) || tr(ARTICLE_LABELS.defaultAudience, lang);
  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];
  return {
    id: `topic-${index + 1}-${slug(title)}`,
    title,
    angle,
    audience,
    keywords,
  };
}

/** Extract a topics array from either a bare array or a `{topics|options|items}` wrapper. */
function topicArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;
  for (const key of ["topics", "options", "items"]) {
    if (Array.isArray(obj[key])) {
      return obj[key];
    }
  }

  return null;
}

/** Validate a raw article object; returns null without a title and ≥1 paragraph. */
function normalizeArticle(item: unknown): GeneratedArticle | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const title = stringField(obj.title);
  const paragraphs = Array.isArray(obj.paragraphs)
    ? obj.paragraphs
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];
  if (!title || paragraphs.length === 0) return null;
  return { title, paragraphs };
}

/** Validate a raw domain-match object; returns null if the domainId is unknown. */
function normalizeDomainMatch(item: unknown, lang: Lang = "en"): ArticleDomainMatch | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const domainId = stringField(obj.domainId);
  const domain = getArticleDomains(lang).find((entry) => entry.id === domainId);
  if (!domain) return null;
  const confidence = typeof obj.confidence === "number" ? obj.confidence : Number(obj.confidence);
  const score = Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 70;
  const reasons = Array.isArray(obj.reasons)
    ? obj.reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
    : [];
  return {
    domain,
    score,
    reasons: reasons.slice(0, 5),
  };
}

/** Build the prompt asking the model to classify a title into one domain. */
function domainMatchPrompt(title: string, lang: Lang = "en"): string {
  const domains = getArticleDomains(lang).map((domain) => ({
    id: domain.id,
    name: domain.name,
    desc: domain.desc,
  }));

  if (lang === "zh") {
    return `你要根据用户输入的文章标题，判断最适合的文章领域。

可选领域：
${JSON.stringify(domains, null, 2)}

用户标题：
${title}

判断要求：
1. 必须只从可选领域中选择一个 domainId。
2. 根据标题语义判断，不要只看单个关键词。
3. 如果标题跨领域，选择最能决定文章论证材料来源的领域。
4. 输出 2-4 条简短 reasons，说明为什么匹配这个领域。

严格只输出 JSON 对象：
{"domainId":"ai-tech","confidence":88,"reasons":["原因1","原因2"]}`;
  }

  return `Pick the best-fitting article domain for the user's title.

Available domains:
${JSON.stringify(domains, null, 2)}

User title:
${title}

Rules:
1. Choose exactly one domainId from the available domains.
2. Judge by the meaning of the title, not a single keyword.
3. If the title spans domains, pick the one that most determines where the article's evidence comes from.
4. Output 2-4 short reasons explaining the match.

Output strictly a JSON object:
{"domainId":"ai-tech","confidence":88,"reasons":["reason 1","reason 2"]}`;
}

/**
 * Keep only inline citations that point at a real reference.
 *
 * 不再给没有引用的段落补造编号（那会伪造出处）；只把指向不存在参考文献的
 * `[n]` 标记清掉，段落有没有引用完全由模型是否真的引用了资料决定。
 */
function enforceInlineCitations(paragraphs: string[], referenceCount: number): string[] {
  return paragraphs.map((paragraph) =>
    paragraph
      .replace(/\[(\d+)\]/g, (marker, n: string) => {
        const id = Number(n);
        return id >= 1 && id <= referenceCount ? marker : "";
      })
      .replace(/ {2,}/g, " ")
      .trimEnd()
  );
}

/** How many extra source images (beyond the lead) to spread through the body. */
const MAX_BODY_IMAGES = 3;
const MIN_IMAGE_RELEVANCE_SCORE = 3;
/** Target minimum images per article; weak-but-related matches backfill up to this. */
const MIN_TOTAL_IMAGES = 3;

interface RankedSourceImage {
  item: ResearchItem;
  score: number;
  paragraphIndex: number;
}

/**
 * Build the lead figure plus any in-body figures.
 *
 * Only source images with enough text-signal overlap are used. The image is
 * placed after the paragraph it best matches; unrelated images are omitted.
 */
async function buildArticleFigures(
  article: GeneratedArticle,
  items: ResearchItem[],
  lang: Lang = "en"
): Promise<{ lead?: ArticleFigure; body: ArticleFigure[] }> {
  const ranked = rankSourceImages(article, items);
  if (ranked.length === 0) {
    return { body: [] };
  }

  let figNo = 0;
  const leadMatch = ranked.find((entry) => entry.paragraphIndex === 0);
  const bodyMatches = ranked
    .filter((entry) => entry !== leadMatch)
    .slice(0, leadMatch ? MAX_BODY_IMAGES : MAX_BODY_IMAGES + 1);
  const lead = leadMatch ? await buildSourceImageFigure(leadMatch.item, ++figNo, lang, 0) : undefined;
  const body: ArticleFigure[] = [];
  for (const match of bodyMatches) {
    figNo += 1;
    body.push(await buildSourceImageFigure(match.item, figNo, lang, match.paragraphIndex));
  }
  return { lead, body };
}

/** Localized figure number prefix, e.g. "图2" / "Figure 2.". */
function figureLabel(n: number, lang: Lang): string {
  return lang === "zh" ? `图${n}` : `Figure ${n}.`;
}

/** Build a figure card for one retrieved source image. */
async function buildSourceImageFigure(
  item: ResearchItem,
  n: number,
  lang: Lang,
  afterParagraphIndex: number
): Promise<ArticleFigure> {
  const prefix = figureLabel(n, lang);
  const caption =
    lang === "zh"
      ? `${prefix} 图片来源：${item.sourceName}，《${item.title}》，${item.url}`
      : `${prefix} Image source: ${item.sourceName}, "${item.title}", ${item.url}`;
  // Word 不会加载 SVG 里的外链图片，这里抓下来内嵌成 data URI；抓取失败则出灰色占位
  const dataUri = await fetchImageDataUri(item.imageUrl ?? "");
  return {
    title: `${prefix} ${tr(ARTICLE_LABELS.figureSourceWord, lang)}`,
    caption,
    imageUrl: item.imageUrl,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    afterParagraphIndex,
    svg: sourceImageSvg(item, dataUri),
  };
}

/**
 * Rank source images best-match-first for the article; empty when none are relevant.
 *
 * Strong matches (score ≥ {@link MIN_IMAGE_RELEVANCE_SCORE}) come first; when
 * they are scarce, weaker-but-related matches (score > 0) backfill up to
 * {@link MIN_TOTAL_IMAGES} so articles are not stuck with a single image.
 * Zero-overlap images are never used.
 */
function rankSourceImages(article: GeneratedArticle, items: ResearchItem[]): RankedSourceImage[] {
  const candidates = items.filter((item) => item.imageUrl);
  if (candidates.length === 0) {
    return [];
  }

  const paragraphs = article.paragraphs.length > 0 ? article.paragraphs : [article.title];

  const scored = candidates
    .map((item) => {
      let best = { score: 0, paragraphIndex: 0 };
      paragraphs.forEach((paragraph, paragraphIndex) => {
        const score = imageRelevanceScore([article.title, paragraph].join(" "), item);
        if (score > best.score) {
          best = { score, paragraphIndex };
        }
      });
      return { item, ...best };
    })
    .sort((a, b) => b.score - a.score);

  const strong = scored.filter((entry) => entry.score >= MIN_IMAGE_RELEVANCE_SCORE);
  const weak = scored.filter((entry) => entry.score > 0 && entry.score < MIN_IMAGE_RELEVANCE_SCORE);
  return strong
    .concat(weak.slice(0, Math.max(0, MIN_TOTAL_IMAGES - strong.length)))
    .slice(0, MAX_BODY_IMAGES + 1);
}

function imageRelevanceScore(targetText: string, item: ResearchItem): number {
  const targetTokens = tokenizeForImageMatch(targetText);
  if (targetTokens.size === 0) return 0;

  const sourceTokens = tokenizeForImageMatch([item.title, item.summary, item.sourceName, item.query].join(" "));
  const titleTokens = tokenizeForImageMatch(item.title);
  if (sourceTokens.size === 0 && titleTokens.size === 0) return 0;

  const overlap = countOverlap(sourceTokens, targetTokens);
  const titleOverlap = countOverlap(titleTokens, targetTokens);
  const coverage = sourceTokens.size > 0 ? overlap / Math.min(sourceTokens.size, targetTokens.size) : 0;
  return overlap + titleOverlap * 1.5 + coverage * 2;
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const token of a) {
    if (b.has(token)) n += 1;
  }
  return n;
}

function tokenizeForImageMatch(text: string): Set<string> {
  const normalized = text.toLowerCase();
  const words: string[] = normalized.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  for (const segment of normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    for (let i = 0; i < segment.length - 1; i += 1) {
      words.push(segment.slice(i, i + 2));
    }
    for (let i = 0; i < segment.length - 2; i += 1) {
      words.push(segment.slice(i, i + 3));
    }
  }
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "are",
    "was",
    "were",
    "will",
    "about",
    "into",
    "after",
    "before",
    "\u5982\u4f55",
    "\u4e00\u4e2a",
    "\u6211\u4eec",
    "\u4ed6\u4eec",
    "\u8fd9\u4e9b",
    "\u90a3\u4e9b",
    "\u53ef\u4ee5",
    "\u6b63\u5728",
    "\u5df2\u7ecf",
    "\u56e0\u4e3a",
    "\u4f46\u662f",
  ]);
  return new Set(words.filter((word) => !stop.has(word)));
}

/** Cap for inlined source images; larger downloads fall back to the placeholder. */
const IMAGE_INLINE_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Download an image and return it as a `data:` URI for embedding inside SVG.
 *
 * @returns The data URI, or "" on timeout/oversize/non-image responses.
 */
async function fetchImageDataUri(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) return "";
      const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      if (!type.startsWith("image/") || type === "image/svg+xml") return "";
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > IMAGE_INLINE_MAX_BYTES) return "";
      return `data:${type};base64,${bytes.toString("base64")}`;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}

/** Render an SVG card embedding a source image (inlined data URI) with its name and title. */
function sourceImageSvg(item: ResearchItem, dataUri = ""): string {
  const width = 760;
  const height = 360;
  const imageArea = dataUri
    ? `<image href="${dataUri}" x="24" y="24" width="712" height="246" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="24" y="24" width="712" height="246" rx="10" fill="#e2e8f0"/>
    <text x="380" y="152" font-size="15" fill="#64748b" text-anchor="middle">${escapeSvg(
      truncate(item.url ?? "", 64)
    )}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="18" fill="#f8fafc"/>
    ${imageArea}
    <rect x="24" y="284" width="712" height="52" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="42" y="314" font-size="16" font-weight="700" fill="#0f172a">${escapeSvg(truncate(item.sourceName, 28))}</text>
    <text x="172" y="314" font-size="15" fill="#334155">${escapeSvg(truncate(item.title, 72))}</text>
  </svg>`;
}

/** Format research items into numbered, APA-ish reference strings. */
function formatReferences(items: ResearchItem[], accessedAt: Date): ArticleReference[] {
  const accessed = accessedAt.toISOString().slice(0, 10);
  return items.map((item, index) => {
    const authors = item.authors.length > 0 ? item.authors.join(", ") : item.sourceName;
    const date = shortDate(item.publishedAt) || "n.d.";
    const source = item.sourceKind === "paper" ? "arXiv" : item.sourceName;
    return {
      id: index + 1,
      text: `[${index + 1}] ${authors}. (${date}). ${item.title}. ${source}. ${item.url}. Accessed ${accessed}.`,
    };
  });
}
