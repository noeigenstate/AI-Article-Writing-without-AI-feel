import { execFile, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { promisify } from "node:util";
import { fetchAgentReachSearch } from "./agentReach.js";
import { cached } from "./cache.js";
import { fetchTextWithTimeout } from "./http.js";
import {
  inferPublisherName,
  inferPublisherRegion,
  parseFeedXml,
} from "./rss.js";
import type { NewsSource, ResearchItem, ResearchSourceKind } from "./types.js";

const execFileAsync = promisify(execFile);
const GOOGLE_NEWS_NAME = "Google News";
const HACKER_NEWS_NAME = "Hacker News";
const EXA_API_URL = "https://api.exa.ai/search";
let mcporterAvailablePromise: Promise<boolean> | undefined;
export type GoogleNewsMarket = "cn" | "international";

export interface BroadWebSearchResult {
  items: ResearchItem[];
  unavailableSources: string[];
}
type ProviderFailureCategory = "timed out" | "rate limited" | "authentication unavailable" | "unavailable";

const BROAD_WEB_PROVIDER_LABELS = [
  "Exa article search",
  "Exa comment search",
  "Agent-Reach article search",
  "Agent-Reach comment search",
] as const;
const DISCUSSION_DOMAINS = [
  "reddit.com",
  "news.ycombinator.com",
  "zhihu.com",
  "quora.com",
  "stackoverflow.com",
  "stackexchange.com",
];

const RELEVANCE_ALIASES: { canonical: string; aliases: string[] }[] = [
  { canonical: "artificial_intelligence", aliases: ["artificial intelligence", "人工智能", "大模型"] },
  { canonical: "ai_agent", aliases: ["ai agents", "ai agent", "智能体"] },
  { canonical: "software_development", aliases: ["software development", "software engineering", "软件开发", "编程开发"] },
  { canonical: "small_team", aliases: ["small teams", "small team", "小团队", "小型团队"] },
  { canonical: "remote_work", aliases: ["remote working", "working remotely", "remote work", "远程工作", "远程办公"] },
  { canonical: "policy", aliases: ["policies", "policy", "制度", "政策"] },
  {
    canonical: "small_company",
    aliases: ["small businesses", "small business", "small companies", "small company", "小微企业", "中小企业", "小型公司", "小企业", "小公司"],
  },
  { canonical: "climate_change", aliases: ["climate change", "气候变化"] },
  { canonical: "renewable_energy", aliases: ["renewable energy", "可再生能源", "新能源"] },
  { canonical: "electric_vehicle", aliases: ["electric vehicles", "electric vehicle", "新能源汽车", "电动汽车"] },
  { canonical: "supply_chain", aliases: ["supply chains", "supply chain", "供应链"] },
  { canonical: "data_protection", aliases: ["data protection", "数据保护"] },
  { canonical: "elder_care", aliases: ["elder care", "养老"] },
  { canonical: "quantum_computing", aliases: ["quantum computing", "quantum computer", "量子计算", "量子电脑"] },
  { canonical: "cryptography", aliases: ["cryptography", "cryptographic", "encryption", "密码学", "密码体系", "密码技术", "加密技术"] },
  { canonical: "information_security", aliases: ["information security", "cybersecurity", "cyber security", "信息安全", "网络安全"] },
  { canonical: "impact", aliases: ["impact on", "impacts on", "effect on", "影响", "改变", "冲击", "作用"] },
];

interface ExaRawResult {
  title?: unknown;
  url?: unknown;
  publishedDate?: unknown;
  publishedAt?: unknown;
  author?: unknown;
  authors?: unknown;
  text?: unknown;
  summary?: unknown;
  highlights?: unknown;
  image?: unknown;
}

interface HackerNewsHit {
  objectID?: unknown;
  title?: unknown;
  url?: unknown;
  story_text?: unknown;
  story_title?: unknown;
  comment_text?: unknown;
  author?: unknown;
  created_at?: unknown;
}

/** Build a Google News RSS query URL for a search market (not a publisher region). */
export function googleNewsSearchUrl(
  query: string,
  market: GoogleNewsMarket = containsCjk(query) ? "cn" : "international"
): string {
  const domesticMarket = market === "cn";
  const params = new URLSearchParams({
    q: query,
    hl: domesticMarket ? "zh-CN" : "en-US",
    gl: domesticMarket ? "CN" : "US",
    ceid: domesticMarket ? "CN:zh-Hans" : "US:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/** Describe the aggregator feed without claiming its publishers share the search market. */
export function googleNewsFeedSource(query: string, market: GoogleNewsMarket): NewsSource {
  return {
    id: `google-news-${market}`,
    name: market === "cn" ? `${GOOGLE_NEWS_NAME} CN` : `${GOOGLE_NEWS_NAME} International`,
    type: market === "cn" ? "chinese" : "international",
    region: "global",
    language: market === "cn" ? "zh" : "en",
    url: googleNewsSearchUrl(query, market),
    enabled: true,
  };
}

/** Parse Google News while inferring each publisher independently from the market. */
export function parseGoogleNewsFeed(
  xml: string,
  query: string,
  market: GoogleNewsMarket
): ResearchItem[] {
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) return [];

  return parseFeedXml(xml, googleNewsFeedSource(cleanQuery, market)).map((item) => ({
    ...item,
    sourceKind: "article" as const,
    excerpt: cleanText(item.summary, 280) || undefined,
    query: cleanQuery,
  }));
}

/** Search current news articles without a key, using curl for system-proxy compatibility. */
export function fetchGoogleNewsArticles(
  query: string,
  limit = 8,
  market: GoogleNewsMarket = containsCjk(query) ? "cn" : "international"
): Promise<ResearchItem[]> {
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) return Promise.resolve([]);

  return cached(`google-news:${market}:${cleanQuery}:${limit}`, 20 * 60 * 1000, async () => {
    const source = googleNewsFeedSource(cleanQuery, market);
    const options: ExecFileOptionsWithStringEncoding = {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
    };
    const command = process.platform === "win32" ? "curl.exe" : "curl";
    const { stdout } = await execFileAsync(
      command,
      [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "12",
        "--user-agent",
        "SpeakPlainlyResearch/0.1",
        source.url,
      ],
      options
    );
    return parseGoogleNewsFeed(stdout, cleanQuery, market)
      .filter((item) => isRelevantResearchItem(item, cleanQuery))
      .slice(0, limit);
  });
}

/** Parse Hacker News story search results as links to relevant web articles. */
export function parseHackerNewsArticles(payload: string | unknown, query: string): ResearchItem[] {
  const parsed = typeof payload === "string" ? parseJson(payload) : payload;
  if (!isRecord(parsed) || !Array.isArray(parsed.hits)) return [];

  return parsed.hits
    .map((raw): ResearchItem | undefined => {
      if (!isRecord(raw)) return undefined;
      const hit = raw as HackerNewsHit;
      const objectId = cleanText(asString(hit.objectID), 80);
      const title = cleanText(asString(hit.title), 180);
      const url = validExternalArticleUrl(asString(hit.url));
      if (!objectId || !title || !url) return undefined;

      const summary = selectRelevantStorySummary(asString(hit.story_text), title, query);
      if (!isRelevantText(`${title} ${summary}`, query)) return undefined;

      const excerpt = cleanText(summary, 280);
      const author = cleanText(asString(hit.author), 120);
      const sourceName = inferPublisherName(url);
      return {
        id: `hacker-news-story:${objectId}`,
        sourceKind: "article",
        sourceName,
        sourceId: "hacker-news-stories",
        region: inferPublisherRegion(url, sourceName),
        title,
        summary,
        excerpt: excerpt || undefined,
        url,
        publishedAt: normalizeDate(asString(hit.created_at)),
        authors: author ? [author] : [],
        query,
      };
    })
    .filter((item): item is ResearchItem => Boolean(item));
}

/** Search Hacker News' public story index for relevant linked web articles. */
export function fetchBuiltInWebArticles(query: string, limit = 8): Promise<ResearchItem[]> {
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) return Promise.resolve([]);

  return cached(`hacker-news-stories:${cleanQuery}:${limit}`, 20 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      query: cleanQuery,
      tags: "story",
      hitsPerPage: String(Math.max(limit * 2, limit)),
    });
    const res = await fetchTextWithTimeout(
      `https://hn.algolia.com/api/v1/search?${params.toString()}`,
      { headers: { "User-Agent": "SpeakPlainlyResearch/0.1", Accept: "application/json" } },
      { label: `${HACKER_NEWS_NAME} article search`, timeoutMs: 10_000, maxBytes: 1_000_000 }
    );
    if (!res.ok) throw new Error(`${HACKER_NEWS_NAME} article search failed: ${res.status}`);
    return parseHackerNewsArticles(res.text, cleanQuery).slice(0, limit);
  });
}

