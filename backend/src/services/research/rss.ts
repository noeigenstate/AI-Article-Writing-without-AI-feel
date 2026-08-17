import { XMLParser } from "fast-xml-parser";
import { cached } from "./cache.js";
import { fetchTextWithTimeout } from "./http.js";
import { normalizePublicSourceUrl } from "./networkSafety.js";
import type { NewsSource, ResearchItem, ResearchRegion } from "./types.js";

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

const DOMESTIC_PUBLISHER_DOMAINS = [
  "36kr.com",
  "baidu.com",
  "bilibili.com",
  "caixin.com",
  "cnbeta.com.tw",
  "chinadaily.com.cn",
  "geekpark.net",
  "huxiu.com",
  "ithome.com",
  "jiemian.com",
  "people.com.cn",
  "qq.com",
  "sciencenet.cn",
  "sina.com.cn",
  "sspai.com",
  "thepaper.cn",
  "tmtpost.com",
  "weibo.com",
  "xinhuanet.com",
  "zhihu.com",
];

const INTERNATIONAL_PUBLISHER_DOMAINS = [
  "aljazeera.com",
  "apnews.com",
  "arstechnica.com",
  "bbc.co.uk",
  "bbc.com",
  "bloomberg.com",
  "cnbc.com",
  "engadget.com",
  "ft.com",
  "france24.com",
  "marketwatch.com",
  "nature.com",
  "news.ycombinator.com",
  "npr.org",
  "nytimes.com",
  "reuters.com",
  "techcrunch.com",
  "technologyreview.com",
  "theguardian.com",
  "un.org",
  "washingtonpost.com",
  "who.int",
  "wired.com",
  "wsj.com",
];

const DOMESTIC_PUBLISHER_NAMES = [
  "36氪",
  "cnbeta",
  "china daily",
  "it之家",
  "人民网",
  "少数派",
  "新华网",
  "新华社",
  "极客公园",
  "澎湃",
  "界面新闻",
  "科学网",
  "虎嗅",
  "财新",
  "钛媒体",
];

const INTERNATIONAL_PUBLISHER_NAMES = [
  "al jazeera",
  "ap news",
  "ars technica",
  "associated press",
  "bbc",
  "bloomberg",
  "cnbc",
  "engadget",
  "financial times",
  "france 24",
  "hacker news",
  "marketwatch",
  "mit technology review",
  "nature",
  "new york times",
  "npr",
  "reuters",
  "techcrunch",
  "the guardian",
  "un news",
  "washington post",
  "who",
  "wired",
  "wall street journal",
];

const GENERIC_PUBLISHER_NAMES = new Set([
  "agent-reach / exa",
  "exa",
  "google news",
  "google news cn",
  "google news international",
  "web",
]);

type XmlValue = string | number | boolean | Record<string, unknown> | XmlValue[] | null | undefined;

/** Type guard for plain objects (not arrays/null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Wrap a value as an array (XML parser yields a scalar for single nodes). */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Coerce an XML node value to clean, whitespace-collapsed text. */
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

/** Read a URL field without erasing embedded control characters before validation. */
function cleanUrlText(value: XmlValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const raw = String(value);
    if (/\p{Cc}/u.test(raw)) return undefined;
    return raw.trim() || undefined;
  }
  if (Array.isArray(value)) return undefined;
  return cleanUrlText((value as Record<string, unknown>)["#text"] as XmlValue);
}

/** Resolve a feed `link` node to an HTTP(S) URL (prefer `alternate`, then href/text). */
function linkText(value: XmlValue, baseUrl: string): string | undefined {
  if (Array.isArray(value)) {
    const alternate = value.find((link) => isRecord(link) && link.rel === "alternate");
    return linkText((alternate ?? value[0]) as XmlValue, baseUrl);
  }
  if (isRecord(value)) {
    return (
      safeHttpUrl(cleanUrlText(value.href as XmlValue), baseUrl) ||
      safeHttpUrl(cleanUrlText(value["#text"] as XmlValue), baseUrl)
    );
  }
  return safeHttpUrl(cleanUrlText(value), baseUrl);
}

