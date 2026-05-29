import { create } from "zustand";
import {
  uploadFiles,
  rewriteDoc,
  exportDoc,
  type ParagraphDTO,
} from "./api.js";

interface State {
  docId: string | null;
  styleSummary: string;
  paragraphs: ParagraphDTO[];
  step: "upload" | "ready";
  busy: string | null; // 加载提示文案
  error: string | null;

  doUpload: (target: File, refs: File[]) => Promise<void>;
  doRewrite: () => Promise<void>;
  setSentence: (paraIndex: number, sentenceIdx: number, text: string) => void;
  doExport: () => Promise<void>;
  reset: () => void;
}

export const useStore = create<State>((set, get) => ({
  docId: null,
  styleSummary: "",
  paragraphs: [],
  step: "upload",
  busy: null,
  error: null,

  async doUpload(target, refs) {
    set({ busy: "解析文档、提取风格中…", error: null });
    try {
      const r = await uploadFiles(target, refs);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        step: "ready",
        busy: null,
      });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doRewrite() {
    const { docId } = get();
    if (!docId) return;
    set({ busy: "整篇改写中（去 AI 味），稍候…", error: null });
    try {
      const r = await rewriteDoc(docId);
      set({ paragraphs: r.paragraphs, busy: null });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  setSentence(paraIndex, sentenceIdx, text) {
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        p.index === paraIndex
          ? { ...p, sentences: p.sentences.map((x, i) => (i === sentenceIdx ? text : x)) }
          : p
      ),
    }));
  },

  async doExport() {
    const { docId, paragraphs } = get();
    if (!docId) return;
    set({ busy: "生成 Word 中…", error: null });
    try {
      const texts: Record<number, string> = {};
      for (const p of paragraphs) texts[p.index] = p.sentences.join("");
      await exportDoc(docId, texts);
      set({ busy: null });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  reset() {
    set({ docId: null, styleSummary: "", paragraphs: [], step: "upload", busy: null, error: null });
  },
}));
