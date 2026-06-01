import { chat, type ChatOptions } from "./llm.js";
import type { DocxBlock, ParaKind } from "./docx.js";
import type { ResearchItem } from "./research/types.js";
import { articleDraftPrompt, articleTopicsPrompt } from "../prompts.js";

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
}

export interface GenerateArticleInput {
  domainName: string;
  topic: TopicOption | string;
  styleSummary?: string;
  targetLength?: "short" | "medium" | "long";
  researchContext?: string;
}

type ChatFn = (prompt: string, opts?: ChatOptions) => Promise<string>;

export const ARTICLE_DOMAINS: ArticleDomain[] = [
  { id: "ai-tech", name: "AI 与科技", desc: "大模型、产品、工具、创业与技术趋势" },
  { id: "business", name: "商业与财经", desc: "公司、行业、消费、投资与商业模式" },
  { id: "workplace", name: "职场与成长", desc: "效率、管理、沟通、职业选择与个人成长" },
  { id: "education", name: "教育与学习", desc: "学习方法、家庭教育、升学、知识服务" },
  { id: "health-life", name: "健康与生活方式", desc: "身心健康、日常习惯、城市生活与消费选择" },
  { id: "culture", name: "文化与读书", desc: "书影、历史、人物、审美和公共表达" },
  { id: "society", name: "社会观察", desc: "热点事件、公共议题、人群变化和城市议题" },
  { id: "personal-brand", name: "个人品牌与自媒体", desc: "内容运营、IP、公众号、社群和变现" },
];

export function resolveArticleDomain(domainId?: string, customDomain?: string): ArticleDomain {
  const picked = ARTICLE_DOMAINS.find((d) => d.id === domainId);
  if (picked) return picked;
  const name = customDomain?.trim();
  if (name) return { id: "custom", name, desc: "用户自定义领域" };
  return ARTICLE_DOMAINS[0];
}

export async function matchArticleDomainFromTitle(title: string, ask: ChatFn = chat): Promise<ArticleDomainMatch> {
  const raw = await ask(domainMatchPrompt(title), { temperature: 0 });
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "领域匹配 JSON 对象");
  const match = normalizeDomainMatch(parsed);
  if (match) {
    return match;
  }

  throw new Error("模型没有返回可用的领域匹配结果");
}

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
  const raw = await ask(
    articleTopicsPrompt(options.domain.name, options.domain.desc, n, options.researchContext),
    { temperature: 0.85 }
  );
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "选题 JSON 数组");
  const topicItems = topicArray(parsed);
  if (!topicItems) {
    throw new Error("模型没有返回可用选题，请重试");
  }
  const topics = topicItems
    .map((item, index) => normalizeTopic(item, index))
    .filter((item): item is TopicOption => Boolean(item))
    .slice(0, n);
  if (topics.length === 0) {
    throw new Error("模型没有返回可用选题，请重试");
  }
  return topics;
}

export async function generateArticleDraft(
  input: GenerateArticleInput,
  ask: ChatFn = chat
): Promise<GeneratedArticle> {
  const raw = await ask(articleDraftPrompt(input), { temperature: 0.72 });
  const parsed = await parseJsonWithRepair<unknown>(raw, ask, "文章 JSON 对象");
  const article = normalizeArticle(parsed);
  if (!article) {
    throw new Error("模型没有返回可用的文章 JSON");
  }
  return article;
}

export function articleToDocParagraphs(article: GeneratedArticle): { kind: ParaKind; text: string }[] {
  return articleToDocBlocks(article)
    .filter((block): block is Extract<DocxBlock, { type: "paragraph" }> => block.type === "paragraph")
    .map(({ kind, text }) => ({ kind, text }));
}

export function articleToDocBlocks(article: GeneratedArticle): DocxBlock[] {
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
    blocks.push({ type: "paragraph", kind: "heading2", text: "参考文献" });
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

export function articleToRenderBlocks(
  article: GeneratedArticle,
  paragraphs: { index: number; text: string }[] = []
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
    blocks.push({ type: "references", title: "参考文献", items: article.references.map((reference) => reference.text) });
  }

  return blocks;
}

export function enrichArticleWithResearch(
  article: GeneratedArticle,
  items: ResearchItem[],
  accessedAt = new Date()
): GeneratedArticle {
  const evidenceItems = items.slice(0, 8);
  const references = formatReferences(evidenceItems, accessedAt);
  return {
    ...article,
    paragraphs: enforceInlineCitations(article.paragraphs, references.length),
    references,
    evidenceTable: buildEvidenceTable(evidenceItems),
    figure: buildEvidenceFigure(article, evidenceItems),
  };
}

function normalizeTopic(item: unknown, index: number): TopicOption | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const title = stringField(obj.title);
  if (!title) return null;
  const angle = stringField(obj.angle) || "从一个具体切口展开";
  const audience = stringField(obj.audience) || "公众号读者";
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

function normalizeDomainMatch(item: unknown): ArticleDomainMatch | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const domainId = stringField(obj.domainId);
  const domain = ARTICLE_DOMAINS.find((entry) => entry.id === domainId);
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

