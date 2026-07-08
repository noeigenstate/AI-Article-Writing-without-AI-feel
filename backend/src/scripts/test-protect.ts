import assert from "node:assert/strict";
import {
  extractProtectedFragments,
  findProtectionViolations,
  preservesProtectedFragments,
} from "../services/protect.js";

const source = "5月27日，收入增长 12.5%，详情见 https://example.com/report [1]，版本 v2.4.1。";
const fragments = extractProtectedFragments(source);

assert.ok(fragments.some((item) => item.type === "date" && item.text === "5月27日"));
assert.ok(fragments.some((item) => item.type === "percent" && item.text === "12.5%"));
assert.ok(fragments.some((item) => item.type === "url" && item.text === "https://example.com/report"));
assert.ok(fragments.some((item) => item.type === "citation" && item.text === "[1]"));
assert.ok(fragments.some((item) => item.type === "version" && item.text.toLowerCase() === "v2.4.1"));

assert.equal(
  preservesProtectedFragments(
    source,
    "5月27日，收入增长 12.5%，详情见 https://example.com/report [1]，版本 v2.4.1。"
  ),
  true
);

const violations = findProtectionViolations(source, "收入上涨不少，详情见报告，版本也升级了。");
assert.ok(violations.some((item) => item.text === "12.5%"));
assert.ok(violations.some((item) => item.text === "https://example.com/report"));
assert.ok(violations.some((item) => item.text === "[1]"));

console.log("protected fragment tests passed");