/** Parse public Hacker News comment search output into short attributed excerpts. */
export function parseHackerNewsComments(payload: string | unknown, query: string): ResearchItem[] {
  const parsed = typeof payload === "string" ? parseJson(payload) : payload;
  if (!isRecord(parsed) || !Array.isArray(parsed.hits)) return [];

  return parsed.hits
    .map((raw): ResearchItem | undefined => {
      if (!isRecord(raw)) return undefined;
      const hit = raw as HackerNewsHit;
      const objectId = cleanText(asString(hit.objectID), 80);
      const fullComment = cleanText(asString(hit.comment_text), 4_000);
      const excerpt = cleanText(fullComment, 280);
      if (!objectId || !excerpt) return undefined;

      const storyTitle = cleanText(asString(hit.story_title), 180);
      if (!isRelevantText(`${storyTitle} ${fullComment}`, query)) return undefined;
      const author = cleanText(asString(hit.author), 120);
      return {
        id: `hacker-news-comment:${objectId}`,
        sourceKind: "comment",
        sourceName: HACKER_NEWS_NAME,
        sourceId: "hacker-news-comments",
        region: "international",
        title: storyTitle ? `Comment on: ${storyTitle}` : `Public comment about ${cleanText(query, 120)}`,
        summary: excerpt,
        excerpt,
        url: `https://news.ycombinator.com/item?id=${encodeURIComponent(objectId)}`,
        publishedAt: normalizeDate(asString(hit.created_at)),
        authors: author ? [author] : [],
        query,
      };
    })
    .filter((item): item is ResearchItem => Boolean(item));
}

