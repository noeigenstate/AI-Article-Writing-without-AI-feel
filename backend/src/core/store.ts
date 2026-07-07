import { randomUUID } from "crypto";
import type { ParsedParagraph } from "../services/docx.js";

/**
 * An uploaded/generated document held in memory for the editing session.
 *
 * Lives only in process memory and is lost on restart — see README limitations.
 */
export interface DocRecord {
  id: string;
  buf: Buffer; // 原始 docx，导出时复用以保留格式
  paragraphs: ParsedParagraph[];
  styleSummary: string;
  rewriteIndices?: number[];
}

/** In-memory document store keyed by generated id. */
const DOC_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_DOCS = 50;
const store = new Map<string, DocRecord & { savedAt: number; lastAccessedAt: number }>();

/**
 * Store a document and assign it a fresh id.
 *
 * @param rec The document fields (without id).
 * @returns The stored record, including its new id.
 */
export function saveDoc(rec: Omit<DocRecord, "id">): DocRecord {
  pruneExpired();
  const id = randomUUID();
  const now = Date.now();
  const full = { id, ...rec, savedAt: now, lastAccessedAt: now };
  store.set(id, full);
  pruneOverflow();
  return full;
}

/**
 * Look up a previously stored document.
 *
 * @param id The document id.
 * @returns The record, or undefined if unknown/expired.
 */
export function getDoc(id: string): DocRecord | undefined {
  pruneExpired();
  const rec = store.get(id);
  if (rec) {
    rec.lastAccessedAt = Date.now();
  }
  return rec;
}

function pruneExpired(now = Date.now()): void {
  for (const [id, rec] of store) {
    if (now - rec.lastAccessedAt > DOC_TTL_MS) {
      store.delete(id);
    }
  }
}

function pruneOverflow(): void {
  if (store.size <= MAX_DOCS) {
    return;
  }
  const ordered = [...store.entries()].sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
  for (const [id] of ordered.slice(0, store.size - MAX_DOCS)) {
    store.delete(id);
  }
}
