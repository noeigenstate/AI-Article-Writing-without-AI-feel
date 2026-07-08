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
  // sidebar + hero
  navTools: string;
  heroRewriteTitle: string;
  heroRewriteSub: string;
  heroGenerateTitle: string;
  heroGenerateSub: string;
  editorTitle: string;
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
  sceneLabel: string;
  sceneGeneral: string;
  sceneWechat: string;
  sceneBusiness: string;
  sceneAcademic: string;
  sceneOfficial: string;
  sceneSocial: string;
  sceneTechnical: string;
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
  // gzh export panel (公众号排版)
  gzhPanelTitle: string;
  gzhFormatBtn: string;
  gzhFormatting: string;
  gzhCopyBtn: string;
  gzhCopied: string;
  gzhCopyFail: string;
  gzhDownloadBtn: string;
  gzhValidationOk: string;
  gzhValidationWarn: (n: number) => string;
  gzhValidationErr: (n: number) => string;
  gzhPreviewNote: string;
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
  diagnose: string;
  diagnosisTitle: string;
  diagnosisSummary: string;
  diagnosisSuggestion: string;
  diagnosisExamples: string;
  diagnosisNoExamples: string;
  diagnosisLayer: (layer: string) => string;
  // store busy
  busyParsing: string;
  busyGenerating: string;
  busyMatching: string;
  busyRewriting: string;
  busyExporting: string;
  progressArticleSteps: string[];
  progressArticleFromTitleSteps: string[];
  progressArticleTopicSteps: string[];
  progressRewriteSteps: string[];
  progressTitleCandidateSteps: string[];
  progressGzhSteps: string[];
  progressPercent: (n: number) => string;
  // locale for dates
  dateLocale: string;
}

const en: Dict = {
  tagline: "Write like a human, not a bot.",
  langToggle: "中文",
  navTools: "Tools",
  heroRewriteTitle: "Humanize AI Writing",
  heroRewriteSub:
    "Rewrite AI-flavored drafts into text that reads human. Upload a Word file, polish sentence by sentence, then export.",
  heroGenerateTitle: "Source-Backed Articles",
  heroGenerateSub:
    "Generate an article from a title or domain, grounded in live sources such as arXiv papers and news RSS.",
  editorTitle: "Edit & Polish",
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
  sceneLabel: "Writing scene",
  sceneGeneral: "General",
  sceneWechat: "Newsletter",
  sceneBusiness: "Business",
  sceneAcademic: "Academic / report",
  sceneOfficial: "Formal notice",
  sceneSocial: "Social post",
  sceneTechnical: "Technical docs",
  uploadSamples: "Upload samples",
  selectedSamples: (n) => `${n} sample${n > 1 ? "s" : ""} selected`,
  noSamples: "None chosen (optional, .docx / .txt)",
  uploadAndParse: "Upload & parse",
  lengthRegular: "Regular 850+ words",
  lengthShort: "Short 350-500 words",
  lengthLong: "Long 2200+ words",
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
  gzhPanelTitle: "WeChat formatting",
  gzhFormatBtn: "Auto-format",
  gzhFormatting: "Formatting…",
  gzhCopyBtn: "Copy to WeChat editor",
  gzhCopied: "Copied! Paste with Ctrl/⌘+V in the WeChat editor",
  gzhCopyFail: "Auto-copy failed — select all inside the preview and copy manually",
  gzhDownloadBtn: "Download HTML",
  gzhValidationOk: "Compliance check passed — safe to paste",
  gzhValidationWarn: (n) => `${n} warning${n > 1 ? "s" : ""} to review`,
  gzhValidationErr: (n) => `${n} blocking issue${n > 1 ? "s" : ""} found`,
  gzhPreviewNote: "Preview below renders exactly what gets copied.",
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
  scoreTitle: "Human-likeness score",
  scoreBefore: "Before",
  scoreAfter: "After",
  scoreDrop: (n) => `+${n}`,
  scoreHint: "Scored locally against human-writing signals — your text never leaves this machine.",
  scoreCurrent: "Current",
  scoreLevelLow: "Needs human pass",
  scoreLevelMedium: "Getting natural",
  scoreLevelHigh: "Reads human",
  scoreStatsTitle: "AI tells deducted",
  scoreColTell: "Deduction",
  scoreFound: (n) => `${n} found`,
  scoreRemoved: (n) => `${n} removed`,
  scoreClean: "No obvious AI tells deducted.",
  rescore: "Re-score",
  diagnose: "Diagnose AI tells",
  diagnosisTitle: "Diagnosis report",
  diagnosisSummary: "Summary",
  diagnosisSuggestion: "Suggestion",
  diagnosisExamples: "Evidence",
  diagnosisNoExamples: "No direct phrase evidence; this is a whole-text signal.",
  diagnosisLayer: (layer) =>
    ({
      wording: "Wording",
      sentence: "Sentence",
      structure: "Structure",
      rhythm: "Rhythm",
      evidence: "Evidence",
      format: "Format",
    }[layer] ?? layer),
  busyParsing: "Parsing document, extracting style…",
  busyGenerating: "Writing the article…",
  busyMatching: "Matching domain and writing the article…",
  busyRewriting: "Rewriting the whole doc (de-AI), hold on…",
  busyExporting: "Building the Word file…",
  progressArticleSteps: [
    "Collecting live sources",
    "Drafting the article",
    "Adding citations and evidence",
    "Building the editable document",
    "Still working; keeping the request open",
  ],
  progressArticleFromTitleSteps: [
    "Matching the best domain",
    "Collecting live sources",
    "Drafting the article",
    "Adding citations and evidence",
    "Building the editable document",
  ],
  progressArticleTopicSteps: [
    "Collecting source context",
    "Finding workable angles",
    "Drafting candidate titles",
    "Preparing choices",
  ],
  progressRewriteSteps: [
    "Reading the document structure",
    "Polishing paragraphs",
    "Checking human-likeness score",
    "Preparing the edited document",
  ],
  progressTitleCandidateSteps: [
    "Reading the article context",
    "Drafting title options",
    "Checking tone and length",
    "Preparing title choices",
  ],
  progressGzhSteps: [
    "Parsing the article structure",
    "Laying out cover and intro",
    "Formatting chapters with theme components",
    "Running the compliance check",
    "Assembling the final HTML",
  ],
  progressPercent: (n) => `${n}%`,
  dateLocale: "en-US",
};

