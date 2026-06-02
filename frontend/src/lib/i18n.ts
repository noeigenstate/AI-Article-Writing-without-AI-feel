/** Supported UI languages. */
export type Lang = "en" | "zh";

const STORAGE_KEY = "speak-plainly-lang";

/**
 * Read the persisted UI language from localStorage.
 *
 * @returns The stored language, or "en" if none/invalid.
 */
export function getStoredLang(): Lang {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "zh") return v;
  }
  return "en";
}

/**
 * Persist the chosen UI language to localStorage.
 *
 * @param lang The language to store.
 */
export function storeLang(lang: Lang): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, lang);
}

/** The full UI string dictionary; one implementation per language. */
export interface Dict {
  tagline: string;
  langToggle: string;
  // header
  modeRewrite: string;
  modeGenerate: string;
  polishAll: string;
  exportWord: string;
  restart: string;
  styleProfile: string;
  editorHint: string;
  // upload panel
  uploadTitle: string;
  chooseFile: string;
  noFileChosen: string;
  chooseStyleTitle: string;
  styleHint: string;
  styleNone: string;
  uploadSamples: string;
  selectedSamples: (n: number) => string;
  noSamples: string;
  uploadAndParse: string;
  // article generator
  lengthRegular: string;
  lengthShort: string;
  lengthLong: string;
  genStep1: string;
  titlePlaceholder: string;
  generating: string;
  generateByTitle: string;
  customDomain: string;
  customDomainDesc: string;
  customDomainPlaceholder: string;
  genStep2: string;
  defaultTone: string;
  autoTopics: string;
  researching: string;
  researchBtn: string;
  enterTitleErr: string;
  currentDomain: (name: string) => string;
  generatingNote: string;
  researchHead: string;
  sourceCount: (n: number) => string;
  unavailableSources: (list: string) => string;
  generateArticleBtn: string;
  // doc editor / popover
  clickRetitle: string;
  clickRephrase: string;
  viewSource: string;
  rephraseHeading: string;
  retitleHeading: string;
  close: string;
  originalLabel: string;
  loadingCandidates: string;
  noCandidates: string;
  manualEdit: string;
  adopt: string;
  // ai score
  scoreTitle: string;
  scoreBefore: string;
  scoreAfter: string;
  scoreDrop: (n: number) => string;
  scoreHint: string;
  scoreCurrent: string;
  scoreLevelLow: string;
  scoreLevelMedium: string;
  scoreLevelHigh: string;
  scoreStatsTitle: string;
  scoreColTell: string;
  scoreFound: (n: number) => string;
  scoreRemoved: (n: number) => string;
  scoreClean: string;
  rescore: string;
  // store busy
  busyParsing: string;
  busyGenerating: string;
  busyMatching: string;
  busyRewriting: string;
  busyExporting: string;
  // locale for dates
  dateLocale: string;
}

const en: Dict = {
  tagline: "Write like a human, not a bot.",
  langToggle: "中文",
  modeRewrite: "Rewrite Word",
  modeGenerate: "Generate article",
  polishAll: "Polish whole doc (de-AI)",
  exportWord: "Export Word",
  restart: "Start over",
  styleProfile: "Extracted style profile",
  editorHint: "Click any sentence → pick an alternative or edit by hand. When done, click “Export Word”.",
  uploadTitle: "Upload the Word file to rewrite",
  chooseFile: "Choose file",
  noFileChosen: "No file chosen",
  chooseStyleTitle: "Choose a rewrite style",
  styleHint: "Use a built-in style, or upload your own samples, or stack both.",
  styleNone: "None (de-AI only) / use samples below",
  uploadSamples: "Upload samples",
  selectedSamples: (n) => `${n} sample${n > 1 ? "s" : ""} selected`,
  noSamples: "None chosen (optional, .docx / .txt)",
  uploadAndParse: "Upload & parse",
  lengthRegular: "Regular",
  lengthShort: "Short",
  lengthLong: "Long",
  genStep1: "Enter a title or pick a domain",
  titlePlaceholder: "Type a title; AI picks the domain and writes the article",
  generating: "Generating…",
  generateByTitle: "Generate from title",
  customDomain: "Custom domain",
  customDomainDesc: "Enter the niche you want to write about",
  customDomainPlaceholder: "e.g. EVs, local life, mental health",
  genStep2: "Generate and pick a topic",
  defaultTone: "Default tone",
  autoTopics: "Auto-generate topics",
  researching: "Searching…",
  researchBtn: "Live sources",
  enterTitleErr: "Please enter an article title",
  currentDomain: (name) => `Current domain: ${name}`,
  generatingNote: "Writing the article — usually 30-90s; you'll land in the editor when it's done.",
  researchHead: "Live sources",
  sourceCount: (n) => `${n} source${n > 1 ? "s" : ""}`,
  unavailableSources: (list) => `Some sources are unavailable: ${list}`,
  generateArticleBtn: "Generate article",
  clickRetitle: "Click to retitle",
  clickRephrase: "Click to rephrase / edit",
  viewSource: "View source",
  rephraseHeading: "Rephrase",
  retitleHeading: "Retitle",
  close: "Close",
  originalLabel: "Original: ",
  loadingCandidates: "Generating alternatives…",
  noCandidates: "No alternatives returned; edit by hand.",
  manualEdit: "Edit by hand:",
  adopt: "Use this",
  scoreTitle: "AI-smell score",
  scoreBefore: "Before",
  scoreAfter: "After",
  scoreDrop: (n) => `−${n}`,
  scoreHint: "Scored locally — your text never leaves this machine.",
  scoreCurrent: "Current",
  scoreLevelLow: "Reads human",
  scoreLevelMedium: "Some AI smell",
  scoreLevelHigh: "Strong AI smell",
  scoreStatsTitle: "Detected patterns",
  scoreColTell: "Pattern",
  scoreFound: (n) => `${n} found`,
  scoreRemoved: (n) => `${n} removed`,
  scoreClean: "No obvious AI tells detected.",
  rescore: "Re-score",
  busyParsing: "Parsing document, extracting style…",
  busyGenerating: "Writing the article…",
  busyMatching: "Matching domain and writing the article…",
  busyRewriting: "Rewriting the whole doc (de-AI), hold on…",
  busyExporting: "Building the Word file…",
  dateLocale: "en-US",
};

