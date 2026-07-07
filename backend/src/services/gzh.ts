/**
 * 微信公众号排版引擎（整合自 gzh-design-skill，AGPL-3.0，见 assets/gzh/LICENSE）。
 *
 * 把 Markdown 文章转换为可直接粘贴进公众号编辑器、粘贴后样式不丢失的 HTML：
 * 主题组件库（assets/gzh/theme-*.md）+ 通用增量库作为提示词素材，按章节分块
 * 生成、逐块校验（{@link validateGzhHtml}）并对违规块做一轮自动修复，最后统一
 * 包进该主题的全局容器。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chat } from "./llm.js";
import { validateGzhHtml, type GzhValidation } from "./gzhValidate.js";
import type { Lang } from "../core/i18n.js";

/** 一套已注册的排版主题（对应 assets/gzh/theme-index.md 的一行）。 */
export interface GzhTheme {
  id: string;
  name: { en: string; zh: string };
  /** 主色（前端色卡展示用）。 */
  primary: string;
  /** 点缀色（可选，前端色卡展示用）。 */
  accent?: string;
  scene: { en: string; zh: string };
  /** 组件库文件名（assets/gzh/ 下）。 */
  file: string;
  /** 正文关键词下划线 CSS（theme-index 为单一权威来源）。 */
  underline: string;
}

/** 主题清单，与 assets/gzh/theme-index.md 保持同步；首个为默认推荐。 */
export const GZH_THEMES: GzhTheme[] = [
  {
    id: "moyu-green",
    name: { zh: "翡翠清新", en: "Emerald Fresh" },
    primary: "#059669",
    scene: {
      zh: "教程、测评、清单、工具盘点（信息密度高，默认推荐）",
      en: "Tutorials, reviews, checklists, tool roundups (info-dense; default)",
    },
    file: "theme-moyu-green.md",
    underline: "border-bottom:2px solid #A7F3D0;font-weight:600;",
  },
  {
    id: "red-white",
    name: { zh: "红白杂志", en: "Red Editorial" },
    primary: "#DC2626",
    scene: {
      zh: "深度分析、观点、力量感话题（经典编辑风，红色克制点睛）",
      en: "Deep analysis and opinion pieces (classic editorial, restrained red)",
    },
    file: "theme-red-white.md",
    underline: "border-bottom:2px solid #FECACA;font-weight:600;",
  },
  {
    id: "graphite-minimal",
    name: { zh: "石墨极简", en: "Graphite Minimal" },
    primary: "#52525B",
    scene: {
      zh: "设计、科技评论、专业观点、高端品牌（极简克制、全灰阶）",
      en: "Design and tech commentary, premium brands (minimal, all-gray)",
    },
    file: "theme-graphite-minimal.md",
    underline: "border-bottom:2px solid #52525B;font-weight:600;",
  },
  {
    id: "zen-whitespace",
    name: { zh: "禅意留白", en: "Zen Whitespace" },
    primary: "#4A5D52",
    scene: {
      zh: "禅意冥想、极简生活、深度随笔（呼吸感最强）",
      en: "Mindful essays and minimal living (maximum breathing room)",
    },
    file: "theme-zen-whitespace.md",
    underline: "border-bottom:1.5px solid #B5C8BC;font-weight:500;",
  },
  {
    id: "moyu-ticket",
    name: { zh: "创意票据", en: "Ticket Stub" },
    primary: "#059669",
    scene: {
      zh: "测评、工具对比、创意评测（票据视觉隐喻，星级+硬阴影卡片）",
      en: "Reviews and tool comparisons (ticket-stub metaphor, star ratings)",
    },
    file: "theme-moyu-ticket.md",
    underline: "border-bottom:2px solid #A7F3D0;font-weight:600;",
  },
  {
    id: "olive-journal",
    name: { zh: "橄榄内刊", en: "Olive Journal" },
    primary: "#1e1f23",
    accent: "#ed7b2f",
    scene: {
      zh: "内刊手记、深度评测、案例复盘（编辑部内刊质感，信息密度偏高）",
      en: "Journal-style deep dives and case retrospectives (editorial zine feel)",
    },
    file: "theme-olive-journal.md",
    underline: "border-bottom:2px solid #ed7b2f;font-weight:600;",
  },
];

/** 前端主题卡片 DTO。 */
export interface GzhThemeDTO {
  id: string;
  name: string;
  primary: string;
  accent?: string;
  scene: string;
}

/** 列出可选主题（本地化名称与适用场景）。 */
export function listGzhThemes(lang: Lang): GzhThemeDTO[] {
  return GZH_THEMES.map((t) => ({
    id: t.id,
    name: t.name[lang],
    primary: t.primary,
    accent: t.accent,
    scene: t.scene[lang],
  }));
}

