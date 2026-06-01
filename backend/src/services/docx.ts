import JSZip from "jszip";

/**
 * docx 解析与导出。
 *
 * 设计要点：导出时**不从零重建** docx，而是加载原始 docx，只替换每个段落里的文字，
 * 其余 XML（段落样式、列表、字体等）原样保留 —— 这样能在「段落级」上最大程度保真。
 */

export type ParaKind = "heading1" | "heading2" | "heading3" | "list" | "normal";

export type DocxBlock =
  | { type: "paragraph"; kind: ParaKind; text: string }
  | { type: "table"; title?: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "figure"; title: string; caption: string; svg: string };

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

function kindToStyle(kind: ParaKind): string {
  if (kind === "heading1") return "Heading1";
  if (kind === "heading2") return "Heading2";
  if (kind === "heading3") return "Heading3";
  if (kind === "list") return "ListParagraph";
  return "";
}

function paragraphText(block: string): string {
  let text = "";
  for (const m of block.matchAll(WT_RE)) text += decodeXml(m[1]);
  // 防御：某些带修订/复杂 run 的 docx 会把 Word 标签残渣漏进文字，剔除之
  return text.replace(/<\/?w:[^>]*>/g, "");
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

/** 从纯文本段落创建一个最小可编辑 docx，用于 AI 直接生成的文章导出。 */
export async function createDocxFromParagraphs(
  paragraphs: { kind: ParaKind; text: string }[]
): Promise<Buffer> {
  return createDocxFromBlocks(paragraphs.map((p) => ({ type: "paragraph", ...p })));
}

/** 从结构化内容创建 docx，支持段落、Word 表格和嵌入 SVG 图。 */
export async function createDocxFromBlocks(blocks: DocxBlock[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")?.file(".rels", packageRelsXml());
  const word = zip.folder("word");
  const figureBlocks = blocks.filter((block): block is Extract<DocxBlock, { type: "figure" }> => block.type === "figure");
  word?.file("document.xml", documentXml(blocks));
  word?.file("styles.xml", stylesXml());
  word?.folder("_rels")?.file("document.xml.rels", documentRelsXml(figureBlocks.length));
  const media = word?.folder("media");
  figureBlocks.forEach((figure, index) => {
    media?.file(`figure${index + 1}.svg`, figure.svg);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

function documentXml(blocks: DocxBlock[]): string {
  let figureIndex = 0;
  const body = blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return paragraphXml(block.kind, block.text);
      }
      if (block.type === "table") {
        return tableBlockXml(block);
      }

      figureIndex += 1;
      return figureBlockXml(block, figureIndex);
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function paragraphXml(kind: ParaKind, text: string): string {
  const style = kindToStyle(kind);
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r></w:p>`;
}

function tableBlockXml(table: Extract<DocxBlock, { type: "table" }>): string {
  const header = tableRowXml(table.columns, true);
  const rows = table.rows.map((row) => tableRowXml(row, false)).join("");
  const note = table.note ? paragraphXml("normal", table.note) : "";
  const title = table.title ? paragraphXml("heading2", table.title) : "";
  return `${title}<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="A7B7A5"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="A7B7A5"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="A7B7A5"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="A7B7A5"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D7E2D4"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D7E2D4"/>
      </w:tblBorders>
    </w:tblPr>
    ${header}${rows}
  </w:tbl>${note}`;
}

function tableRowXml(cells: string[], isHeader: boolean): string {
  const fill = isHeader ? `<w:shd w:fill="EEF6EC"/>` : "";
  const bold = isHeader ? "<w:b/>" : "";
  return `<w:tr>${cells
    .map(
      (cell) =>
        `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/>${fill}</w:tcPr><w:p><w:r><w:rPr>${bold}</w:rPr><w:t xml:space="preserve">${encodeXml(
          cell
        )}</w:t></w:r></w:p></w:tc>`
    )
    .join("")}</w:tr>`;
}

function figureBlockXml(figure: Extract<DocxBlock, { type: "figure" }>, index: number): string {
  const rid = `rIdFigure${index}`;
  const cx = 5_760_000;
  const cy = 2_520_000;
  return `${paragraphXml("heading2", figure.title)}
<w:p><w:r><w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${cx}" cy="${cy}"/>
    <wp:docPr id="${index}" name="Figure ${index}"/>
    <a:graphic>
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic>
          <pic:nvPicPr>
            <pic:cNvPr id="${index}" name="figure${index}.svg"/>
            <pic:cNvPicPr/>
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${rid}"/>
            <a:stretch><a:fillRect/></a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing></w:r></w:p>
${paragraphXml("normal", figure.caption)}`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function packageRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelsXml(figureCount = 0): string {
  const figureRels = Array.from({ length: figureCount }, (_, index) => {
    const id = index + 1;
    return `<Relationship Id="rIdFigure${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure${id}.svg"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${figureRels}
</Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="23"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;
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