/** Resolve the publisher URL carried by an RSS/Atom `<source>` node. */
function publisherUrl(value: XmlValue, baseUrl: string): string | undefined {
  if (Array.isArray(value)) {
    return value.map((entry) => publisherUrl(entry, baseUrl)).find(Boolean);
  }
  if (!isRecord(value)) {
    return undefined;
  }
  return safeHttpUrl(cleanUrlText((value.url ?? value.href) as XmlValue), baseUrl);
}

/** Resolve only public source URLs, including safe relative feed links. */
function safeHttpUrl(value: string | undefined, baseUrl?: string): string | undefined {
  return normalizePublicSourceUrl(value, baseUrl);
}

function normalizedHostname(value: string): string {
  try {
    return new URL(value).hostname.toLocaleLowerCase().replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Match only a known publisher name or a small set of ordinary outlet suffixes. */
function publisherNameMatches(name: string, publisher: string): boolean {
  if (name === publisher) return true;
  const suffixes = /[\u3400-\u9fff]/u.test(publisher)
    ? ["网", "新闻", "客户端", "中文网"]
    : [" news", " online", " international"];
  return suffixes.some((suffix) => name === `${publisher}${suffix}`);
}

/** Return the publisher hostname for a result URL, without a leading `www.`. */
export function sourceNameFromUrl(value: string): string {
  return normalizedHostname(value) || "Web";
}

/** Prefer a declared publisher name, but replace search-adapter labels with the real hostname. */
export function inferPublisherName(value: string, declaredName?: string): string {
  const normalizedName = declaredName?.replace(/\s+/g, " ").trim();
  if (normalizedName && !GENERIC_PUBLISHER_NAMES.has(normalizedName.toLocaleLowerCase())) {
    return normalizedName;
  }
  return sourceNameFromUrl(value);
}

/**
 * Infer the publisher's editorial region, independently from the market used to
 * run the search. Unknown generic-TLD publishers deliberately remain `global`.
 */
export function inferPublisherRegion(
  value: string,
  publisherName?: string,
  fallback: ResearchRegion = "global"
): ResearchRegion {
  const hostname = normalizedHostname(value);
  const name = publisherName?.replace(/\s+/g, " ").trim().toLocaleLowerCase() ?? "";

  if (
    hostname.endsWith(".cn") ||
    DOMESTIC_PUBLISHER_DOMAINS.some((domain) => domainMatches(hostname, domain)) ||
    DOMESTIC_PUBLISHER_NAMES.some((publisher) => publisherNameMatches(name, publisher))
  ) {
    return "domestic";
  }

  if (
    INTERNATIONAL_PUBLISHER_DOMAINS.some((domain) => domainMatches(hostname, domain)) ||
    INTERNATIONAL_PUBLISHER_NAMES.some((publisher) => publisherNameMatches(name, publisher))
  ) {
    return "international";
  }

  return fallback;
}

/** Return the first usable image URL among several candidate nodes. */
function firstImageUrl(baseUrl: string, ...values: XmlValue[]): string | undefined {
  for (const value of values) {
    const url = imageUrl(value, baseUrl);
    if (url) {
      return url;
    }
  }
  return undefined;
}

/** Dig an image URL out of a feed node (string HTML, enclosure, media:*, etc.). */
function imageUrl(value: XmlValue, baseUrl: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const fromHtml = value.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    return normalizeImageUrl(fromHtml, baseUrl);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = imageUrl(entry, baseUrl);
      if (url) return url;
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directUrl = cleanUrlText((record.url ?? record.href ?? record.src) as XmlValue);
  const type = cleanText(record.type as XmlValue)?.toLowerCase() ?? "";
  const normalizedDirectUrl = safeHttpUrl(directUrl, baseUrl);
  if (normalizedDirectUrl && (isImageUrl(normalizedDirectUrl) || type.startsWith("image/"))) {
    return normalizedDirectUrl;
  }

  for (const key of ["img", "thumbnail", "image", "content", "enclosure"]) {
    const url = imageUrl(record[key] as XmlValue, baseUrl);
    if (url) return url;
  }

  return undefined;
}

/** True if the string looks like an http(s) image URL. */
function isImageUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) || /\/image\//i.test(url);
}

