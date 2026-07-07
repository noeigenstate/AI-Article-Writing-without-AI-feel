import { execFile, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { promisify } from "node:util";
import { cached } from "./cache.js";
import type { ResearchItem } from "./types.js";

const execFileAsync = promisify(execFile);
const SOURCE_ID = "agent-reach-exa";
const SOURCE_NAME = "Agent-Reach / Exa";

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
export function parseAgentReachSearchOutput(output: string, query: string): ResearchItem[] {
  const parsed = parseUnknownJson(output);
  const results = findResultArray(parsed);
  if (!results) {
    return [];
  }

  return results
    .map((result) => normalizeResult(result, query))
    .filter((item): item is ResearchItem => Boolean(item));
}

/** Collect web search results via Agent-Reach's Exa/mcporter backend when available. */
export function fetchAgentReachSearch(query: string, limit = 6): Promise<ResearchItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return Promise.resolve([]);
  }

  return cached(`agent-reach:${cleanQuery}:${limit}`, 20 * 60 * 1000, async () => {
    const expression = `exa.web_search_exa(query: ${JSON.stringify(cleanQuery)}, numResults: ${limit})`;
    const { stdout } = await execFileAsync("mcporter", ["call", expression], mcporterExecOptions());

    return parseAgentReachSearchOutput(stdout, cleanQuery).slice(0, limit);
  });
}

export function mcporterExecOptions(platform: NodeJS.Platform = process.platform): ExecFileOptionsWithStringEncoding {
  return {
    encoding: "utf8",
    timeout: 18_000,
    maxBuffer: 1_000_000,
    windowsHide: true,
    shell: platform === "win32",
  };
}

function normalizeResult(raw: unknown, query: string): ResearchItem | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const result = raw as AgentReachRawResult;
  const title = cleanText(asString(result.title), 180);
  const url = cleanText(asString(result.url), 400);
  if (!title || !url || !/^https?:\/\//i.test(url)) {
    return undefined;
  }

  const summary =
    cleanText(asString(result.text), 700) ||
    cleanText(asString(result.summary), 700) ||
    cleanText(asString(result.snippet), 700) ||
    "";
  const publishedAt = normalizeDate(asString(result.publishedDate) || asString(result.publishedAt));

  return {
    id: `${SOURCE_ID}:${url.trim().toLowerCase()}`,
    sourceKind: "news",
    sourceName: SOURCE_NAME,
    sourceId: SOURCE_ID,
    title,
    summary,
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
