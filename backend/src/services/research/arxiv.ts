import { XMLParser } from "fast-xml-parser";
import { cached } from "./cache.js";
import { fetchTextWithTimeout } from "./http.js";
import { waitForProvider } from "./rateLimit.js";
import type { ResearchItem } from "./types.js";

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

type XmlValue = string | number | boolean | Record<string, unknown> | XmlValue[] | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: XmlValue): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).replace(/\s+/g, " ").trim();
    return text || undefined;
  }
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join(", ") || undefined;
  }
  const text = cleanText((value as Record<string, unknown>)["#text"] as XmlValue);
  return text || undefined;
}

function firstText(...values: XmlValue[]): string | undefined {
  for (const value of values) {
    const text = cleanText(value);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function entryUrl(entry: Record<string, unknown>): string | undefined {
  const links = asArray(entry.link as Record<string, unknown> | string | undefined);
  const alternate = links.find((link) => isRecord(link) && link.rel === "alternate");
  const href = isRecord(alternate) ? cleanText(alternate.href as XmlValue) : undefined;
  const id = cleanText(entry.id as XmlValue);
  return href || id;
}

function entryAuthors(entry: Record<string, unknown>): string[] | undefined {
  const authors = asArray(entry.author as Record<string, unknown> | string | undefined)
    .map((author) => (isRecord(author) ? cleanText(author.name as XmlValue) : cleanText(author as XmlValue)))
    .filter((author): author is string => Boolean(author));

  return authors.length > 0 ? authors : undefined;
}

function itemId(url: string): string {
  return `arxiv:${url.trim().toLowerCase()}`;
}

export function parseArxivAtom(xml: string, query: string): ResearchItem[] {
  const parsed = parser.parse(xml) as { feed?: { entry?: Record<string, unknown> | Record<string, unknown>[] } };
  const entries = asArray(parsed.feed?.entry);

  return entries
    .map((entry): ResearchItem | undefined => {
      const title = cleanText(entry.title as XmlValue);
      const url = entryUrl(entry);

      if (!title || !url) {
        return undefined;
      }

      return {
        id: itemId(url),
        sourceKind: "paper",
        sourceName: "arXiv",
        sourceId: "arxiv",
        title,
        summary: cleanText(entry.summary as XmlValue) ?? "",
        url,
        publishedAt: firstText(entry.published as XmlValue, entry.updated as XmlValue) ?? "",
        authors: entryAuthors(entry) ?? [],
        query,
      } satisfies ResearchItem;
    })
    .filter((item): item is ResearchItem => Boolean(item));
}

export function fetchArxivPapers(query: string, maxResults = 8): Promise<ResearchItem[]> {
  const limitedMaxResults = Math.min(10, Math.max(1, Math.trunc(maxResults)));
  const cacheKey = `arxiv:${query.trim().toLowerCase()}:${limitedMaxResults}`;

  return cached(cacheKey, 60 * 60 * 1000, async () => {
    await waitForProvider("arxiv", 3100);

    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: String(limitedMaxResults),
      sortBy: "submittedDate",
      sortOrder: "descending",
    });

    const res = await fetchTextWithTimeout(
      `https://export.arxiv.org/api/query?${params.toString()}`,
      {},
      { label: "arXiv", timeoutMs: 12_000, maxBytes: 2_000_000 }
    );
    if (!res.ok) {
      throw new Error(`arXiv 请求失败：${res.status}`);
    }

    return parseArxivAtom(res.text, query);
  });
}
