import JSZip from "jszip";
import { deflateSync } from "node:zlib";

/**
 * docx 解析与导出。
 *
 * 设计要点：导出时**不从零重建** docx，而是加载原始 docx，只替换每个段落里的文字，
 * 其余 XML（段落样式、列表、字体等）原样保留 —— 这样能在「段落级」上最大程度保真。
 */

/** Normalized paragraph type. */
export type ParaKind = "heading1" | "heading2" | "heading3" | "list" | "normal";

/** A unit of generated document content: a paragraph, a table, or a figure. */
export type DocxBlock =
  | { type: "paragraph"; kind: ParaKind; text: string }
  | { type: "table"; title?: string; columns: string[]; rows: string[][]; note?: string }
  | { type: "figure"; title: string; caption: string; svg: string };

/** One parsed paragraph, aligned by index with the source document. */
export interface ParsedParagraph {
  index: number;      // 在文档中的段落序号（与导出对齐）
  style: string;      // 原始 pStyle val，如 "Heading1" / ""
  kind: ParaKind;     // 归一化后的类型
  text: string;       // 段落纯文本
}

/** The parsed paragraph structure of a docx. */
export interface ParsedDoc {
  paragraphs: ParsedParagraph[];
}

const PSTYLE_RE = /<w:pStyle\b[^>]*w:val="([^"]*)"/;
const WT_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
/**
 * 不支持 svgBlip 的旧版 Word 会显示这张 PNG 兜底图。
 * 用与 SVG 图卡等尺寸的浅灰实色块（而不是 1×1 透明像素——那会被拉伸成一片空白）。
 */
let figureFallbackPng: Buffer | undefined;
function getFigureFallbackPng(): Buffer {
  figureFallbackPng ??= solidPng(760, 360, [0xe2, 0xe8, 0xf0]);
  return figureFallbackPng;
}

/** Encode a solid-color truecolor PNG (8-bit RGB) without external deps. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor

  const row = Buffer.alloc(1 + width * 3); // 每行前置 1 字节 filter=0
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const idat = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface XmlSpan {
  start: number;
  end: number;
  text: string;
}

/** Decode XML entities back to plain text. */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Encode the XML-significant characters for embedding in document XML. */
function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Map a Word pStyle value to a normalized {@link ParaKind}. */
function styleToKind(style: string): ParaKind {
  const s = style.toLowerCase();
  if (/heading\s*1|^1$|title/.test(s)) return "heading1";
  if (/heading\s*2|^2$/.test(s)) return "heading2";
  if (/heading\s*3|^3$/.test(s)) return "heading3";
  if (/list/.test(s)) return "list";
  return "normal";
}

/** Map a normalized {@link ParaKind} back to a Word style id ("" for normal). */
function kindToStyle(kind: ParaKind): string {
  if (kind === "heading1") return "Heading1";
  if (kind === "heading2") return "Heading2";
  if (kind === "heading3") return "Heading3";
  if (kind === "list") return "ListParagraph";
  return "";
}

/** Extract the visible text of a `<w:p>` block, stripping leaked Word tags. */
function paragraphText(block: string): string {
  let text = "";
  for (const m of block.matchAll(WT_RE)) text += decodeXml(m[1]);
  // 防御：某些带修订/复杂 run 的 docx 会把 Word 标签残渣漏进文字，剔除之
  return text.replace(/<\/?w:[^>]*>/g, "");
}

/**
 * Parse a docx buffer into its paragraph structure.
 *
 * @param buf The docx file bytes.
 * @returns The parsed paragraphs.
 * @throws Error if `word/document.xml` is missing (not a valid docx).
 */
