import { create } from "zustand";
import {
  uploadFiles,
  rewriteDoc,
  exportDoc,
  fetchStyles,
  type ParagraphDTO,
  type StyleDTO,
} from "./api.js";

interface State {
  docId: string | null;
  styleSummary: string;
  paragraphs: ParagraphDTO[];
  titleIndex: number;
  step: "upload" | "ready";
  busy: string | null; // 加载提示文案
  error: string | null;
  styles: StyleDTO[];

  loadStyles: () => Promise<void>;
  doUpload: (target: File, refs: File[], styleId: string) => Promise<void>;
  doRewrite: () => Promise<void>;
  setSentence: (paraIndex: number, sentenceIdx: number, text: string) => void;
  setParagraph: (paraIndex: number, text: string) => void;
  doExport: () => Promise<void>;
  reset: () => void;
}

export const useStore = create<State>((set, get) => ({
  docId: null,
  styleSummary: "",
  paragraphs: [],
  titleIndex: -1,
  step: "upload",
  busy: null,
  error: null,
  styles: [],

  async loadStyles() {
    set({ styles: await fetchStyles() });
  },

  async doUpload(target, refs, styleId) {
    set({ busy: "解析文档、提取风格中…", error: null });
    try {
      const r = await uploadFiles(target, refs, styleId);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        titleIndex: r.titleIndex,
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

  setParagraph(paraIndex, text) {
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        p.index === paraIndex ? { ...p, sentences: [text] } : p
      ),
    }));
  },

  async doExport() {
    const { docId, paragraphs } = get();
    if (!docId) return;
    set({ busy: "生成 Word 中…", error: null });
    try {
      // 只发回真正改动过的段落；未改动的段落不传，导出时原样保留（含段内字符级格式）
      const texts: Record<number, string> = {};
      for (const p of paragraphs) {
        const current = p.sentences.join("");
        if (current !== p.original) texts[p.index] = current;
      }
      await exportDoc(docId, texts);
      set({ busy: null });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  reset() {
    set({ docId: null, styleSummary: "", paragraphs: [], titleIndex: -1, step: "upload", busy: null, error: null });
  },
}));
