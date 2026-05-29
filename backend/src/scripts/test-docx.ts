/**
 * M1 验收：docx 解析 → 切句 → 导出往返，验证段落不丢、切句拼接无损。
 * 用法：npm run test:docx
 */
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { parseDocx, exportDocx } from "../services/docx.js";
import { splitSentences } from "../services/splitter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../../test/AI替你炒股_紧凑版.docx");
const OUT = path.resolve(here, "../../../test/_roundtrip_out.docx");

const buf = await readFile(SRC);
const doc = await parseDocx(buf);
console.log(`解析段落数: ${doc.paragraphs.length}`);

// 切句无损校验
let splitOk = true;
let totalSentences = 0;
for (const p of doc.paragraphs) {
  const parts = splitSentences(p.text);
  totalSentences += parts.length;
  if (parts.join("") !== p.text) {
    splitOk = false;
    console.error(`✗ 切句拼接不等于原文 @段 ${p.index}`);
  }
}
console.log(`切句总数: ${totalSentences}，无损校验: ${splitOk ? "✓ 通过" : "✗ 失败"}`);

// 打印前几段（含类型与首句）
console.log("\n前 6 段预览：");
for (const p of doc.paragraphs.slice(0, 6)) {
  const first = splitSentences(p.text)[0] ?? "";
  console.log(`  [${p.index}] (${p.kind}) ${first.slice(0, 40)}${first.length > 40 ? "…" : ""}`);
}

// 导出往返：把每段文本原样写回，验证可重新解析、段落数一致
const newTexts = doc.paragraphs.map((p) => p.text);
const out = await exportDocx(buf, newTexts);
await writeFile(OUT, out);
const reparsed = await parseDocx(out);
console.log(`\n导出后重新解析段落数: ${reparsed.paragraphs.length}`);

let textOk = reparsed.paragraphs.length === doc.paragraphs.length;
for (let i = 0; i < doc.paragraphs.length && textOk; i++) {
  if (reparsed.paragraphs[i].text !== doc.paragraphs[i].text) {
    textOk = false;
    console.error(`✗ 文本不一致 @段 ${i}`);
    console.error(`  原: ${doc.paragraphs[i].text.slice(0, 60)}`);
    console.error(`  新: ${reparsed.paragraphs[i].text.slice(0, 60)}`);
  }
}
console.log(`往返文本一致: ${textOk ? "✓ 通过" : "✗ 失败"}`);
console.log(`\n输出文件: ${OUT}`);
