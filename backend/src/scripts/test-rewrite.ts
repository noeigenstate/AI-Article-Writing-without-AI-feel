import assert from "node:assert/strict";
import { rewriteDocument } from "../services/rewrite.js";

const paragraphs = [
  { index: 0, kind: "heading1", text: "Original title" },
  { index: 1, kind: "normal", text: "First body paragraph." },
  { index: 2, kind: "normal", text: "Second body paragraph." },
];

let calls = 0;
const result = await rewriteDocument("", paragraphs, 12, "en", async () => {
  calls += 1;
  if (calls === 1) {
    return JSON.stringify(["Better title"]);
  }
  return JSON.stringify([
    { index: 1, text: "Rewritten first body paragraph." },
    { index: 999, text: "This should never be accepted." },
    { index: "2", text: "Rewritten second body paragraph." },
  ]);
});

assert.equal(result.get(0), "Better title");
assert.equal(result.get(1), "Rewritten first body paragraph.");
assert.equal(result.get(2), "Rewritten second body paragraph.");
assert.equal(result.has(999), false);

console.log("rewrite tests passed");
