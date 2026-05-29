import JSZip from "jszip";

/**
 * docx 解析与导出。
 *
 * 设计要点：导出时**不从零重建** docx，而是加载原始 docx，只替换每个段落里的文字，
 * 其余 XML（段落样式、列表、字体等）原样保留 —— 这样能在「段落级」上最大程度保真。
 */

export type ParaKind = "heading1" | "heading2" | "heading3" | "list" | "normal";

export interface ParsedParagraph {
  index: number;      // 在文档中的段落序号（与导出对齐）
  style: string;      // 原始 pStyle val，如 "Heading1" / ""
  kind: ParaKind;     // 归一化后的类型
  text: string;       // 段落纯文本
}

export interface ParsedDoc {
  paragraphs: ParsedParagraph[];
}

const P_RE = /<w:p\b[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g;
const PSTYLE_RE = /<w:pStyle\b[^>]*w:val="([^"]*)"/;
const WT_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function styleToKind(style: string): ParaKind {
  const s = style.toLowerCase();
  if (/heading\s*1|^1$|title/.test(s)) return "heading1";
  if (/heading\s*2|^2$/.test(s)) return "heading2";
  if (/heading\s*3|^3$/.test(s)) return "heading3";
  if (/list/.test(s)) return "list";
  return "normal";
}

function paragraphText(block: string): string {
  let text = "";
  for (const m of block.matchAll(WT_RE)) text += decodeXml(m[1]);
  return text;
}

/** 解析 docx buffer → 段落结构 */
export async function parseDocx(buf: Buffer): Promise<ParsedDoc> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("不是有效的 docx：缺少 word/document.xml");
  const xml = await file.async("string");

  const paragraphs: ParsedParagraph[] = [];
  let index = 0;
  for (const m of xml.matchAll(P_RE)) {
    const block = m[0];
    const styleMatch = block.match(PSTYLE_RE);
    const style = styleMatch ? styleMatch[1] : "";
    paragraphs.push({
      index,
      style,
      kind: styleToKind(style),
      text: paragraphText(block),
    });
    index++;
  }
  return { paragraphs };
}

/**
 * 用新文本替换原始 docx 中各段落的文字后，返回新的 docx buffer。
 * @param buf       原始 docx
 * @param newTexts  按段落序号对齐的新文本（undefined / 同序号缺失 = 保持原样）
 */
export async function exportDocx(
  buf: Buffer,
  newTexts: (string | undefined)[]
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("不是有效的 docx：缺少 word/document.xml");
  let xml = await file.async("string");

  let index = 0;
  xml = xml.replace(P_RE, (block) => {
    const newText = newTexts[index];
    index++;
    if (newText === undefined) return block;
    return replaceParagraphText(block, newText);
  });

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * 把整段新文本塞进段落的第一个 run，其余 run 的文字清空。
 * 段落级样式（pPr）与首个 run 的样式（rPr）得以保留。
 */
function replaceParagraphText(block: string, newText: string): string {
  const wtMatches = [...block.matchAll(WT_RE)];
  if (wtMatches.length === 0) return block; // 空段落不动

  const encoded = encodeXml(newText);
  let seen = 0;
  return block.replace(WT_RE, (full, _inner, offset) => {
    seen++;
    if (seen === 1) {
      // 首个 <w:t> 写入全部文本，并保证 xml:space="preserve"
      const openEnd = full.indexOf(">");
      let openTag = full.slice(0, openEnd + 1);
      if (!/xml:space=/.test(openTag)) {
        openTag = openTag.replace(/>$/, ' xml:space="preserve">');
      }
      return `${openTag}${encoded}</w:t>`;
    }
    // 其余 <w:t> 清空（保留标签结构）
    const openEnd = full.indexOf(">");
    const openTag = full.slice(0, openEnd + 1);
    return `${openTag}</w:t>`;
  });
}