/** Search public comments without credentials through Hacker News' Algolia endpoint. */
export function fetchPublicComments(query: string, limit = 5): Promise<ResearchItem[]> {
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) return Promise.resolve([]);

  return cached(`hacker-news-comments:${cleanQuery}:${limit}`, 20 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      query: cleanQuery,
      tags: "comment",
      hitsPerPage: String(Math.max(limit, 1)),
    });
    const res = await fetchTextWithTimeout(
      `https://hn.algolia.com/api/v1/search?${params.toString()}`,
      { headers: { "User-Agent": "SpeakPlainlyResearch/0.1", Accept: "application/json" } },
      { label: HACKER_NEWS_NAME, timeoutMs: 10_000, maxBytes: 1_000_000 }
    );
    if (!res.ok) throw new Error(`${HACKER_NEWS_NAME} comment search failed: ${res.status}`);
    return parseHackerNewsComments(res.text, cleanQuery).slice(0, limit);
  });
}

/** Parse direct Exa search output for either web articles or public discussions. */
export function parseExaSearchResults(
  payload: string | unknown,
  query: string,
  sourceKind: Extract<ResearchSourceKind, "article" | "comment">
): ResearchItem[] {
  const parsed = typeof payload === "string" ? parseJson(payload) : payload;
  if (!isRecord(parsed) || !Array.isArray(parsed.results)) return [];

  return parsed.results
    .map((raw): ResearchItem | undefined => {
      if (!isRecord(raw)) return undefined;
      const result = raw as ExaRawResult;
      const title = cleanText(asString(result.title), 180);
      const url = cleanText(asString(result.url), 400);
      if (!title || !/^https?:\/\//i.test(url)) return undefined;

      const excerpt = cleanText(asStringArray(result.highlights).join(" ") || asString(result.text), 280);
      const summary = cleanText(asString(result.summary), 700) || excerpt;
      const imageUrl = cleanText(asString(result.image), 500);
      const sourceName = inferPublisherName(url);
      return {
        id: `exa-${sourceKind}:${url.toLowerCase()}`,
        sourceKind,
        sourceName,
        sourceId: `exa-${sourceKind}`,
        region: inferPublisherRegion(url, sourceName),
        title,
        summary,
        excerpt: excerpt || undefined,
        url,
        imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
        publishedAt: normalizeDate(asString(result.publishedDate) || asString(result.publishedAt)),
        authors: normalizeAuthors(result.author ?? result.authors),
        query,
      };
    })
    .filter((item): item is ResearchItem => Boolean(item));
}

/**
 * Search the broad web for articles and discussions.
 *
 * A configured `EXA_API_KEY` uses the built-in HTTP integration. Otherwise the
 * existing Agent-Reach/mcporter path remains a compatible fallback.
 */
export async function fetchBroadWebSources(query: string): Promise<ResearchItem[]> {
  const result = await fetchBroadWebSourcesWithDiagnostics(query);
  if (result.items.length === 0 && result.unavailableSources.length > 0) {
    throw new Error(result.unavailableSources.join("; "));
  }
  return result.items;
}

/** Search the broad web while retaining warnings from partially failed providers. */
export async function fetchBroadWebSourcesWithDiagnostics(query: string): Promise<BroadWebSearchResult> {
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) return { items: [], unavailableSources: [] };

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (apiKey) {
    const direct = await Promise.allSettled([
      fetchDirectExaSearch(cleanQuery, "article", 6, apiKey),
      fetchDirectExaSearch(cleanQuery, "comment", 4, apiKey),
    ]);
    const directItems = direct.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const warnings = providerDiagnosticsFromSettled(direct, ["Exa article search", "Exa comment search"]);
    if (warnings.length === 0) return { items: directItems, unavailableSources: [] };

    // Preserve whichever direct query succeeded, then fill the failed side via
    // Agent-Reach when it is installed. If no fallback exists, partial success
    // is still more useful than discarding the whole provider.
    if (await isMcporterAvailable()) {
      const fallback = await fetchAgentReachPairWithDiagnostics(cleanQuery);
      return {
        items: [...directItems, ...fallback.items],
        unavailableSources: [...warnings, ...fallback.unavailableSources],
      };
    }
    return { items: directItems, unavailableSources: warnings };
  }

  if (!(await isMcporterAvailable())) return { items: [], unavailableSources: [] };
  return fetchAgentReachPairWithDiagnostics(cleanQuery);
}

