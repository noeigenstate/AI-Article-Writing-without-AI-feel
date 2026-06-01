import { XMLParser } from "fast-xml-parser";
import { cached } from "./cache.js";
import { fetchTextWithTimeout } from "./http.js";
import type { NewsSource, ResearchItem } from "./types.js";

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

function linkText(value: XmlValue): string | undefined {
  if (Array.isArray(value)) {
    const alternate = value.find((link) => isRecord(link) && link.rel === "alternate");
    return linkText((alternate ?? value[0]) as XmlValue);
  }
  if (isRecord(value)) {
    return cleanText(value.href as XmlValue) || cleanText(value["#text"] as XmlValue);
  }
  return cleanText(value);
}

function firstImageUrl(...values: XmlValue[]): string | undefined {
  for (const value of values) {
    const url = imageUrl(value);
    if (url) {
      return url;
    }
  }
  return undefined;
}

function imageUrl(value: XmlValue): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const fromHtml = value.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    return isImageUrl(fromHtml) ? fromHtml : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = imageUrl(entry);
      if (url) return url;
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directUrl = cleanText((record.url ?? record.href) as XmlValue);
  const type = cleanText(record.type as XmlValue)?.toLowerCase() ?? "";
  if (isImageUrl(directUrl) || (directUrl && type.startsWith("image/"))) {
    return directUrl;
  }

  for (const key of ["thumbnail", "image", "content", "enclosure"]) {
    const url = imageUrl(record[key] as XmlValue);
    if (url) return url;
  }

  return undefined;
}

function isImageUrl(url: string | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) {
    return false;
  }
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) || /\/image\//i.test(url);
}

function authorNames(value: XmlValue): string[] | undefined {
  const authors = asArray(value as Record<string, unknown> | string | undefined)
    .map((author) => (isRecord(author) ? cleanText(author.name as XmlValue) : cleanText(author as XmlValue)))
    .filter((author): author is string => Boolean(author));

  return authors.length > 0 ? authors : undefined;
}

function normalizeDate(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function itemId(source: NewsSource, url: string): string {
  return `${source.id}:${url.trim().toLowerCase()}`;
}

function fromRssItem(item: Record<string, unknown>, source: NewsSource): ResearchItem | undefined {
  const title = cleanText(item.title as XmlValue);
  const url = linkText(item.link as XmlValue) || cleanText(item.guid as XmlValue);

  if (!title || !url) {
    return undefined;
  }

  return {
    id: itemId(source, url),
    sourceKind: "news",
    sourceName: source.name,
    sourceId: source.id,
    title,
    summary: cleanText(item.description as XmlValue) ?? "",
    url,
    imageUrl: firstImageUrl(item.enclosure as XmlValue, item.content as XmlValue, item.thumbnail as XmlValue, item.image as XmlValue, item.description as XmlValue),
    publishedAt: normalizeDate(cleanText(item.pubDate as XmlValue)),
    authors: authorNames(item.author as XmlValue) ?? [],
    query: source.type,
  };
}

function fromAtomEntry(entry: Record<string, unknown>, source: NewsSource): ResearchItem | undefined {
  const title = cleanText(entry.title as XmlValue);
  const url = linkText(entry.link as XmlValue) || cleanText(entry.id as XmlValue);

  if (!title || !url) {
    return undefined;
  }

  return {
    id: itemId(source, url),
    sourceKind: "news",
    sourceName: source.name,
    sourceId: source.id,
    title,
    summary: cleanText((entry.summary ?? entry.content) as XmlValue) ?? "",
    url,
    imageUrl: firstImageUrl(entry.enclosure as XmlValue, entry.content as XmlValue, entry.thumbnail as XmlValue, entry.image as XmlValue, entry.summary as XmlValue),
    publishedAt: normalizeDate(cleanText((entry.published ?? entry.updated) as XmlValue)),
    authors: authorNames(entry.author as XmlValue) ?? [],
    query: source.type,
  };
}

export function parseFeedXml(xml: string, source: NewsSource): ResearchItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: Record<string, unknown> | Record<string, unknown>[] } };
    feed?: { entry?: Record<string, unknown> | Record<string, unknown>[] };
  };

  const rssItems = asArray(parsed.rss?.channel?.item)
    .map((item) => fromRssItem(item, source))
    .filter((item): item is ResearchItem => Boolean(item));

  if (rssItems.length > 0) {
    return rssItems;
  }

  return asArray(parsed.feed?.entry)
    .map((entry) => fromAtomEntry(entry, source))
    .filter((item): item is ResearchItem => Boolean(item));
}

export function fetchNewsFeed(source: NewsSource): Promise<ResearchItem[]> {
  return cached(`rss:${source.id}:${source.url}`, 20 * 60 * 1000, async () => {
    const res = await fetchTextWithTimeout(
      source.url,
      {
        headers: {
          "User-Agent": "SpeakPlainlyResearch/0.1 (+local development)",
        },
      },
      { label: source.name, timeoutMs: 10_000, maxBytes: 1_500_000 }
    );

    if (!res.ok) {
      throw new Error(`${source.name} RSS 请求失败：${res.status}`);
    }

    return parseFeedXml(res.text, source);
  });
}
