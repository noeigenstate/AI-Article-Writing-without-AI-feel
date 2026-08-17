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

  const markdownOutfile = join(outdir, "gzh-markdown.mjs");
  await build({
    entryPoints: ["src/lib/gzhMarkdown.ts"],
    outfile: markdownOutfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const { renderBlocksForGzh, renderBlocksToMarkdown } = await import(pathToFileURL(markdownOutfile));

  const mediaOutfile = join(outdir, "gzh-media.mjs");
  await build({
    entryPoints: ["src/lib/gzhMedia.ts"],
    outfile: mediaOutfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const { hydrateGzhSourceMedia } = await import(pathToFileURL(mediaOutfile));

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

  const sourceBlocks = [
    {
      type: "figure",
      origin: "web",
      title: "Animated process",
      caption: "A verified source GIF",
      alt: "A process shown over time",
      mediaKind: "gif",
      mimeType: "image/gif",
      mediaDataUri: "data:image/gif;base64,SECRET_MEDIA_SENTINEL",
      width: 640,
      height: 360,
      sourceName: "Example Lab",
      sourceTitle: "Original motion study",
      sourceUrl: "https://example.com/motion-study",
      sourceRef: 4,
    },
    {
      type: "figure",
      origin: "web",
      title: "Source photograph",
      caption: "A verified source image",
      alt: "The documented scene",
      mediaKind: "image",
      mimeType: "image/jpeg",
      mediaDataUri: "data:image/jpeg;base64,SECRET_IMAGE_SENTINEL",
      imageUrl: "https://cdn.example.com/DO_NOT_HOTLINK.jpg",
      width: 1200,
      height: 800,
      sourceName: "Example News",
      sourceTitle: "Original field report",
      sourceUrl: "https://news.example.com/field-report",
      sourceRef: 2,
    },
    {
      type: "figure",
      origin: "web",
      title: "UNATTRIBUTED_SOURCE_FIGURE",
      caption: "Must not be exported without a source reference",
      alt: "Otherwise valid source image",
      mediaKind: "image",
      mimeType: "image/png",
      mediaDataUri: "data:image/png;base64,iVBORw0KGgo=",
      width: 400,
      height: 300,
      sourceName: "Example source",
      sourceTitle: "Example article",
      sourceUrl: "https://example.com/unattributed",
      sourceRef: 0,
    },
    {
      type: "figure",
      origin: "web",
      title: "PRIVATE_SOURCE_FIGURE",
      caption: "Must not export a private-network attribution link",
      alt: "Otherwise valid source image",
      mediaKind: "image",
      mimeType: "image/png",
      mediaDataUri: "data:image/png;base64,iVBORw0KGgo=",
      width: 400,
      height: 300,
      sourceName: "Private source",
      sourceTitle: "Internal article",
      sourceUrl: "http://127.0.0.1:3000/admin",
      sourceRef: 3,
    },
    {
      type: "figure",
      origin: "web",
      title: "INVALID_SVG_FIGURE",
      caption: "Must not be exported",
      alt: "Invalid media",
      mediaKind: "image",
      mimeType: "image/svg+xml",
      mediaDataUri: "data:image/svg+xml;base64,PHN2Zz4=",
      width: 400,
      height: 300,
      sourceName: "Invalid source",
      sourceTitle: "Invalid item",
      sourceUrl: "https://example.com/invalid",
    },
    {
      type: "figure",
      origin: "web",
      title: "MALFORMED_SOURCE_FIGURE",
      mediaKind: "image",
      mimeType: "image/png",
      width: 400,
      height: 300,
      sourceUrl: "https://example.com/malformed",
    },
  ];
  const prepared = renderBlocksForGzh(sourceBlocks, []);
  const mediaMarkdown = prepared.markdown;
  assert.equal(renderBlocksToMarkdown(sourceBlocks, []), mediaMarkdown);
  assert.match(mediaMarkdown, /【插入来源 GIF｜素材 SP_SOURCE_MEDIA_0001｜来源 4】 Animated process/);
  assert.match(mediaMarkdown, /来源：Example Lab《Original motion study》 https:\/\/example\.com\/motion-study/);
  assert.match(mediaMarkdown, /【插入来源图片｜素材 SP_SOURCE_MEDIA_0002｜来源 2】 Source photograph/);
  assert.match(mediaMarkdown, /来源：Example News《Original field report》 https:\/\/news\.example\.com\/field-report/);
  assert.doesNotMatch(mediaMarkdown, /SECRET_MEDIA_SENTINEL|SECRET_IMAGE_SENTINEL|DO_NOT_HOTLINK|UNATTRIBUTED_SOURCE_FIGURE|PRIVATE_SOURCE_FIGURE|127\.0\.0\.1|INVALID_SVG_FIGURE|MALFORMED_SOURCE_FIGURE|data:image|<svg|图片\/图表/);
  assert.equal(prepared.sourceMedia.length, 2);
  assert.deepEqual(
    prepared.sourceMedia.map((media) => ({ token: media.token, kind: media.mediaKind, ref: media.sourceRef })),
    [
      { token: "SP_SOURCE_MEDIA_0001", kind: "gif", ref: 4 },
      { token: "SP_SOURCE_MEDIA_0002", kind: "image", ref: 2 },
    ]
  );
  assert.match(prepared.sourceMedia[0].mediaDataUri, /^data:image\/gif;base64,/);
  assert.match(prepared.sourceMedia[1].mediaDataUri, /^data:image\/jpeg;base64,/);
  assert.equal("imageUrl" in prepared.sourceMedia[1], false, "remote hotlink fields must not enter the media sidecar");

  const placeholderHtml = [
    '<section style="color:#111">正文之前</section>',
    '<section style="margin:0 0 24px;padding:30px 20px;border:1.5px dashed #DAD7D2">',
    '<p><span leaf="">待补素材</span></p>',
    '<p><span leaf="">素材 SP_SOURCE_MEDIA_0002</span></p>',
    '</section>',
    '<section style="color:#111">正文之后</section>',
  ].join("");
  const hydration = hydrateGzhSourceMedia(placeholderHtml, [{
    ...prepared.sourceMedia[1],
    mediaDataUri: "data:image/jpeg;base64,/9j/2Q==",
    caption: 'Caption <script>alert("x")</script>',
  }], "zh");
  assert.equal(hydration.restoredCount, 1);
  assert.deepEqual(hydration.missingTokens, []);
  assert.doesNotMatch(hydration.html, /待补素材|SP_SOURCE_MEDIA_0002|dashed|<script>/i);
  assert.match(hydration.html, /<img src="data:image\/jpeg;base64,\/9j\/2Q=="/);
  assert.match(hydration.html, /Caption &lt;script&gt;alert\("x"\)&lt;\/script&gt;/);
  assert.match(hydration.html, /来源：/);
  assert.match(hydration.html, /href="https:\/\/news\.example\.com\/field-report"/);
  assert.match(hydration.html, /正文之前/);
  assert.match(hydration.html, /正文之后/);

  const sourceUrlFallbackHtml = [
    '<section><p><span leaf="">参考资料：https://news.example.com/field-report</span></p></section>',
    '<section style="border:1px dashed #DAD7D2"><p><span leaf="">待补素材</span></p>',
    '<p><span leaf="">来源：https://news.example.com/field-report</span></p></section>',
  ].join("");
  const sourceUrlFallback = hydrateGzhSourceMedia(sourceUrlFallbackHtml, [{
    ...prepared.sourceMedia[1],
    mediaDataUri: "data:image/jpeg;base64,/9j/2Q==",
  }], "zh");
  assert.equal(sourceUrlFallback.restoredCount, 1, "the source URL should recover a placeholder if the model drops its token");
  assert.match(sourceUrlFallback.html, /参考资料：https:\/\/news\.example\.com\/field-report/);
  assert.doesNotMatch(sourceUrlFallback.html, /待补素材|dashed/);

  const rejectedHydration = hydrateGzhSourceMedia(placeholderHtml, [{
    ...prepared.sourceMedia[1],
    mediaDataUri: "data:text/html;base64,PHNjcmlwdD4=",
  }], "zh");
  assert.equal(rejectedHydration.restoredCount, 0);
  assert.deepEqual(rejectedHydration.missingTokens, ["SP_SOURCE_MEDIA_0002"]);
  assert.match(rejectedHydration.html, /待补素材/);

  const unsafeLinkHydration = hydrateGzhSourceMedia(placeholderHtml, [{
    ...prepared.sourceMedia[1],
    mediaDataUri: "data:image/jpeg;base64,/9j/2Q==",
    sourceUrl: "javascript:alert(1)",
  }], "zh");
  assert.equal(unsafeLinkHydration.restoredCount, 0);
  assert.doesNotMatch(unsafeLinkHydration.html, /javascript:/i);
  console.log("WeChat export blocking-state tests passed.");
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