const zh: Dict = {
  tagline: "让文字写得像人，也站得住。",
  langToggle: "EN",
  modeRewrite: "改写 Word",
  modeGenerate: "生成文章",
  polishAll: "整篇润色（去 AI 味）",
  exportWord: "导出 Word",
  restart: "重新开始",
  styleProfile: "已提取的风格画像",
  editorHint: "点任意句子 → 选候选表达或手动编辑。改完点「导出 Word」。",
  uploadTitle: "上传待改写的 Word",
  chooseFile: "选择文件",
  noFileChosen: "未选择任何文件",
  chooseStyleTitle: "选择改写风格",
  styleHint: "用内置「我的风格」，或上传范文，或两者叠加。",
  styleNone: "不指定（仅去 AI 味）/ 用下方范文",
  uploadSamples: "上传范文",
  selectedSamples: (n) => `已选 ${n} 篇范文`,
  noSamples: "未选择（可选，.docx / .txt）",
  uploadAndParse: "上传并解析",
  lengthRegular: "常规",
  lengthShort: "短文",
  lengthLong: "长文",
  genStep1: "输入标题或选择领域",
  titlePlaceholder: "输入标题，AI 自动判断领域并生成文章",
  generating: "生成中…",
  generateByTitle: "按标题生成",
  customDomain: "自定义领域",
  customDomainDesc: "输入你想写的垂直方向",
  customDomainPlaceholder: "例如：新能源车、本地生活、心理咨询",
  genStep2: "生成并选择选题",
  defaultTone: "默认口吻",
  autoTopics: "自动生成选题",
  researching: "检索中…",
  researchBtn: "前沿资料",
  enterTitleErr: "请输入文章标题",
  currentDomain: (name) => `当前领域：${name}`,
  generatingNote: "正在生成文章，通常需要 30-90 秒，完成后会自动进入编辑页。",
  researchHead: "前沿资料",
  sourceCount: (n) => `${n} 条来源`,
  unavailableSources: (list) => `部分来源暂不可用：${list}`,
  generateArticleBtn: "一键生成文章",
  clickRetitle: "点击重拟标题",
  clickRephrase: "点击换个说法 / 编辑",
  viewSource: "查看来源",
  rephraseHeading: "换个说法",
  retitleHeading: "重拟标题",
  close: "关闭",
  originalLabel: "原文：",
  loadingCandidates: "生成候选中…",
  noCandidates: "没拿到候选，可手动编辑。",
  manualEdit: "手动编辑：",
  adopt: "采用这段",
  scoreTitle: "AI 味评分",
  scoreBefore: "改写前",
  scoreAfter: "改写后",
  scoreDrop: (n) => `−${n}`,
  scoreHint: "本地评分，文本不出本机。",
  scoreCurrent: "当前",
  scoreLevelLow: "读起来像人",
  scoreLevelMedium: "略有 AI 味",
  scoreLevelHigh: "AI 味较重",
  scoreStatsTitle: "命中痕迹统计",
  scoreColTell: "痕迹类型",
  scoreFound: (n) => `${n} 处`,
  scoreRemoved: (n) => `消除 ${n} 处`,
  scoreClean: "未发现明显的 AI 痕迹。",
  rescore: "重新评分",
  busyParsing: "解析文档、提取风格中…",
  busyGenerating: "正在生成文章…",
  busyMatching: "正在判断领域并生成文章…",
  busyRewriting: "整篇改写中（去 AI 味），稍候…",
  busyExporting: "生成 Word 中…",
  dateLocale: "zh-CN",
};

/** UI strings keyed by language; index with the current {@link Lang}. */
export const messages: Record<Lang, Dict> = { en, zh };
