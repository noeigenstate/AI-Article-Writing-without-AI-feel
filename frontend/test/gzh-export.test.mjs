import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outdir = join(tmpdir(), `speak-plainly-gzh-export-${Date.now()}`);
mkdirSync(outdir, { recursive: true });

try {
  const outfile = join(outdir, "gzh-export.mjs");
  await build({
    entryPoints: ["src/components/editor/GzhExportPanel.tsx"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const { canExportGzhResult } = await import(pathToFileURL(outfile));

  assert.equal(canExportGzhResult(null), false);
  assert.equal(
    canExportGzhResult({ validation: { errors: ["unsafe HTML"], warnings: [], leafCount: 1 } }),
    false,
    "blocking validation errors must disable copy and download"
  );
  assert.equal(
    canExportGzhResult({ validation: { errors: [], warnings: ["review"], leafCount: 1 } }),
    true,
    "warnings alone may still be exported"
  );
  console.log("WeChat export blocking-state tests passed.");
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