const zh: Dict = {
  tagline: "让文字写得像人，也站得住。",
  langToggle: "EN",
  navTools: "工具",
  heroRewriteTitle: "AI 拟人化改写",
  heroRewriteSub: "把 AI 味很重的稿子改写成更像真人写的文字。上传 Word，逐句润色，一键导出。",
  heroGenerateTitle: "AI 文章生成",
  heroGenerateSub: "按标题或领域生成文章，自动引用 arXiv 论文与新闻 RSS 等实时资料。",
  editorTitle: "编辑与润色",
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
  sceneLabel: "文体场景",
  sceneGeneral: "通用",
  sceneWechat: "公众号",
  sceneBusiness: "商务沟通",
  sceneAcademic: "学术/报告",
  sceneOfficial: "公文/正式说明",
  sceneSocial: "社媒短文",
  sceneTechnical: "技术文档",
  uploadSamples: "上传范文",
  selectedSamples: (n) => `已选 ${n} 篇范文`,
  noSamples: "未选择（可选，.docx / .txt）",
  uploadAndParse: "上传并解析",
  lengthRegular: "常规 1000字+",
  lengthShort: "短文 500字",
  lengthLong: "长文 3000字+",
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
  gzhPanelTitle: "公众号排版",
  gzhFormatBtn: "自动排版",
  gzhFormatting: "排版中…",
  gzhCopyBtn: "复制到公众号",
  gzhCopied: "已复制！到公众号编辑器按 Ctrl/⌘+V 粘贴即可",
  gzhCopyFail: "自动复制失败，请在预览里手动全选后复制",
  gzhDownloadBtn: "下载 HTML",
  gzhValidationOk: "合规校验通过，可直接粘贴",
  gzhValidationWarn: (n) => `${n} 条提醒建议检查`,
  gzhValidationErr: (n) => `发现 ${n} 个阻断问题`,
  gzhPreviewNote: "下方预览即最终复制内容。",
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
  scoreTitle: "人类感评分",
  scoreBefore: "改写前",
  scoreAfter: "改写后",
  scoreDrop: (n) => `+${n}`,
  scoreHint: "本地参照人类写作特征评分，文本不出本机。",
  scoreCurrent: "当前",
  scoreLevelLow: "需要人工润色",
  scoreLevelMedium: "逐渐自然",
  scoreLevelHigh: "读起来像人",
  scoreStatsTitle: "AI 痕迹扣分",
  scoreColTell: "扣分项",
  scoreFound: (n) => `${n} 处`,
  scoreRemoved: (n) => `消除 ${n} 处`,
  scoreClean: "未发现明显 AI 痕迹扣分。",
  rescore: "重新评分",
  diagnose: "诊断 AI 味",
  diagnosisTitle: "诊断报告",
  diagnosisSummary: "概览",
  diagnosisSuggestion: "建议",
  diagnosisExamples: "证据",
  diagnosisNoExamples: "这类是全文信号，没有直接短语证据。",
  diagnosisLayer: (layer) =>
    ({
      wording: "用词",
      sentence: "句式",
      structure: "结构",
      rhythm: "节奏",
      evidence: "证据",
      format: "格式",
    }[layer] ?? layer),
  busyParsing: "解析文档、提取风格中…",
  busyGenerating: "正在生成文章…",
  busyMatching: "正在判断领域并生成文章…",
  busyRewriting: "整篇改写中（去 AI 味），稍候…",
  busyExporting: "生成 Word 中…",
  progressArticleSteps: [
    "正在收集前沿资料",
    "正在撰写正文",
    "正在补充引用和证据",
    "正在生成可编辑文档",
    "仍在处理，请保持当前页面",
  ],
  progressArticleFromTitleSteps: [
    "正在匹配最合适的领域",
    "正在收集前沿资料",
    "正在撰写正文",
    "正在补充引用和证据",
    "正在生成可编辑文档",
  ],
  progressArticleTopicSteps: [
    "正在收集资料上下文",
    "正在寻找可写角度",
    "正在生成候选标题",
    "正在整理候选项",
  ],
  progressRewriteSteps: [
    "正在读取文档结构",
    "正在逐段润色",
    "正在检查人味评分",
    "正在准备改写结果",
  ],
  progressTitleCandidateSteps: [
    "正在读取全文上下文",
    "正在生成标题候选",
    "正在检查语气和长度",
    "正在整理标题选项",
  ],
  progressGzhSteps: [
    "正在解析文章结构",
    "正在排版封面与引言",
    "正在按主题组件排版章节",
    "正在做公众号合规校验",
    "正在装配完整排版",
  ],
  progressPercent: (n) => `${n}%`,
  dateLocale: "zh-CN",
};

/** UI strings keyed by language; index with the current {@link Lang}. */
export const messages: Record<Lang, Dict> = { en, zh };
