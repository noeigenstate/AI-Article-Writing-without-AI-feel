export interface ParagraphDTO {
  index: number;
  kind: string;
  original: string;
  rewritten?: string;
  sentences: string[];
}

const BASE = "/api";

export interface StyleDTO {
  id: string;
  name: string;
  desc: string;
}

export interface ArticleDomainDTO {
  id: string;
  name: string;
  desc: string;
}

export interface TopicOptionDTO {
  id: string;
  title: string;
  angle: string;
  audience: string;
  keywords: string[];
}

export interface ResearchItemDTO {
  id: string;
  sourceKind: "paper" | "news";
  sourceName: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  authors: string[];
}

export interface ResearchBundleDTO {
  query: string;
  generatedAt: string;
  items: ResearchItemDTO[];
  unavailableSources: string[];
  context?: string;
}

export type TargetLength = "short" | "medium" | "long";

export type ArticleRenderBlockDTO =
  | { type: "paragraph"; kind: string; text: string; paragraphIndex?: number }
  | { type: "figure"; title: string; caption: string; svg: string; imageUrl?: string; sourceName?: string; sourceUrl?: string }
  | { type: "table"; title: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "references"; title: string; items: string[] };

export interface GeneratedArticleResponseDTO {
  docId: string;
  styleSummary: string;
  titleIndex: number;
  paragraphs: ParagraphDTO[];
  renderBlocks?: ArticleRenderBlockDTO[];
  research?: ResearchBundleDTO;
  domain?: ArticleDomainDTO;
  matchedDomain?: {
    domain: ArticleDomainDTO;
    score: number;
    reasons: string[];
  };
}

export async function fetchStyles() {
  const res = await fetch(`${BASE}/styles`);
  if (!res.ok) return [] as StyleDTO[];
  return (await res.json()).styles as StyleDTO[];
}

export async function fetchArticleDomains() {
  const res = await fetch(`${BASE}/article/domains`);
  if (!res.ok) return [] as ArticleDomainDTO[];
  return (await res.json()).domains as ArticleDomainDTO[];
}

export async function previewResearch(domainId: string, customDomain = "", query = "") {
  const res = await fetch(`${BASE}/research/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domainId, customDomain, query }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "获取前沿资料失败");
  return res.json() as Promise<ResearchBundleDTO>;
}

export async function fetchArticleTopics(domainId: string, customDomain = "", n = 6) {
  const res = await fetch(`${BASE}/article/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domainId, customDomain, n }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "生成选题失败");
  return res.json() as Promise<{
    topics: TopicOptionDTO[];
    research?: ResearchBundleDTO;
  }>;
}

export async function generateArticle(
  domainId: string,
  customDomain: string,
  topic: TopicOptionDTO,
  styleId: string,
  targetLength: TargetLength
) {
  const res = await fetch(`${BASE}/article/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domainId, customDomain, topic, styleId, targetLength }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "生成文章失败");
  return res.json() as Promise<GeneratedArticleResponseDTO>;
}

export async function generateArticleFromTitle(
  title: string,
  styleId: string,
  targetLength: TargetLength
) {
  const res = await fetch(`${BASE}/article/generate-from-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, styleId, targetLength }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "根据标题生成文章失败");
  return res.json() as Promise<GeneratedArticleResponseDTO>;
}

export async function uploadFiles(target: File, references: File[], styleId = "") {
  const fd = new FormData();
  fd.append("file", target);
  references.forEach((r) => fd.append("references", r));
  if (styleId) fd.append("styleId", styleId);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json()).error ?? "上传失败");
  return res.json() as Promise<{
    docId: string;
    styleSummary: string;
    titleIndex: number;
    paragraphs: ParagraphDTO[];
  }>;
}

export async function rewriteDoc(docId: string) {
  const res = await fetch(`${BASE}/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "改写失败");
  return res.json() as Promise<{ paragraphs: ParagraphDTO[] }>;
}

export async function fetchTitles(docId: string, n = 3) {
  const res = await fetch(`${BASE}/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, n }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "生成标题失败");
  return (await res.json()).titles as string[];
}

export async function fetchAlternatives(
  docId: string,
  context: string,
  sentence: string,
  n = 3
) {
  const res = await fetch(`${BASE}/sentence/alternatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, context, sentence, n }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "生成候选失败");
  return (await res.json()).alternatives as string[];
}

export async function exportDoc(docId: string, texts: Record<number, string>) {
  const res = await fetch(`${BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, texts }),
  });
  if (!res.ok) throw new Error("导出失败");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rewritten.docx";
  a.click();
  URL.revokeObjectURL(url);
}
