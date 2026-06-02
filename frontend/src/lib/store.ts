import { create } from "zustand";
import {
  uploadFiles,
  rewriteDoc,
  exportDoc,
  fetchStyles,
  fetchArticleDomains,
  generateArticle,
  generateArticleFromTitle,
  scoreText,
  type ArticleRenderBlockDTO,
  type ArticleDomainDTO,
  type AiScoreDTO,
  type ParagraphDTO,
  type ResearchBundleDTO,
  type StyleDTO,
  type TargetLength,
  type TopicOptionDTO,
} from "./api.js";
import { getStoredLang, storeLang, messages, type Lang } from "./i18n.js";

/** The global app state plus the actions that mutate it (Zustand store shape). */
interface State {
  lang: Lang;
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
  aiScore: { before: AiScoreDTO; after: AiScoreDTO } | null; // 改写前后对照
  currentScore: AiScoreDTO | null; // 当前文档（含手动编辑）的实时分

  setLang: (lang: Lang) => void;
  recomputeScore: () => Promise<void>;
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

/**
 * The single Zustand store backing the whole UI.
 *
 * Holds the current document/editor state and exposes async actions that call
 * the API client and update state (upload, generate, rewrite, score, export).
 */
export const useStore = create<State>((set, get) => ({
  lang: getStoredLang(),
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
  aiScore: null,
  currentScore: null,

  async recomputeScore() {
    const { paragraphs, lang } = get();
    const text = paragraphs.map((p) => p.sentences.join("")).join("\n");
    if (!text.trim()) return set({ currentScore: null });
    try {
      set({ currentScore: await scoreText(text, lang) });
    } catch {
      /* 评分失败不阻塞 */
    }
  },

  setLang(lang) {
    storeLang(lang);
    set({ lang });
    // 语言切换后重新拉取本地化的风格/领域列表
    void get().loadStyles();
    void get().loadArticleDomains();
  },

  setMode(mode) {
    set({ mode, error: null });
  },

  setResearch(research) {
    set({ research });
  },

  async loadStyles() {
    set({ styles: await fetchStyles(get().lang) });
  },

  async loadArticleDomains() {
    set({ articleDomains: await fetchArticleDomains(get().lang) });
  },

  async doUpload(target, refs, styleId) {
    set({ busy: messages[get().lang].busyParsing, error: null });
    try {
      const r = await uploadFiles(target, refs, styleId, get().lang);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: null,
        titleIndex: r.titleIndex,
        research: null,
        aiScore: null,
        currentScore: null,
        step: "ready",
        busy: null,
      });
      void get().recomputeScore();
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doGenerateArticle(domainId, customDomain, topic, styleId, targetLength) {
    set({ busy: messages[get().lang].busyGenerating, error: null });
    try {
      const r = await generateArticle(domainId, customDomain, topic, styleId, targetLength, get().lang);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: r.renderBlocks ?? null,
        titleIndex: r.titleIndex,
        research: r.research ?? null,
        aiScore: null,
        currentScore: null,
        step: "ready",
        busy: null,
      });
      void get().recomputeScore();
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doGenerateArticleFromTitle(title, styleId, targetLength) {
    set({ busy: messages[get().lang].busyMatching, error: null });
    try {
      const r = await generateArticleFromTitle(title, styleId, targetLength, get().lang);
      set({
        docId: r.docId,
        styleSummary: r.styleSummary,
        paragraphs: r.paragraphs,
        renderBlocks: r.renderBlocks ?? null,
        titleIndex: r.titleIndex,
        research: r.research ?? null,
        aiScore: null,
        currentScore: null,
        step: "ready",
        busy: null,
      });
      void get().recomputeScore();
    } catch (e) {
      set({ error: (e as Error).message, busy: null });
    }
  },

  async doRewrite() {
    const { docId } = get();
    if (!docId) return;
    set({ busy: messages[get().lang].busyRewriting, error: null });
    try {
      const r = await rewriteDoc(docId, get().lang);
      set({
        paragraphs: r.paragraphs,
        renderBlocks: null,
        aiScore: r.score ?? null,
        currentScore: r.score?.after ?? get().currentScore,
        busy: null,
      });
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
    set({ busy: messages[get().lang].busyExporting, error: null });
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
      aiScore: null,
      currentScore: null,
    });
  },
}));
