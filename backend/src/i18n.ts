/**
 * 后端语言支持。前端通过请求里的 `lang` 字段传入；缺省回退到英文。
 * Backend language support. Frontend passes `lang` per request; falls back to English.
 */

export type Lang = "en" | "zh";

export function normalizeLang(value: unknown): Lang {
  return value === "zh" ? "zh" : "en";
}

type Bi = { en: string; zh: string };

/** API 错误信息 / API error messages */
export const SERVER_MESSAGES = {
  missingTopic: { en: "Missing topic.", zh: "缺少选题 topic" },
  missingTitle: { en: "Missing article title.", zh: "缺少文章标题 title" },
  titleTooLong: {
    en: "Title is too long; keep it under 120 characters.",
    zh: "标题太长，请控制在 120 字以内",
  },
  missingFile: { en: "Missing target file (field: file).", zh: "缺少目标文件 file" },
  docNotFound: { en: "Document not found or expired.", zh: "文档不存在或已过期" },
} satisfies Record<string, Bi>;

/** 生成文章里的结构性文案（标题、表格、图注等） / Structural labels in generated articles */
export const ARTICLE_LABELS = {
  references: { en: "References", zh: "参考文献" },
  evidenceTableTitle: {
    en: "Table 1. Key evidence and sources",
    zh: "表1 主要证据与出处",
  },
  evidenceTableNote: {
    en: "Note: evidence is limited to public sources found in this search; claims may not exceed this material.",
    zh: "注：表中论据只来自本次检索到的公开来源；正文判断不得超出这些材料。",
  },
  evidenceTableEmpty: {
    en: "No usable sources were returned in this search; the article must not state specific data claims.",
    zh: "本次检索没有返回可用资料，文章不得写具体数据判断。",
  },
  typePaper: { en: "Paper", zh: "论文" },
  typeNews: { en: "News", zh: "新闻" },
  figureSourceTitle: { en: "Figure 1. Source image", zh: "图1 来源图片" },
  figureChainTitle: { en: "Figure 1. Evidence chain", zh: "图1 证据链路图" },
  figureChainCaption: {
    en: "Figure 1. Argument chain built from retrieved sources. Every claim must map back to a source; do not present speculation as fact.",
    zh: "图1 基于检索来源形成的论证链路。每个判断必须回到对应来源，不能把推测写成事实。",
  },
  noLiveSource: { en: "No live source available", zh: "无可用实时来源" },
  needSecondSource: { en: "A second source is needed", zh: "需补充第二来源" },
  conclusionNode: {
    en: "State only what the material supports",
    zh: "只给出材料能支撑的结论",
  },
  defaultAudience: { en: "general readers", zh: "公众号读者" },
  titleAngle: {
    en: "Develop around the user's title; domain auto-matched to: ",
    zh: "围绕用户标题展开，领域自动匹配为：",
  },
  defaultMatch: { en: "default match", zh: "默认匹配" },
  defaultStyleSummary: {
    en: "Article generation: human voice, short sentences first, high information density.",
    zh: "公众号文章生成：去 AI 味、短句优先、信息密度高。",
  },
} satisfies Record<string, Bi>;

/** 证据链节点标签 / evidence-chain node labels */
export const CHAIN_NODE_LABELS = {
  problem: { en: "Problem", zh: "问题" },
  evidence: { en: "Evidence", zh: "证据" },
  crossCheck: { en: "Cross-check", zh: "交叉验证" },
  judgment: { en: "Judgment", zh: "判断" },
} satisfies Record<string, Bi>;

export const EVIDENCE_TABLE_COLUMNS: Record<Lang, string[]> = {
  en: ["Ref", "Type", "Source", "Date", "Verifiable point"],
  zh: ["引用", "类型", "来源", "日期", "可验证论据"],
};

export function tr(entry: Bi, lang: Lang): string {
  return entry[lang];
}