async function fetchAgentReachPairWithDiagnostics(query: string): Promise<BroadWebSearchResult> {
  const settled = await Promise.allSettled([
    fetchAgentReachSearch(query, 6, "article"),
    fetchAgentReachSearch(discussionQuery(query), 4, "comment"),
  ]);
  return {
    items: settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    unavailableSources: providerDiagnosticsFromSettled(settled, ["Agent-Reach article search", "Agent-Reach comment search"]),
  };
}

/** Convert rejected provider calls to stable diagnostics without exposing upstream text. */
export function providerDiagnosticsFromSettled<T>(
  settled: PromiseSettledResult<T>[],
  labels: string[]
): string[] {
  return settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [providerFailureDiagnostic(labels[index] ?? "Broad web provider", result.reason)]
      : []
  );
}

/** Build a public diagnostic containing only a controlled label and broad category. */
export function providerFailureDiagnostic(label: string, error: unknown): string {
  return `${safeProviderLabel(label)}: ${providerFailureCategory(error)}`;
}

/** Re-sanitize nested broad-web warnings at the aggregate boundary. */
export function normalizeProviderDiagnostic(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const label = BROAD_WEB_PROVIDER_LABELS.find(
    (candidate) => raw === candidate || raw.startsWith(`${candidate}:`)
  );
  return providerFailureDiagnostic(label ?? "Broad web provider", raw);
}

