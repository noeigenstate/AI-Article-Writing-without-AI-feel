import { chat, type ChatOptions } from "./llm.js";
import type { DocxBlock, ParaKind } from "./docx.js";
import type { ResearchItem } from "./research/types.js";
import { articleDraftPrompt, articleTopicsPrompt } from "../prompts/article.prompts.js";
import { escapeSvg, shortDate, slug, stringField, truncate } from "../lib/text.js";
import { parseJsonWithRepair } from "../lib/json.js";
import {
  ARTICLE_LABELS,
  CHAIN_NODE_LABELS,
  EVIDENCE_TABLE_COLUMNS,
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
  evidenceTable?: ArticleTable;
  figure?: ArticleFigure;
}

export interface ArticleReference {
  id: number;
  text: string;
}

export interface ArticleTable {
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
}

export interface ArticleFigure {
  title: string;
  caption: string;
  svg: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
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
 * Generate a full article draft (title + paragraphs) from a topic.
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
  const raw = await ask(articleDraftPrompt(input), { temperature: 0.72 });
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "article JSON object");
  const article = normalizeArticle(parsed);
  if (!article) {
    throw new Error("The model did not return a usable article JSON.");
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
 * Lay out an article as ordered docx blocks: title, lead, figure, body, table, refs.
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

  blocks.push(
    ...article.paragraphs.slice(1).map((text) => ({ type: "paragraph" as const, kind: "normal" as const, text }))
  );

  if (article.evidenceTable) {
    blocks.push({ type: "table", ...article.evidenceTable });
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
    blocks.push({ type: "figure", ...article.figure });
  }

  for (const paragraph of article.paragraphs.slice(1)) {
    blocks.push({ type: "paragraph", kind: "normal", text: paragraph, paragraphIndex: takeParagraphIndex(paragraph) });
  }

  if (article.evidenceTable) {
    blocks.push({ type: "table", ...article.evidenceTable });
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
 * Attach references, an evidence table, a figure, and inline citations to an article.
 *
 * @param article The drafted article.
 * @param items Research items gathered for the topic.
 * @param accessedAt Access timestamp for the reference list.
 * @param lang Target language.
 * @returns A new article enriched with sourcing.
 */
export function enrichArticleWithResearch(
  article: GeneratedArticle,
  items: ResearchItem[],
  accessedAt = new Date(),
  lang: Lang = "en"
): GeneratedArticle {
  const evidenceItems = items.slice(0, 8);
  const references = formatReferences(evidenceItems, accessedAt);
  return {
    ...article,
    paragraphs: enforceInlineCitations(article.paragraphs, references.length),
    references,
    evidenceTable: buildEvidenceTable(evidenceItems, lang),
    figure: buildEvidenceFigure(article, evidenceItems, lang),
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

/** Ensure each paragraph ends with a `[n]` citation, cycling through available refs. */
function enforceInlineCitations(paragraphs: string[], referenceCount: number): string[] {
  if (referenceCount === 0) {
    return paragraphs;
  }

  return paragraphs.map((paragraph, index) => {
    if (/\[\d+\]/.test(paragraph)) {
      return paragraph;
    }
    const citation = `[${(index % Math.min(referenceCount, 4)) + 1}]`;
    return `${paragraph} ${citation}`;
  });
}

/** Build the "key evidence" table (up to 6 rows) from research items. */
function buildEvidenceTable(items: ResearchItem[], lang: Lang = "en"): ArticleTable {
  const rows = items.slice(0, 6).map((item, index) => [
    `[${index + 1}]`,
    item.sourceKind === "paper" ? tr(ARTICLE_LABELS.typePaper, lang) : tr(ARTICLE_LABELS.typeNews, lang),
    item.sourceName,
    shortDate(item.publishedAt),
    truncate(item.summary || item.title, 90),
  ]);

  return {
    title: tr(ARTICLE_LABELS.evidenceTableTitle, lang),
    columns: EVIDENCE_TABLE_COLUMNS[lang],
    rows: rows.length > 0 ? rows : [["-", "-", "-", "-", tr(ARTICLE_LABELS.evidenceTableEmpty, lang)]],
    note: tr(ARTICLE_LABELS.evidenceTableNote, lang),
  };
}

/** Build the lead figure: a real source image when available, else an evidence-chain diagram. */
function buildEvidenceFigure(article: GeneratedArticle, items: ResearchItem[], lang: Lang = "en"): ArticleFigure {
  const sourceImage = items.find((item) => item.imageUrl);
  if (sourceImage?.imageUrl) {
    const caption =
      lang === "zh"
        ? `图1 图片来源：${sourceImage.sourceName}，《${sourceImage.title}》，${sourceImage.url}`
        : `Figure 1. Image source: ${sourceImage.sourceName}, "${sourceImage.title}", ${sourceImage.url}`;
    return {
      title: tr(ARTICLE_LABELS.figureSourceTitle, lang),
      caption,
      imageUrl: sourceImage.imageUrl,
      sourceName: sourceImage.sourceName,
      sourceUrl: sourceImage.url,
      svg: sourceImageSvg(sourceImage),
    };
  }

  const nodes = [
    { label: tr(CHAIN_NODE_LABELS.problem, lang), text: truncate(article.title, 34) },
    {
      label: tr(CHAIN_NODE_LABELS.evidence, lang),
      text: items[0] ? `[1] ${truncate(items[0].title, 40)}` : tr(ARTICLE_LABELS.noLiveSource, lang),
    },
    {
      label: tr(CHAIN_NODE_LABELS.crossCheck, lang),
      text: items[1] ? `[2] ${truncate(items[1].title, 40)}` : tr(ARTICLE_LABELS.needSecondSource, lang),
    },
    { label: tr(CHAIN_NODE_LABELS.judgment, lang), text: tr(ARTICLE_LABELS.conclusionNode, lang) },
  ];

  return {
    title: tr(ARTICLE_LABELS.figureChainTitle, lang),
    caption: tr(ARTICLE_LABELS.figureChainCaption, lang),
    svg: evidenceSvg(nodes),
  };
}

/** Render an SVG card embedding a source image with its name and title. */
function sourceImageSvg(item: ResearchItem): string {
  const width = 760;
  const height = 360;
  const image = item.imageUrl ? escapeSvg(item.imageUrl) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="18" fill="#f8fafc"/>
    <image href="${image}" x="24" y="24" width="712" height="246" preserveAspectRatio="xMidYMid slice"/>
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

/** Render the four-node "evidence chain" diagram as an SVG string. */
function evidenceSvg(nodes: { label: string; text: string }[]): string {
  const width = 760;
  const height = 300;
  const boxes = nodes
    .map((node, index) => {
      const x = 30 + index * 180;
      const line1 = truncate(node.text, 19);
      const line2 = node.text.length > 19 ? truncate(node.text.slice(19), 18) : "";
      const arrow =
        index < nodes.length - 1
          ? `<path d="M${x + 150} 150 L${x + 172} 150" stroke="#94a3b8" stroke-width="3" marker-end="url(#arrow)"/>`
          : "";
      return `<g>
        <rect x="${x}" y="84" width="150" height="132" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
        <text x="${x + 75}" y="116" text-anchor="middle" font-size="18" font-weight="700" fill="#4f46e5">${escapeSvg(node.label)}</text>
        <text x="${x + 16}" y="154" font-size="14" fill="#334155">${escapeSvg(line1)}</text>
        <text x="${x + 16}" y="178" font-size="14" fill="#334155">${escapeSvg(line2)}</text>
      </g>${arrow}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8"/>
      </marker>
    </defs>
    <rect width="${width}" height="${height}" rx="18" fill="#f8fafc"/>
    <text x="30" y="42" font-size="22" font-weight="700" fill="#0f172a">Evidence chain</text>
    ${boxes}
  </svg>`;
}

