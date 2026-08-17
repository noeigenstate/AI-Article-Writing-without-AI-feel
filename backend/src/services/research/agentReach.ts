import { execFile, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { promisify } from "node:util";
import { cached } from "./cache.js";
import { inferPublisherName, inferPublisherRegion } from "./rss.js";
import { normalizePublicSourceUrl } from "./networkSafety.js";
import type { ResearchItem, ResearchSourceKind } from "./types.js";

const execFileAsync = promisify(execFile);
const SOURCE_ID = "agent-reach-exa";

export interface McporterInvocation {
  executable: "mcporter";
  args: readonly ["call", string];
  options: ExecFileOptionsWithStringEncoding;
}

interface AgentReachRawResult {
  title?: unknown;
  url?: unknown;
  text?: unknown;
  summary?: unknown;
  snippet?: unknown;
  publishedDate?: unknown;
  publishedAt?: unknown;
  author?: unknown;
  authors?: unknown;
}

/** Parse Exa/MCP output collected through Agent-Reach's selected search backend. */
export function parseAgentReachSearchOutput(
  output: string,
  query: string,
  sourceKind: Extract<ResearchSourceKind, "article" | "comment"> = "article"
): ResearchItem[] {
  const parsed = parseUnknownJson(output);
  const results = findResultArray(parsed);
  if (!results) {
    return [];
  }

  return results
    .map((result) => normalizeResult(result, query, sourceKind))
    .filter((item): item is ResearchItem => Boolean(item));
}

/** Collect web search results via Agent-Reach's Exa/mcporter backend when available. */
export function fetchAgentReachSearch(
  query: string,
  limit = 6,
  sourceKind: Extract<ResearchSourceKind, "article" | "comment"> = "article"
): Promise<ResearchItem[]> {
  // Agent-Reach currently exposes mcporter as a command shim on Windows. Node
  // cannot execute that shim without cmd.exe, and passing user text through a
  // shell is not an acceptable boundary, so this optional fallback is disabled.
  if (process.platform === "win32") {
    return Promise.resolve([]);
  }

  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) {
    return Promise.resolve([]);
  }
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(Number.isFinite(limit) ? limit : 6)));

  return cached(`agent-reach:${cleanQuery}:${safeLimit}`, 20 * 60 * 1000, async () => {
    const invocation = buildMcporterInvocation(cleanQuery, safeLimit);
    if (!invocation) {
      return [];
    }
    const { stdout } = await execFileAsync(
      invocation.executable,
      [...invocation.args],
      invocation.options
    );

    return parseAgentReachSearchOutput(stdout, cleanQuery, sourceKind).slice(0, safeLimit);
  });
}

/** Build a shell-free mcporter invocation, or disable this fallback on Windows. */
export function buildMcporterInvocation(
  query: string,
  limit = 6,
  platform: NodeJS.Platform = process.platform
): McporterInvocation | undefined {
  if (platform === "win32") {
    return undefined;
  }
  const cleanQuery = cleanText(query, 240);
  if (!cleanQuery) {
    return undefined;
  }
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(Number.isFinite(limit) ? limit : 6)));
  const expression = `exa.web_search_exa(query: ${JSON.stringify(cleanQuery)}, numResults: ${safeLimit})`;
  return {
    executable: "mcporter",
    args: ["call", expression],
    options: mcporterExecOptions(platform),
  };
}

export function mcporterExecOptions(_platform: NodeJS.Platform = process.platform): ExecFileOptionsWithStringEncoding {
  return {
    encoding: "utf8",
    timeout: 18_000,
    maxBuffer: 1_000_000,
    windowsHide: true,
    shell: false,
  };
}

function normalizeResult(
  raw: unknown,
  query: string,
  sourceKind: Extract<ResearchSourceKind, "article" | "comment">
): ResearchItem | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const result = raw as AgentReachRawResult;
  const title = cleanText(asString(result.title), 180);
  const url = normalizePublicSourceUrl(asString(result.url));
  if (!title || !url) {
    return undefined;
  }

  const excerpt = cleanText(asString(result.text), 280);
  const summary =
    cleanText(asString(result.summary), 700) ||
    cleanText(asString(result.snippet), 700) ||
    excerpt ||
    "";
  const publishedAt = normalizeDate(asString(result.publishedDate) || asString(result.publishedAt));
  const sourceName = inferPublisherName(url);

  return {
    id: `${SOURCE_ID}:${url.trim().toLowerCase()}`,
    sourceKind,
    sourceName,
    sourceId: SOURCE_ID,
    region: inferPublisherRegion(url, sourceName, "global"),
    title,
    summary,
    excerpt: excerpt || undefined,
    url,
    publishedAt,
    authors: normalizeAuthors(result.author ?? result.authors),
    query,
  };
}

function findResultArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["results", "data", "items"]) {
    const direct = value[key];
    if (Array.isArray(direct)) {
      return direct;
    }
  }

  const content = value.content;
  if (Array.isArray(content)) {
    for (const entry of content) {
      if (!isRecord(entry)) {
        continue;
      }
      const text = asString(entry.text);
      if (!text) {
        continue;
      }
      const nested = findResultArray(parseUnknownJson(text));
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function parseUnknownJson(value: string): unknown {
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
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeDate(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeAuthors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).map((author) => cleanText(author, 120)).filter(Boolean);
  }

  const author = cleanText(asString(value), 120);
  return author ? [author] : [];
}
