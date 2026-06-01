import { create } from "zustand";
import {
  uploadFiles,
  rewriteDoc,
  exportDoc,
  fetchStyles,
  fetchArticleDomains,
  generateArticle,
  generateArticleFromTitle,
  type ArticleRenderBlockDTO,
  type ArticleDomainDTO,
  type ParagraphDTO,
  type ResearchBundleDTO,
  type StyleDTO,
  type TargetLength,
  type TopicOptionDTO,
} from "./api.js";

interface State {
  docId: string | null;
  styleSummary: string;
  paragraphs: ParagraphDTO[];
  renderBlocks: ArticleRenderBlockDTO[] | null;
  titleIndex: number;
  step: "upload" | "ready";
  mode: "rewrite" | "generate";
  busy: string | null; // 加载提示文案
  error: string | null;
  styles: StyleDTO[];
  articleDomains: ArticleDomainDTO[];
  research: ResearchBundleDTO | null;

  setMode: (mode: "rewrite" | "generate") => void;
  setResearch: (research: ResearchBundleDTO | null) => void;
  loadStyles: () => Promise<void>;
  loadArticleDomains: () => Promise<void>;
  doUpload: (target: File, refs: File[], styleId: string) => Promise<void>;
  doGenerateArticle: (
    domainId: string,
    customDomain: string,
    topic: TopicOptionDTO,
    styleId: string,
    targetLength: TargetLength
  ) => Promise<void>;
  doGenerateArticleFromTitle: (title: string, styleId: string, targetLength: TargetLength) => Promise<void>;
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
  renderBlocks: null,
  titleIndex: -1,
  step: "upload",
  mode: "rewrite",
  busy: null,
  error: null,
  styles: [],
  articleDomains: [],
  research: null,

  setMode(mode) {
    set({ mode, error: null });
  },

  setResearch(research) {
    set({ research });
  },

  async loadStyles() {
    set({ styles: await fetchStyles() });
  },

  async loadArticleDomains() {
    set({ articleDomains: await fetchArticleDomains() });
  },

  async doUpload(target, refs, styleId) {
    set({ busy: "解析文档、提取风格中…", error: null });
    try {
      const r = await uploadFiles(target, refs, styleId);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: null,
        titleIndex: r.titleIndex,
        research: null,
        step: "ready",
        busy: null,
      });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doGenerateArticle(domainId, customDomain, topic, styleId, targetLength) {
    set({ busy: "正在生成公众号文章…", error: null });
    try {
      const r = await generateArticle(domainId, customDomain, topic, styleId, targetLength);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: r.renderBlocks ?? null,
        titleIndex: r.titleIndex,
        research: r.research ?? null,
        step: "ready",
        busy: null,
      });
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doGenerateArticleFromTitle(title, styleId, targetLength) {
    set({ busy: "正在判断领域并生成公众号文章…", error: null });
    try {
      const r = await generateArticleFromTitle(title, styleId, targetLength);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: r.renderBlocks ?? null,
        titleIndex: r.titleIndex,
        research: r.research ?? null,
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
      set({ paragraphs: r.paragraphs, renderBlocks: null, busy: null });
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
    set({
      docId: null,
      styleSummary: "",
      paragraphs: [],
      renderBlocks: null,
      titleIndex: -1,
      step: "upload",
      busy: null,
      error: null,
      research: null,
    });
  },
}));