function providerFailureCategory(error: unknown): ProviderFailureCategory {
  const record = isRecord(error) ? error : undefined;
  const name = error instanceof Error ? error.name : asString(record?.name);
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : asString(record?.message);
  const code = asString(record?.code);
  const status = typeof record?.status === "number" || typeof record?.status === "string"
    ? String(record.status)
    : "";
  const signal = `${name} ${code} ${status} ${message}`.toLocaleLowerCase();

  if (/aborterror|time(?:d)?[ -]?out|etimedout/.test(signal)) return "timed out";
  if (/\b429\b|rate[ -]?limit|too many requests/.test(signal)) return "rate limited";
  if (/\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid (?:api )?key|authentication/.test(signal)) {
    return "authentication unavailable";
  }
  return "unavailable";
}

function safeProviderLabel(value: string): string {
  const compact = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (
    !compact ||
    /https?:\/\/|www\.|authorization|cookie|api[-_ ]?key|(?:^|[^a-z0-9])(?:token|secret)(?:[^a-z0-9]|$)/i.test(compact)
  ) {
    return "Research source";
  }
  const safe = compact.replace(/[^\p{L}\p{N} .()&/+_-]/gu, "").trim().slice(0, 80);
  return safe || "Research source";
}

async function isMcporterAvailable(): Promise<boolean> {
  if (!mcporterAvailablePromise) {
    const command = process.platform === "win32" ? "where.exe" : "which";
    const options: ExecFileOptionsWithStringEncoding = {
      encoding: "utf8",
      timeout: 2_000,
      maxBuffer: 64_000,
      windowsHide: true,
    };
    mcporterAvailablePromise = execFileAsync(command, ["mcporter"], options)
      .then(({ stdout }) => Boolean(stdout.trim()))
      .catch(() => false);
  }
  return mcporterAvailablePromise;
}

async function fetchDirectExaSearch(
  query: string,
  sourceKind: Extract<ResearchSourceKind, "article" | "comment">,
  limit: number,
  apiKey: string
): Promise<ResearchItem[]> {
  return cached(`exa-direct:${sourceKind}:${query}:${limit}`, 20 * 60 * 1000, async () => {
    const body: Record<string, unknown> = {
      query,
      type: "fast",
      numResults: limit,
      moderation: true,
      contents: { highlights: true },
    };
    if (sourceKind === "comment") body.includeDomains = DISCUSSION_DOMAINS;

    const res = await fetchTextWithTimeout(
      EXA_API_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(body),
      },
      { label: `Exa ${sourceKind} search`, timeoutMs: 18_000, maxBytes: 2_000_000 }
    );
    if (!res.ok) throw new Error(`Exa ${sourceKind} search failed: ${res.status}`);
    return parseExaSearchResults(res.text, query, sourceKind).slice(0, limit);
  });
}

