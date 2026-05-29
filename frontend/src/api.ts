export interface ParagraphDTO {
  index: number;
  kind: string;
  original: string;
  rewritten?: string;
  sentences: string[];
}

const BASE = "/api";

export async function uploadFiles(target: File, references: File[]) {
  const fd = new FormData();
  fd.append("file", target);
  references.forEach((r) => fd.append("references", r));
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json()).error ?? "上传失败");
  return res.json() as Promise<{
    docId: string;
    styleSummary: string;
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
