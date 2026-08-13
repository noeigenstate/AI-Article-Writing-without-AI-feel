import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outdir = join(tmpdir(), `speak-plainly-progress-${Date.now()}`);
mkdirSync(outdir, { recursive: true });

try {
  const outfile = join(outdir, "progress.mjs");
  await build({
    entryPoints: ["src/lib/progress.ts"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    logLevel: "silent",
  });

  const { PROGRESS_PLANS, getProgressLogEntries, getProgressSnapshot } = await import(pathToFileURL(outfile));

  assert.ok(PROGRESS_PLANS.articleTopics, "topic/title planning has progress");
  assert.ok(PROGRESS_PLANS.titleCandidates, "title candidate generation has progress");

  for (const [task, plan] of Object.entries(PROGRESS_PLANS)) {
    const first = getProgressSnapshot(plan, 0);
    assert.equal(first.phaseIndex, 0, `${task} starts in its first phase`);
    assert.ok(first.percent >= 1, `${task} starts with visible progress`);
    assert.ok(first.percent < 100, `${task} does not claim completion at start`);

    let previous = 0;
    for (const elapsed of [0, 1000, 5000, 12000, 30000, 60000, 120000]) {
      const next = getProgressSnapshot(plan, elapsed);
      assert.ok(next.percent >= previous, `${task} progress never moves backward at ${elapsed}ms`);
      assert.ok(next.percent <= 94, `${task} pending progress stays below completion`);
      previous = next.percent;
    }

    const saturated = getProgressSnapshot(plan, 10 * 60 * 1000);
    assert.equal(saturated.percent, 94, `${task} keeps waiting visible without reaching 100%`);

    const complete = getProgressSnapshot(plan, 0, true);
    assert.equal(complete.percent, 100, `${task} can render completion`);
    assert.equal(complete.phaseIndex, plan.length - 1, `${task} completion uses final phase`);
  }

  const logs = getProgressLogEntries(["one", "two", "three"], 1);
  assert.deepEqual(
    logs.map((entry) => entry.status),
    ["done", "active", "pending"],
    "progress logs show completed, active, and pending phases"
  );

  const lengthOutfile = join(outdir, "article-length.mjs");
  await build({
    entryPoints: ["src/components/editor/DocEditor.tsx"],
    outfile: lengthOutfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const { measureArticleBody } = await import(pathToFileURL(lengthOutfile));
  const blocks = [
    { type: "paragraph", kind: "heading1", text: "Title", paragraphIndex: 0 },
    { type: "paragraph", kind: "normal", text: "Body", paragraphIndex: 1 },
    { type: "figure", title: "Figure", caption: "excluded caption", svg: "" },
    { type: "paragraph", kind: "normal", text: "More", paragraphIndex: 2 },
    { type: "references", title: "References", items: ["excluded reference"] },
  ];
  const zhParagraphs = [
    { index: 0, kind: "heading1", original: "title", sentences: ["edited title"] },
    { index: 1, kind: "normal", original: "body", sentences: ["\u4f60\u597d \u{1F44B}", " \u4e16\u754c"] },
    { index: 2, kind: "normal", original: "more", sentences: ["\u518d\u89c1[12]"] },
  ];
  const enParagraphs = [
    { index: 0, kind: "heading1", original: "Title", sentences: ["Edited title"] },
    { index: 1, kind: "normal", original: "Body", sentences: ["one two", " three"] },
    { index: 2, kind: "normal", original: "More", sentences: ["four five [12]"] },
  ];
  assert.equal(
    measureArticleBody(zhParagraphs, blocks, 0, "characters"),
    7,
    "article length counts edited Unicode body characters, excluding title and non-paragraph blocks"
  );
  assert.equal(
    measureArticleBody(enParagraphs, blocks, 0, "words"),
    5,
    "article length counts edited body words, excluding title and non-paragraph blocks"
  );
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