export async function parseDocx(buf: Buffer): Promise<ParsedDoc> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("不是有效的 docx：缺少 word/document.xml");
  const xml = await file.async("string");

  const paragraphs: ParsedParagraph[] = [];
  let index = 0;
  for (const { text: block } of paragraphSpans(xml)) {
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
 * Replace paragraph text in the original docx and return new bytes.
 *
 * Reuses the source docx and only swaps text, so paragraph styles, lists, and
 * fonts are preserved (paragraph-level fidelity).
 *
 * @param buf The original docx.
 * @param newTexts New text aligned by paragraph index; `undefined`/missing keeps the original.
 * @returns The rebuilt docx bytes.
 * @throws Error if `word/document.xml` is missing.
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
  xml = replaceParagraphSpans(xml, (block) => {
    const newText = newTexts[index];
    index++;
    if (newText === undefined) return block;
    return replaceParagraphText(block, newText);
  });

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

function paragraphSpans(xml: string): XmlSpan[] {
  const spans: XmlSpan[] = [];
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>|<\/w:p>/g;
  let start = -1;
  let depth = 0;

  for (const match of xml.matchAll(re)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (token.startsWith("<w:p")) {
      if (depth === 0) {
        start = index;
      }
      if (token.endsWith("/>")) {
        if (depth === 0) {
          spans.push({ start: index, end: index + token.length, text: token });
          start = -1;
        }
      } else {
        depth += 1;
      }
      continue;
    }

    if (depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const end = index + token.length;
        spans.push({ start, end, text: xml.slice(start, end) });
        start = -1;
      }
    }
  }

  return spans;
}

function replaceParagraphSpans(xml: string, replacer: (block: string) => string): string {
  const spans = paragraphSpans(xml);
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += xml.slice(cursor, span.start);
    out += replacer(span.text);
    cursor = span.end;
  }
  return out + xml.slice(cursor);
}

/**
 * Build a minimal editable docx from plain paragraphs.
 *
 * @param paragraphs Paragraphs with kind and text.
 * @returns The docx bytes.
 */
export async function createDocxFromParagraphs(
  paragraphs: { kind: ParaKind; text: string }[]
): Promise<Buffer> {
  return createDocxFromBlocks(paragraphs.map((p) => ({ type: "paragraph", ...p })));
}

/**
 * Build a docx from structured blocks: paragraphs, Word tables, and embedded SVG figures.
 *
 * @param blocks The ordered content blocks.
 * @returns The docx bytes.
 */
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
    const id = index + 1;
    media?.file(`figure${id}.svg`, figure.svg);
    media?.file(`figure${id}.png`, getFigureFallbackPng());
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Build the `word/document.xml` body from content blocks. */
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
  xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main"
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

/** Render a single paragraph as `<w:p>` XML with its style. */
function paragraphXml(kind: ParaKind, text: string): string {
  const style = kindToStyle(kind);
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r></w:p>`;
}

/** Render a table block (optional title + bordered table + optional note) as XML. */
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

/** Render one table row; header rows are shaded and bold. */
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

/** Render a figure block (title + embedded SVG drawing + caption) as XML. */
function figureBlockXml(figure: Extract<DocxBlock, { type: "figure" }>, index: number): string {
  const pngRid = `rIdFigurePng${index}`;
  const svgRid = `rIdFigureSvg${index}`;
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
            <a:blip r:embed="${pngRid}">
              <a:extLst>
                <a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">
                  <asvg:svgBlip r:embed="${svgRid}"/>
                </a:ext>
              </a:extLst>
            </a:blip>
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

/** The `[Content_Types].xml` part declaring docx/svg content types. */
function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

/** The package-level `_rels/.rels` pointing at the main document part. */
function packageRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

/** The `word/_rels/document.xml.rels` linking styles and each figure image. */
function documentRelsXml(figureCount = 0): string {
  const figureRels = Array.from({ length: figureCount }, (_, index) => {
    const id = index + 1;
    return [
      `<Relationship Id="rIdFigurePng${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure${id}.png"/>`,
      `<Relationship Id="rIdFigureSvg${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure${id}.svg"/>`,
    ].join("");
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${figureRels}
</Relationships>`;
}

/** The `word/styles.xml` defining Normal and Heading1–3/List styles. */
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
 * Write the full new text into a paragraph's first run and blank the rest.
 *
 * Paragraph style (pPr) and the first run's style (rPr) are preserved.
 *
 * @param block The original `<w:p>` XML.
 * @param newText The replacement text.
 * @returns The rewritten paragraph XML.
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
