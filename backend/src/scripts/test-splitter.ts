import assert from "node:assert/strict";
import { splitSentences } from "../services/splitter.js";

function assertSplit(input: string, expected: string[]) {
  const actual = splitSentences(input);
  assert.deepEqual(actual, expected);
  assert.equal(actual.join(""), input);
}

assertSplit("First sentence. Second sentence. Third one here.", [
  "First sentence.",
  " Second sentence.",
  " Third one here.",
]);

assertSplit("Revenue was 3.14 million. Dr. Smith agreed. Next step?", [
  "Revenue was 3.14 million.",
  " Dr. Smith agreed.",
  " Next step?",
]);

assertSplit("他说“今天不行。明天再说。”然后走了。", [
  "他说“今天不行。明天再说。”",
  "然后走了。",
]);

assertSplit("他说“今天不行。明天再说。然后就没有下文了。", [
  "他说“今天不行。",
  "明天再说。",
  "然后就没有下文了。",
]);

assertSplit("第一句。第二句！第三句？", ["第一句。", "第二句！", "第三句？"]);

console.log("splitter tests passed");
