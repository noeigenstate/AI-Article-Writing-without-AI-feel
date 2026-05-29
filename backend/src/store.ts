import { randomUUID } from "crypto";
import type { ParsedParagraph } from "./services/docx.js";

export interface DocRecord {
  id: string;
  buf: Buffer;                 // 原始 docx，导出时复用以保留格式
  paragraphs: ParsedParagraph[];
  styleSummary: string;
}

const store = new Map<string, DocRecord>();

export function saveDoc(rec: Omit<DocRecord, "id">): DocRecord {
  const id = randomUUID();
  const full = { id, ...rec };
  store.set(id, full);
  return full;
}

export function getDoc(id: string): DocRecord | undefined {
  return store.get(id);
}
