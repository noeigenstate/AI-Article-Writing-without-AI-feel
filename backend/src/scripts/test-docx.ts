/**
 * DOCX regression: paragraph round-trip plus byte-for-byte source image embedding.
 * Usage: npm run test:docx
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  createDocxFromBlocks,
  exportDocx,
  parseDocx,
  type DocxBlock,
} from "../services/docx.js";
import { splitSentences } from "../services/splitter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../../test/AI替你炒股_紧凑版.docx");
const OUT = path.resolve(here, "../../../test/_roundtrip_out.docx");

const buf = await readFile(SRC);
const doc = await parseDocx(buf);
assert.ok(doc.paragraphs.length > 0, "source document should contain paragraphs");

let totalSentences = 0;
for (const paragraph of doc.paragraphs) {
  const parts = splitSentences(paragraph.text);
  totalSentences += parts.length;
  assert.equal(parts.join(""), paragraph.text, `sentence split changed paragraph ${paragraph.index}`);
}

const newTexts = doc.paragraphs.map((paragraph) => paragraph.text);
const out = await exportDocx(buf, newTexts);
await writeFile(OUT, out);
const reparsed = await parseDocx(out);
assert.equal(reparsed.paragraphs.length, doc.paragraphs.length, "paragraph count changed after round-trip");
for (let index = 0; index < doc.paragraphs.length; index += 1) {
  assert.equal(reparsed.paragraphs[index].text, doc.paragraphs[index].text, `paragraph ${index} changed`);
}

type FigureMime = Extract<DocxBlock, { type: "figure" }>["mimeType"];
const mediaCases: Array<{
  mimeType: FigureMime;
  extension: "png" | "jpg" | "gif" | "webp";
  bytes: Buffer;
  width: number;
  height: number;
}> = [
  {
    mimeType: "image/png",
    extension: "png",
    bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    width: 1,
    height: 1,
  },
  {
    mimeType: "image/jpeg",
    extension: "jpg",
    bytes: Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIcA2D3/2Q==",
      "base64"
    ),
    width: 2,
    height: 1,
  },
  {
    mimeType: "image/gif",
    extension: "gif",
    bytes: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAAFAAAALAAAAAABAAEAAAICRAEAOw==", "base64"),
    width: 1,
    height: 1,
  },
  {
    mimeType: "image/webp",
    extension: "webp",
    bytes: Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAdQs840s/+BiOh/AAA=", "base64"),
    width: 2,
    height: 1,
  },
];

const captions = mediaCases.map((_, index) => `图注 ${index + 1}：来自网络的原始图片 & 来源保留`);
const mediaBlocks: DocxBlock[] = [
  { type: "paragraph", kind: "heading1", text: "原始来源图片测试" },
  ...mediaCases.map((media, index): DocxBlock => ({
    type: "figure",
    title: `网络图片 ${index + 1}`,
    caption: captions[index],
    mediaDataUri: `data:${media.mimeType};base64,${media.bytes.toString("base64")}`,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
  })),
];

const mediaDoc = await createDocxFromBlocks(mediaBlocks);
const zip = await JSZip.loadAsync(mediaDoc);
const mediaNames = Object.keys(zip.files)
  .filter((name) => name.startsWith("word/media/") && !zip.files[name].dir)
  .sort();
const expectedNames = mediaCases.map((media, index) => `word/media/figure${index + 1}.${media.extension}`).sort();
assert.deepEqual(mediaNames, expectedNames, "DOCX should contain only the original source image files");

for (let index = 0; index < mediaCases.length; index += 1) {
  const media = mediaCases[index];
  const embedded = await zip.file(`word/media/figure${index + 1}.${media.extension}`)?.async("nodebuffer");
  assert.ok(embedded, `missing embedded ${media.mimeType}`);
  assert.deepEqual(embedded, media.bytes, `${media.mimeType} bytes changed during DOCX export`);
}

const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
assert.ok(contentTypes, "missing [Content_Types].xml");
for (const [extension, mimeType] of [
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
] as const) {
  assert.match(contentTypes, new RegExp(`<Default Extension="${extension}" ContentType="${mimeType.replace("/", "\\/")}"/>`));
}
assert.doesNotMatch(contentTypes, /svg/iu, "SVG must not be declared in the DOCX package");

const relationships = await zip.file("word/_rels/document.xml.rels")?.async("string");
assert.ok(relationships, "missing document relationships");
const imageRelationships = relationships.match(/relationships\/image/gu) ?? [];
assert.equal(imageRelationships.length, mediaCases.length, "each figure should have exactly one image relationship");
for (let index = 0; index < mediaCases.length; index += 1) {
  const media = mediaCases[index];
  assert.match(
    relationships,
    new RegExp(`Id="rIdFigure${index + 1}"[^>]*Target="media/figure${index + 1}\\.${media.extension}"`)
  );
}

const documentXml = await zip.file("word/document.xml")?.async("string");
assert.ok(documentXml, "missing word/document.xml");
assert.doesNotMatch(documentXml, /asvg|svgBlip|\.svg/iu, "DOCX drawing must not reference SVG or an SVG fallback");
for (const caption of captions) {
  assert.match(documentXml, new RegExp(caption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(" & ", " &amp; ")));
}
for (let index = 0; index < mediaCases.length; index += 1) {
  assert.doesNotMatch(
    documentXml,
    new RegExp(`网络图片 ${index + 1}`, "u"),
    "figure labels should not appear as oversized headings above source images"
  );
}
const firstExtent = documentXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/u);
assert.ok(firstExtent, "figure extent missing");
assert.ok(Math.abs(Number(firstExtent[1]) / Number(firstExtent[2]) - 1) < 0.0001, "figure aspect ratio changed");
assert.ok(Number(firstExtent[1]) <= 5_760_000 && Number(firstExtent[2]) <= 6_480_000, "figure exceeds page bounds");

const parsedMediaDoc = await parseDocx(mediaDoc);
for (const caption of captions) {
  assert.ok(parsedMediaDoc.paragraphs.some((paragraph) => paragraph.text === caption), `caption was not preserved: ${caption}`);
}

const validPng = mediaCases[0];
const invalidFigureBase = {
  type: "figure" as const,
  title: "非法图片",
  caption: "不应生成替代图片",
  width: 800,
  height: 600,
};
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: `data:image/jpeg;base64,${validPng.bytes.toString("base64")}`,
    mimeType: "image/png",
  }]),
  { message: "Invalid DOCX figure media" }
);
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: "data:image/jpeg;base64,/9j/wAALCAABAAIBAREA/9oACAEBAAA/AAD/2Q==",
    mimeType: "image/jpeg",
    width: 2,
    height: 1,
  }]),
  { message: "Invalid DOCX figure media" },
  "DOCX must reject a marker-shaped but undecodable JPEG"
);
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAkAAAAvAQAAAP////8A",
    mimeType: "image/webp",
    width: 2,
    height: 1,
  }]),
  { message: "Invalid DOCX figure media" },
  "DOCX must reject a structurally plausible but undecodable WebP"
);
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: `data:image/png;base64,${validPng.bytes.toString("base64")}`,
    mimeType: "image/png",
    width: 2,
    height: 1,
  }]),
  { message: "Invalid DOCX figure media" },
  "DOCX dimensions must come from the decoded source image"
);
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: "data:image/png;base64,%%%",
    mimeType: "image/png",
  }]),
  { message: "Invalid DOCX figure media" }
);
await assert.rejects(
  createDocxFromBlocks([{
    ...invalidFigureBase,
    mediaDataUri: `data:image/png;base64,${mediaCases[2].bytes.toString("base64")}`,
    mimeType: "image/png",
  }]),
  { message: "Invalid DOCX figure media" }
);

console.log(`DOCX paragraph round-trip passed: ${doc.paragraphs.length} paragraphs, ${totalSentences} sentences`);
console.log("DOCX source media passed: PNG/JPEG/GIF/WebP bytes, relationships, content types, captions, and rejection paths");
console.log(`Round-trip output: ${OUT}`);
