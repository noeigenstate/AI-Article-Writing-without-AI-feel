/**
 * 端到端验收：解析测试稿 → 整篇改写 → 检查段落对齐 → 抽样对照。
 * 用法：npm run test:full
 */
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { parseDocx } from "../services/docx.js";
import { rewriteDocument } from "../services/rewrite.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../../test/AI替你炒股_紧凑版.docx");

const buf = await readFile(SRC);
const doc = await parseDocx(buf);
const withText = doc.paragraphs.filter((p) => p.text.trim());
console.log(`非空段落: ${withText.length}，开始整篇改写…`);

const t0 = Date.now();
const map = await rewriteDocument(
  "",
  doc.paragraphs.map((p) => ({ index: p.index, kind: p.kind, text: p.text }))
);
console.log(`改写完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const missing = withText.filter((p) => !map.has(p.index)).map((p) => p.index);
console.log(`段落覆盖: ${map.size}/${withText.length}` + (missing.length ? `，缺失 ${missing}` : "，✓ 全覆盖"));

console.log("\n抽样对照（前 6 个非空段）：");
for (const p of withText.slice(0, 6)) {
  console.log(`\n[${p.index}] (${p.kind})`);
  console.log(`  原: ${p.text}`);
  console.log(`  改: ${map.get(p.index)}`);
}