export interface GzhFormatInput {
  markdown: string;
  themeId: string;
  /** 署名；留空则省略文末签名区。 */
  author?: string;
  lang: Lang;
}

export interface GzhFormatResult {
  /** 干净正文片段（`<section>…</section>`，可直接粘贴/包预览壳）。 */
  html: string;
  title: string;
  themeId: string;
  themeName: string;
  validation: GzhValidation;
}

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "gzh");
const assetCache = new Map<string, string>();

function readAsset(file: string): string {
  let text = assetCache.get(file);
  if (text === undefined) {
    text = readFileSync(path.join(ASSET_DIR, file), "utf8");
    assetCache.set(file, text);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Markdown 结构解析
// ---------------------------------------------------------------------------

interface GzhSection {
  /** `##` 章节标题；无标题的开场正文为 undefined。 */
  heading?: string;
  body: string;
}

interface GzhArticleStructure {
  title: string;
  /** 开头引言（首个 `>` 块），无则为 ""。 */
  intro: string;
  sections: GzhSection[];
}

/** 解析 Markdown 为 标题/引言/章节 结构；纯文本时把首行当标题。 */
export function parseGzhStructure(markdown: string): GzhArticleStructure {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let intro = "";
  const sections: GzhSection[] = [];
  let current: GzhSection = { body: "" };
  let seenContent = false;

  const pushCurrent = () => {
    current.body = current.body.trim();
    if (current.heading !== undefined || current.body) sections.push(current);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!title && /^#\s+/.test(trimmed)) {
      title = trimmed.replace(/^#\s+/, "").trim();
      continue;
    }
    if (!seenContent && !intro && /^>\s?/.test(trimmed) && trimmed.replace(/^>\s?/, "")) {
      // 收集开头连续的引用块作为引言
      const quote: string[] = [];
      let j = i;
      while (j < lines.length && /^>\s?/.test(lines[j].trim())) {
        quote.push(lines[j].trim().replace(/^>\s?/, ""));
        j++;
      }
      intro = quote.join("\n").trim();
      i = j - 1;
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      pushCurrent();
      current = { heading: trimmed.replace(/^##\s+/, "").trim(), body: "" };
      seenContent = true;
      continue;
    }
    if (trimmed) seenContent = true;
    current.body += `${line}\n`;
  }
  pushCurrent();

  if (!title) {
    // 纯文本输入：首个非空短行当标题，否则留空由调用方兜底
    const first = sections[0]?.body.split("\n").find((l) => l.trim());
    if (first && first.trim().length <= 60 && sections[0]) {
      title = first.trim().replace(/^#+\s*/, "");
      sections[0].body = sections[0].body.replace(first, "").trim();
      if (!sections[0].body && sections[0].heading === undefined) sections.shift();
    }
  }
  return { title: title || "未命名文章", intro, sections };
}

// ---------------------------------------------------------------------------
// 分块计划
// ---------------------------------------------------------------------------

interface GzhChunk {
  /** 交给模型的任务说明。 */
  task: string;
  /** 本块对应的 Markdown 内容（可为空，如纯封面块）。 */
  md: string;
}

const MAX_CHUNK_CHARS = 1800;

/** 把过长章节正文按空行拆成 ≤{@link MAX_CHUNK_CHARS} 的块。 */
function splitBody(body: string): string[] {
  if (body.length <= MAX_CHUNK_CHARS) return [body];
  const blocks = body.split(/\n{2,}/);
  const out: string[] = [];
  let cur = "";
  for (const b of blocks) {
    if (cur && cur.length + b.length + 2 > MAX_CHUNK_CHARS) {
      out.push(cur);
      cur = b;
    } else {
      cur = cur ? `${cur}\n\n${b}` : b;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const CONCLUSION_RE = /总结|结语|最后|写在最后|尾声|小结|结论|展望/;

function buildChunks(doc: GzhArticleStructure, author: string): GzhChunk[] {
  const chunks: GzhChunk[] = [];
  const numbered = doc.sections.filter((s) => s.heading !== undefined);

  chunks.push({
    task:
      "生成文章开篇：按主题库骨架依次生成封面/头图组件（填入文章标题）" +
      (numbered.length >= 2 ? "、目录/导读组件（若主题库有：从全部章节中精选最多 3 个核心看点，不是全量列表）" : "") +
      (doc.intro
        ? "、开头引言卡（填入下方引言内容，识别其中核心词做高亮标记；署名按文章作者，没有明确作者就省略落款）"
        : "") +
      "。只生成这些开篇组件，不要生成章节正文。",
    md: doc.intro,
  });

  let num = 0;
  doc.sections.forEach((section, idx) => {
    const isLast = idx === doc.sections.length - 1;
    if (section.heading === undefined) {
      for (const part of splitBody(section.body)) {
        chunks.push({
          task: "生成一段无章节标题的正文：按映射规则逐段转换，不要生成章节标题组件、封面或签名。",
          md: part,
        });
      }
      return;
    }
    num += 1;
    const label = String(num).padStart(2, "0");
    const conclusion = isLast && CONCLUSION_RE.test(section.heading);
    const parts = splitBody(section.body);
    parts.forEach((part, pi) => {
      const head =
        pi === 0
          ? `生成第 ${num} 章：章节标题「${section.heading}」用主题库章节标题组件，编号 ${
              conclusion ? "用主题库的结语编号变体（如 ∞；主题库未指定变体则用 " + label + "）" : label
            }，有英文标签槽位时配贴切的英文标签。然后按映射规则转换本章正文。`
          : `继续第 ${num} 章「${section.heading}」的正文（章节标题组件已生成过，不要重复），按映射规则逐段转换。`;
      chunks.push({ task: `${head}不要生成封面、目录或签名。`, md: part });
    });
  });

  if (author) {
    chunks.push({
      task:
        `生成文末作者签名区（全文仅此一处）：用主题库的签名/结尾组件，署名「${author}」，` +
        "第一句作者介绍围绕署名展开，第二句保留互动引导（点赞、在看、转发三连）。不要再生成其它内容。",
      md: "",
    });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// 提示词与装配
// ---------------------------------------------------------------------------

function buildSystemPrompt(theme: GzhTheme): string {
  const themeMd = readAsset(theme.file);
  const commonMd = readAsset("common-components.md");
  return [
    "你是微信公众号文章排版引擎。任务：把给定的 Markdown 片段转换为可直接粘贴进公众号编辑器、粘贴后样式不丢失的 HTML 片段。",
    "",
    "【平台红线（违反即失败）】",
    "- 禁止：<style>/<script>/<div>/<link>、class/id 属性、position:fixed/absolute/sticky、float、@media/@keyframes/@import、display:grid、CSS 变量 var(--x)、外部字体。",
    '- 必须：所有样式内联 style；所有文字节点都用 <span leaf="">文字</span> 包裹（漏包裹＝粘贴后样式丢失）。',
    "- 可用：display:flex（有限）、linear-gradient、border-radius、box-shadow、<section>/<p>/<span>/<strong>/<img>/<h3>。",
    "",
    "【排版规则】",
    "1. HTML 一律取用下方组件库并按其映射规则填充，不要凭记忆手写新组件；只用本主题 + 通用增量库，不跨主题混用。",
    `2. 正文关键词下划线（核心特色）：每个正文段落找出 1–3 个最重要短语（4–15 字），用 <span style="${theme.underline}"> 标记；优先核心观点、结论、关键数据、专有名词；整段无要点可不标。`,
    "3. 最强锚点（主色加粗/深底白字）全文 ≤5 处，不要滥用。",
    "4. 中文全角标点：正文一律用，。！？：；“”‘’（）——…，不用半角 , . ! ? ; 和英文直引号；代码块/行内代码/URL/英文专名内部保持原样。",
    "5. 图片 <img> 一律 max-width:100%;height:auto;display:block;margin:0 auto，不要 width:100%；只有真给了说明文字才生成说明组件；不要编造图片 URL；【插入…】等待补素材用通用库 2c 居中占位板块。",
    '6. 代码/命令/Prompt 用通用库代码块组件：每行一个 <p style="margin:0">，禁用 white-space:pre，缩进用全角空格。',
    "7. 强调小标题用小标签/左竖条（通用库 3a–3e），不要用四周虚线框；主题库明确定义的虚线组件除外。",
    "8. 不得增删原文实质内容：每个段落、每张图、每个列表项都要转换，不得遗漏。",
    "9. 组件里的示例文案（作者名如“摸鱼小李/甲木”、示例日期、示例标签等）必须替换成本文实际信息：日期用【文章信息】给的当前日期；没有提供署名就删掉作者栏/署名元素，绝不保留示例人名。",
    "",
    "【输出格式】只输出 HTML 片段本身：不要 Markdown 代码围栏，不要任何解释文字，不要 <!DOCTYPE>/<html>/<head>/<body>，也不要主题的全局容器（外层容器由系统统一包裹）。",
    "",
    `【主题组件库：${theme.name.zh}】`,
    themeMd,
    "",
    "【通用增量组件库（代码块 / 图片·GIF / 小标签，换成本主题主色使用）】",
    commonMd,
  ].join("\n");
}

function buildChunkPrompt(doc: GzhArticleStructure, chunk: GzhChunk, author: string): string {
  const headings = doc.sections
    .filter((s) => s.heading !== undefined)
    .map((s, i) => `${String(i + 1).padStart(2, "0")} ${s.heading}`)
    .join(" / ");
  const now = new Date();
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  return [
    "【文章信息】",
    `标题：${doc.title}`,
    headings ? `全部章节：${headings}` : "（本文无章节标题）",
    `当前日期：${date}`,
    author ? `署名：${author}` : "署名：（未提供——删除组件中的作者栏/署名元素，不要用示例人名）",
    "",
    `【本次任务】${chunk.task}`,
    chunk.md ? `\n【本段 Markdown】\n${chunk.md}` : "",
  ].join("\n");
}

/** 剥掉模型可能带上的围栏/文档外壳/解释文字，只留 HTML 片段。 */
function sanitizeChunkHtml(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();
  s = s.replace(/<\/?(?:!DOCTYPE|html|head|body)[^>]*>/gi, "");
  const first = s.indexOf("<");
  const lastIdx = s.lastIndexOf(">");
  if (first > 0) s = s.slice(first);
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s.trim();
}

/** 从主题库"组件 1 全局容器"取容器首尾；取不到则用中性兜底容器。 */
function extractContainer(theme: GzhTheme): { open: string; close: string } {
  const md = readAsset(theme.file);
  const m = md.match(/##[^\n]*全局容器[\s\S]*?```html\s*\n([\s\S]*?)```/);
  if (m) {
    const html = m[1].trim();
    const cm = html.match(/^([\s\S]*?)<!--[\s\S]*?-->([\s\S]*)$/);
    if (cm && cm[1].trim() && cm[2].trim()) {
      return { open: cm[1].trim(), close: cm[2].trim() };
    }
  }
  return {
    open:
      '<section style="max-width:677px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Hiragino Sans GB\',\'Microsoft YaHei\',sans-serif;color:#374151;line-height:1.75;letter-spacing:0.5px;overflow-x:hidden;">',
    close: "</section>",
  };
}

const MAX_INPUT_CHARS = 30_000;

/**
 * 把一篇 Markdown 文章排版为公众号 HTML。
 *
 * 按章节分块调用模型（主题组件库进 system 提示词，可被服务端前缀缓存命中），
 * 每块先剥壳再校验，违规块做一轮修复；最后包全局容器并整体复检。
 *
 * @throws Error 当输入为空/超长、主题不存在、或模型返回空时。
 */
export async function formatGzhArticle(input: GzhFormatInput): Promise<GzhFormatResult> {
  const markdown = input.markdown.trim();
  if (!markdown) throw new Error(input.lang === "zh" ? "请输入要排版的文章内容" : "Article content is empty.");
  if (markdown.length > MAX_INPUT_CHARS) {
    throw new Error(
      input.lang === "zh"
        ? `文章过长（${markdown.length} 字），请控制在 ${MAX_INPUT_CHARS} 字以内`
        : `Article too long (${markdown.length} chars); keep it under ${MAX_INPUT_CHARS}.`
    );
  }
  const theme = GZH_THEMES.find((t) => t.id === input.themeId) ?? GZH_THEMES[0];
  const doc = parseGzhStructure(markdown);
  const author = input.author?.trim() ?? "";
  const chunks = buildChunks(doc, author);
  const system = buildSystemPrompt(theme);

  const rendered: string[] = [];
  for (const chunk of chunks) {
    let html = sanitizeChunkHtml(
      await chat(buildChunkPrompt(doc, chunk, author), { system, temperature: 0.4, maxTokens: 7000 })
    );
    if (!html) throw new Error(input.lang === "zh" ? "模型返回为空，请重试" : "Model returned empty output; try again.");
    const check = validateGzhHtml(html);
    if (check.errors.length) {
      const fixed = sanitizeChunkHtml(
        await chat(
          [
            "下面这段公众号 HTML 违反了平台规则，请修复后重新输出完整 HTML 片段（不要解释、不要围栏）：",
            ...check.errors.map((e) => `- ${e}`),
            "",
            html,
          ].join("\n"),
          { system, temperature: 0.2, maxTokens: 7000 }
        )
      );
      if (fixed && validateGzhHtml(fixed).errors.length <= check.errors.length) html = fixed;
    }
    rendered.push(html);
  }

  const container = extractContainer(theme);
  const body = `${container.open}\n${rendered.join("\n")}\n${container.close}`
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n");
  const validation = validateGzhHtml(body);
  return {
    html: body,
    title: doc.title,
    themeId: theme.id,
    themeName: theme.name[input.lang],
    validation,
  };
}