function normalizeImageUrl(value: string | undefined, baseUrl: string): string | undefined {
  const url = safeHttpUrl(value, baseUrl);
  return isImageUrl(url) ? url : undefined;
}

/** Extract author names from a feed author node, if any. */
function authorNames(value: XmlValue): string[] | undefined {
  const authors = asArray(value as Record<string, unknown> | string | undefined)
    .map((author) => (isRecord(author) ? cleanText(author.name as XmlValue) : cleanText(author as XmlValue)))
    .filter((author): author is string => Boolean(author));

  return authors.length > 0 ? authors : undefined;
}

/** Normalize a date string to ISO-8601, or "" if missing/unparseable. */
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

/** Build a stable item id from a source and URL. */
function itemId(source: NewsSource, url: string): string {
  return `${source.id}:${url.trim().toLowerCase()}`;
}

/** Map one RSS `<item>` to a research item, or undefined if incomplete. */
function fromRssItem(item: Record<string, unknown>, source: NewsSource): ResearchItem | undefined {
  const title = cleanText(item.title as XmlValue);
  const url =
    linkText(item.link as XmlValue, source.url) ||
    safeHttpUrl(cleanUrlText(item.guid as XmlValue), source.url);

  if (!title || !url) {
    return undefined;
  }

  const declaredPublisher = cleanText(item.source as XmlValue) || source.name;
  const publisherLink = publisherUrl(item.source as XmlValue, source.url) || url;
  const itemSourceName = inferPublisherName(publisherLink, declaredPublisher);

  return {
    id: itemId(source, url),
    sourceKind: "news",
    sourceName: itemSourceName,
    sourceId: source.id,
    region: inferPublisherRegion(publisherLink, itemSourceName, source.region),
    title,
    summary: cleanText(item.description as XmlValue) ?? "",
    url,
    imageUrl: firstImageUrl(url, item.enclosure as XmlValue, item.content as XmlValue, item.thumbnail as XmlValue, item.image as XmlValue, item.description as XmlValue),
    publishedAt: normalizeDate(cleanText(item.pubDate as XmlValue)),
    authors: authorNames(item.author as XmlValue) ?? [],
    query: source.type,
  };
}

/** Map one Atom `<entry>` to a research item, or undefined if incomplete. */
function fromAtomEntry(entry: Record<string, unknown>, source: NewsSource): ResearchItem | undefined {
  const title = cleanText(entry.title as XmlValue);
  const url =
    linkText(entry.link as XmlValue, source.url) ||
    safeHttpUrl(cleanUrlText(entry.id as XmlValue), source.url);

  if (!title || !url) {
    return undefined;
  }

  const itemSourceName = inferPublisherName(url, source.name);

  return {
    id: itemId(source, url),
    sourceKind: "news",
    sourceName: itemSourceName,
    sourceId: source.id,
    region: inferPublisherRegion(url, itemSourceName, source.region),
    title,
    summary: cleanText((entry.summary ?? entry.content) as XmlValue) ?? "",
    url,
    imageUrl: firstImageUrl(url, entry.enclosure as XmlValue, entry.content as XmlValue, entry.thumbnail as XmlValue, entry.image as XmlValue, entry.summary as XmlValue),
    publishedAt: normalizeDate(cleanText((entry.published ?? entry.updated) as XmlValue)),
    authors: authorNames(entry.author as XmlValue) ?? [],
    query: source.type,
  };
}

/**
 * Parse an RSS or Atom feed into research items.
 *
 * Tries RSS `<item>`s first, then falls back to Atom `<entry>`s.
 *
 * @param xml The feed XML.
 * @param source The source the feed belongs to.
 * @returns Parsed items (entries lacking a title or URL are dropped).
 */
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

/**
 * Fetch and parse a news/RSS source (cached 20 min).
 *
 * @param source The configured feed.
 * @returns Parsed research items.
 * @throws Error if the feed request fails.
 */
export function fetchNewsFeed(source: NewsSource): Promise<ResearchItem[]> {
  return cached(`rss:${source.id}:${source.url}`, 20 * 60 * 1000, async () => {
    const res = await fetchTextWithTimeout(
      source.url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SpeakPlainlyResearch/0.1; +local development)",
          Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.6",
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