function domainMatchPrompt(title: string): string {
  const domains = ARTICLE_DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    desc: domain.desc,
  }));

  return `你要根据用户输入的公众号文章标题，判断最适合的文章领域。

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

function buildEvidenceTable(items: ResearchItem[]): ArticleTable {
  const rows = items.slice(0, 6).map((item, index) => [
    `[${index + 1}]`,
    item.sourceKind === "paper" ? "论文" : "新闻",
    item.sourceName,
    shortDate(item.publishedAt),
    truncate(item.summary || item.title, 90),
  ]);

  return {
    title: "表1 主要证据与出处",
    columns: ["引用", "类型", "来源", "日期", "可验证论据"],
    rows: rows.length > 0 ? rows : [["-", "-", "-", "-", "本次检索没有返回可用资料，文章不得写具体数据判断。"]],
    note: "注：表中论据只来自本次检索到的公开来源；正文判断不得超出这些材料。",
  };
}

function buildEvidenceFigure(article: GeneratedArticle, items: ResearchItem[]): ArticleFigure {
  const sourceImage = items.find((item) => item.imageUrl);
  if (sourceImage?.imageUrl) {
    return {
      title: "图1 来源图片",
      caption: `图1 图片来源：${sourceImage.sourceName}，《${sourceImage.title}》，${sourceImage.url}`,
      imageUrl: sourceImage.imageUrl,
      sourceName: sourceImage.sourceName,
      sourceUrl: sourceImage.url,
      svg: sourceImageSvg(sourceImage),
    };
  }

  const nodes = [
    { label: "问题", text: truncate(article.title, 34) },
    {
      label: "证据",
      text: items[0] ? `[1] ${truncate(items[0].title, 40)}` : "无可用实时来源",
    },
    {
      label: "交叉验证",
      text: items[1] ? `[2] ${truncate(items[1].title, 40)}` : "需补充第二来源",
    },
    { label: "判断", text: "只给出材料能支撑的结论" },
  ];

  return {
    title: "图1 证据链路图",
    caption: "图1 基于检索来源形成的论证链路。每个判断必须回到对应来源，不能把推测写成事实。",
    svg: evidenceSvg(nodes),
  };
}

function sourceImageSvg(item: ResearchItem): string {
  const width = 760;
  const height = 360;
  const image = item.imageUrl ? escapeSvg(item.imageUrl) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="18" fill="#eef6ec"/>
    <image href="${image}" x="24" y="24" width="712" height="246" preserveAspectRatio="xMidYMid slice"/>
    <rect x="24" y="284" width="712" height="52" rx="10" fill="#fffdf8"/>
    <text x="42" y="314" font-size="16" font-weight="700" fill="#26342b">${escapeSvg(truncate(item.sourceName, 28))}</text>
    <text x="172" y="314" font-size="15" fill="#3d473f">${escapeSvg(truncate(item.title, 72))}</text>
  </svg>`;
}

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
          ? `<path d="M${x + 150} 150 L${x + 172} 150" stroke="#5b6f5f" stroke-width="3" marker-end="url(#arrow)"/>`
          : "";
      return `<g>
        <rect x="${x}" y="84" width="150" height="132" rx="12" fill="#fffdf8" stroke="#9fb59d" stroke-width="2"/>
        <text x="${x + 75}" y="116" text-anchor="middle" font-size="18" font-weight="700" fill="#26342b">${escapeSvg(node.label)}</text>
        <text x="${x + 16}" y="154" font-size="14" fill="#3d473f">${escapeSvg(line1)}</text>
        <text x="${x + 16}" y="178" font-size="14" fill="#3d473f">${escapeSvg(line2)}</text>
      </g>${arrow}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#5b6f5f"/>
      </marker>
    </defs>
    <rect width="${width}" height="${height}" rx="18" fill="#eef6ec"/>
    <text x="30" y="42" font-size="22" font-weight="700" fill="#26342b">Evidence chain</text>
    ${boxes}
  </svg>`;
}

function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function truncate(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slug(value: string): string {
  const cleaned = value.replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 32) || "untitled";
}

function parseJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (end >= 0) s = s.slice(0, end + 1);
  return JSON.parse(s) as T;
}

async function parseJsonWithRepair<T>(raw: string, ask: ChatFn, expected: string): Promise<T> {
  try {
    return parseJson<T>(raw);
  } catch {
    const repaired = await ask(jsonRepairPrompt(raw, expected), { temperature: 0 });
    try {
      return parseJson<T>(repaired);
    } catch {
      throw new Error(`模型返回的${expected}不是有效 JSON，请重试`);
    }
  }
}

function jsonRepairPrompt(raw: string, expected: string): string {
  return `下面是一段不合法的 JSON 输出。请只修复语法，保持原有信息，不要新增事实。
目标格式：${expected}
要求：
1. 只输出可被 JSON.parse 直接解析的 JSON。
2. 不要输出 Markdown、解释、注释或代码块。
3. 如果字段值里有换行、引号或特殊字符，请正确转义。

原始输出：
"""
${raw.slice(0, 12_000)}
"""`;
}