function discussionQuery(query: string): string {
  return containsCjk(query) ? `${query} 真实体验 观点 评论 讨论` : `${query} experiences opinions reviews discussion`;
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

/** Accept only genuine external HTTP(S) links; HN self-posts remain discussions. */
function validExternalArticleUrl(value: string): string | undefined {
  const clean = cleanText(value, 500);
  if (!clean) return undefined;
  try {
    const parsed = new URL(clean);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.hostname.toLocaleLowerCase() === "news.ycombinator.com"
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** Choose a returned window that contains the relevance evidence used to admit a story. */
function selectRelevantStorySummary(value: string, title: string, query: string): string {
  const fullText = cleanText(value, 4_000);
  const maxLength = 700;
  if (fullText.length <= maxLength) return fullText;

  const finalStart = Math.max(0, fullText.length - maxLength);
  const starts = new Set<number>([0, finalStart]);
  for (let start = Math.floor(maxLength / 2); start < finalStart; start += Math.floor(maxLength / 2)) {
    starts.add(start);
  }
  for (const start of [...starts].sort((a, b) => a - b)) {
    const candidate = cleanText(fullText.slice(start, start + maxLength), maxLength);
    if (isRelevantText(`${title} ${candidate}`, query)) return candidate;
  }
  return cleanText(fullText, maxLength);
}

/** Require retrieved material to share enough meaningful terms with the topic. */
export function isRelevantText(content: string, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;

  const haystack = normalizeForRelevance(content);
  const latinTokens = new Set(
    (haystack.match(/[a-z0-9]+(?:[_+.-][a-z0-9]+)*/g) ?? []).map(stemEnglishToken)
  );
  const matched = tokens.filter((token) =>
    /^[a-z0-9]/i.test(token) ? latinTokens.has(token) : haystack.includes(token)
  );
  const required = tokens.length <= 3 ? tokens.length : Math.ceil(tokens.length * 0.6);
  return matched.length >= required;
}

/** Check a normalized research item against its requested topic. */
export function isRelevantResearchItem(item: ResearchItem, query: string): boolean {
  return isRelevantText([item.title, item.summary, item.excerpt ?? ""].join(" "), query);
}

function queryTokens(value: string): string[] {
  const stop = new Set([
    "about", "after", "article", "from", "into", "latest", "review", "reviews", "that", "the", "their",
    "this", "what", "when", "where", "which", "with", "如何", "怎么", "为什么", "相关", "文章", "评论", "最新",
  ]);
  const raw = normalizeForRelevance(value).match(/[a-z0-9]+(?:[_+.-][a-z0-9]+)*|[\p{Script=Han}]{2,}/gu) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    if (stop.has(token)) continue;
    if (/^[\p{Script=Han}]+$/u.test(token)) {
      tokens.push(...hanRelevanceTokens(token));
    } else if (token.length >= 2) {
      tokens.push(stemEnglishToken(token));
    }
  }
  return [...new Set(tokens)];
}

/** Build overlapping Han bigrams after removing common grammatical glue. */
function hanRelevanceTokens(value: string): string[] {
  const functionWords = ["为什么", "怎么样", "如何", "怎么", "什么", "哪些", "对于", "关于", "以及", "由于", "因此", "是否"];
  let normalized = value;
  for (const word of functionWords) normalized = normalized.replaceAll(word, "");

  const functionChars = new Set(["的", "了", "和", "与", "及", "在", "对", "为", "将", "会", "是", "把", "被", "让", "从", "向", "中"]);
  const chars = [...normalized].filter((char) => !functionChars.has(char));
  if (chars.length < 2) return [];
  if (chars.length === 2) return [chars.join("")];

  const bigrams: string[] = [];
  for (let index = 0; index < chars.length - 1; index += 1) {
    bigrams.push(`${chars[index]}${chars[index + 1]}`);
  }
  return bigrams;
}

function normalizeForRelevance(value: string): string {
  let normalized = value.toLocaleLowerCase();
  for (const group of RELEVANCE_ALIASES) {
    for (const alias of [...group.aliases].sort((a, b) => b.length - a.length)) {
      const pattern = /^[a-z0-9 ]+$/i.test(alias)
        ? new RegExp(`\\b${escapeRegExp(alias).replace(/\\ /g, "\\s+")}\\b`, "gi")
        : new RegExp(escapeRegExp(alias), "gu");
      normalized = normalized.replace(pattern, ` ${group.canonical} `);
    }
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function stemEnglishToken(token: string): string {
  if (!/^[a-z]+$/i.test(token) || token.length < 4) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) {
    const stem = token.slice(0, -3);
    return stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem;
  }
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeAuthors(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(asString).map((author) => cleanText(author, 120)).filter(Boolean);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanText(value: string, maxLength: number): string {
  const cleaned = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(x?[0-9a-f]+);/gi, (entity, code: string) => decodeNumericEntity(entity, code))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function decodeNumericEntity(entity: string, code: string): string {
  const value = code.toLowerCase().startsWith("x")
    ? Number.parseInt(code.slice(1), 16)
    : Number.parseInt(code, 10);
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
}
