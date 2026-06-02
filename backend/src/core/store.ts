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
}

/** In-memory document store keyed by generated id. */
const store = new Map<string, DocRecord>();

/**
 * Store a document and assign it a fresh id.
 *
 * @param rec The document fields (without id).
 * @returns The stored record, including its new id.
 */
export function saveDoc(rec: Omit<DocRecord, "id">): DocRecord {
  const id = randomUUID();
  const full = { id, ...rec };
  store.set(id, full);
  return full;
}

/**
 * Look up a previously stored document.
 *
 * @param id The document id.
 * @returns The record, or undefined if unknown/expired.
 */
export function getDoc(id: string): DocRecord | undefined {
  return store.get(id);
}
