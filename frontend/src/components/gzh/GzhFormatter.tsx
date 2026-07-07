import { useEffect, useRef, useState } from "react";
import {
  fetchGzhThemes,
  formatGzhArticle,
  type ArticleRenderBlockDTO,
  type GzhFormatResponseDTO,
  type GzhThemeDTO,
  type ParagraphDTO,
} from "../../lib/api.js";
import { useStore } from "../../lib/store.js";
import { Sparkle } from "../common/icons.js";
import ProgressBanner from "../common/ProgressBanner.js";
import { messages } from "../../lib/i18n.js";

/**
 * "公众号排版" view: paste/import an article → pick a theme → format it into
 * WeChat-editor-ready HTML with live preview, one-click rich-text copy, and
 * an HTML download (integrated from gzh-design-skill).
 */
export default function GzhFormatter() {
  const lang = useStore((s) => s.lang);
  const rewriteWs = useStore((s) => (s.mode === "rewrite" ? null : s.workspaces.rewrite));
  const generateWs = useStore((s) => (s.mode === "generate" ? null : s.workspaces.generate));
  const t = messages[lang];

  const [themes, setThemes] = useState<GzhThemeDTO[]>([]);
  const [themeId, setThemeId] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ task: "gzhFormat"; startedAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GzhFormatResponseDTO | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void fetchGzhThemes(lang).then((list) => {
      setThemes(list);
      setThemeId((cur) => (list.some((x) => x.id === cur) ? cur : list[0]?.id ?? ""));
    });
  }, [lang]);

  const rewriteReady = Boolean(rewriteWs && rewriteWs.paragraphs.length);
  const generateReady = Boolean(generateWs && (generateWs.renderBlocks?.length || generateWs.paragraphs.length));

  function importRewrite() {
    if (!rewriteWs) return;
    setMarkdown(paragraphsToMarkdown(rewriteWs.paragraphs, rewriteWs.titleIndex));
    setError(null);
  }

  function importGenerate() {
    if (!generateWs) return;
    setMarkdown(
      generateWs.renderBlocks?.length
        ? renderBlocksToMarkdown(generateWs.renderBlocks, generateWs.paragraphs)
        : paragraphsToMarkdown(generateWs.paragraphs, generateWs.titleIndex)
    );
    setError(null);
  }

  async function format() {
    if (!markdown.trim()) {
      setError(t.gzhEmptyErr);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(null);
    setProgress({ task: "gzhFormat", startedAt: Date.now() });
    try {
      setResult(await formatGzhArticle(markdown, themeId, author.trim(), lang));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /** Copy the formatted rich text: ClipboardItem first, iframe selection as fallback. */
  async function copyToClipboard() {
    if (result && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([result.html], { type: "text/html" }),
            "text/plain": new Blob([markdown], { type: "text/plain" }),
          }),
        ]);
        setCopied("ok");
        return;
      } catch {
        /* fall through to selection copy */
      }
    }
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    const el = doc?.getElementById("gzh-content");
    if (!doc || !win || !el) {
      setCopied("fail");
      return;
    }
    const range = doc.createRange();
    range.selectNodeContents(el);
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    let ok = false;
    try {
      ok = doc.execCommand("copy");
    } catch {
      ok = false;
    }
    sel?.removeAllRanges();
    setCopied(ok ? "ok" : "fail");
  }

  function downloadHtml() {
    if (!result) return;
    const page = buildStandalonePreview(result.title, result.html, t.gzhCopyBtn);
    const blob = new Blob([page], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(result.title)}_${result.themeName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const validation = result?.validation;

  return (
    <div className="generator">
      <section className="step lavender">
        <div className="step-head">
          <span className="badge lavender">1</span>
          <h2>{t.gzhStep1}</h2>
        </div>
        <div className="gzh-import-row">
          <button className="ghost" disabled={!rewriteReady || busy} onClick={importRewrite}>
            {t.gzhImportRewrite}
          </button>
          <button className="ghost" disabled={!generateReady || busy} onClick={importGenerate}>
            {t.gzhImportGenerate}
          </button>
          <span className="hint gzh-count">{t.gzhCharCount(markdown.length)}</span>
        </div>
        <textarea
          className="text-input gzh-textarea"
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            setError(null);
          }}
          placeholder={t.gzhPastePlaceholder}
          rows={10}
          spellCheck={false}
        />
        <p className="hint pick-desc">{t.gzhPasteTip}</p>
      </section>

      <section className="step mint">
        <div className="step-head">
          <span className="badge mint">2</span>
          <h2>{t.gzhStep2}</h2>
        </div>
        <div className="domain-grid gzh-theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`domain-card gzh-theme-card${themeId === theme.id ? " active" : ""}`}
              onClick={() => setThemeId(theme.id)}
            >
              <span className="gzh-theme-name">
                <span className="gzh-swatch" style={{ background: theme.primary }} />
                {theme.accent && <span className="gzh-swatch" style={{ background: theme.accent }} />}
                {theme.name}
              </span>
              <small>{theme.scene}</small>
            </button>
          ))}
        </div>
        <div className="generator-row gzh-action-row">
          <label className="gzh-author">
            <span className="hint">{t.gzhAuthorLabel}</span>
            <input
              className="text-input"
              value={author}
              maxLength={24}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={t.gzhAuthorPlaceholder}
            />
          </label>
          <button className="primary" disabled={busy || !markdown.trim()} onClick={() => void format()}>
            <Sparkle />
            {busy ? t.gzhFormatting : t.gzhFormatBtn}
          </button>
        </div>
        {error && <div className="error topic-error">{error}</div>}
        {busy && progress && <ProgressBanner busy={t.gzhFormatting} progress={progress} lang={lang} />}
      </section>

      {result && (
        <section className="step gzh-result">
          <div className="step-head">
            <span className="badge lavender">3</span>
            <h2>{t.gzhResultTitle}</h2>
          </div>
          <div className="gzh-result-bar">
            <span
              className={`gzh-validation ${
                validation && validation.errors.length ? "bad" : validation?.warnings.length ? "warn" : "ok"
              }`}
            >
              {validation && validation.errors.length
                ? t.gzhValidationErr(validation.errors.length)
                : validation?.warnings.length
                  ? t.gzhValidationWarn(validation.warnings.length)
                  : t.gzhValidationOk}
            </span>
            <div className="gzh-result-actions">
              <button className="primary" onClick={copyToClipboard}>
                {t.gzhCopyBtn}
              </button>
              <button className="ghost" onClick={downloadHtml}>
                {t.gzhDownloadBtn}
              </button>
            </div>
          </div>
          {copied === "ok" && <div className="banner busy gzh-toast-ok">{t.gzhCopied}</div>}
          {copied === "fail" && <div className="error topic-error">{t.gzhCopyFail}</div>}
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <details className="style-box gzh-issues">
              <summary>
                {validation.errors.length
                  ? t.gzhValidationErr(validation.errors.length)
                  : t.gzhValidationWarn(validation.warnings.length)}
              </summary>
              <ul>
                {validation.errors.map((e) => (
                  <li key={e} className="gzh-issue-err">
                    {e}
                  </li>
                ))}
                {validation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="hint pick-desc">{t.gzhPreviewNote}</p>
          <iframe
            ref={frameRef}
            className="gzh-preview"
            title={t.gzhResultTitle}
            sandbox="allow-same-origin"
            srcDoc={buildPreviewDoc(result.html)}
          />
        </section>
      )}
    </div>
  );
}

/** Convert editor paragraphs (rewrite workspace) back to Markdown. */
function paragraphsToMarkdown(paragraphs: ParagraphDTO[], titleIndex: number): string {
  const lines: string[] = [];
  for (const p of paragraphs) {
    const text = p.sentences.join("").trim();
    if (!text) continue;
    if (p.kind === "heading1" || p.index === titleIndex) lines.push(`# ${text}`);
    else if (p.kind === "heading2") lines.push(`## ${text}`);
    else if (p.kind === "heading3") lines.push(`### ${text}`);
    else if (p.kind === "list") lines.push(`- ${text}`);
    else lines.push(text);
  }
  return lines.join("\n\n");
}

/** Convert generated-article render blocks (with any manual edits) to Markdown. */
function renderBlocksToMarkdown(blocks: ArticleRenderBlockDTO[], paragraphs: ParagraphDTO[]): string {
  const edited = new Map(paragraphs.map((p) => [p.index, p.sentences.join("").trim()]));
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph") {
      const text = (b.paragraphIndex !== undefined ? edited.get(b.paragraphIndex) : undefined) ?? b.text.trim();
      if (!text) continue;
      if (b.kind === "heading1") lines.push(`# ${text}`);
      else if (b.kind === "heading2") lines.push(`## ${text}`);
      else if (b.kind === "heading3") lines.push(`### ${text}`);
      else if (b.kind === "list") lines.push(`- ${text}`);
      else lines.push(text);
    } else if (b.type === "figure") {
      if (b.imageUrl) lines.push(`![${b.caption || b.title}](${b.imageUrl})`);
      else lines.push(`【插入图表：${b.title}${b.caption ? `——${b.caption}` : ""}】`);
    } else if (b.type === "table") {
      const header = `| ${b.columns.join(" | ")} |`;
      const divider = `| ${b.columns.map(() => "---").join(" | ")} |`;
      const rows = b.rows.map((r) => `| ${r.join(" | ")} |`);
      lines.push(`### ${b.title}`, [header, divider, ...rows].join("\n"));
      if (b.note) lines.push(`> ${b.note}`);
    } else if (b.type === "references") {
      lines.push(`## ${b.title}`, b.items.map((item) => `- ${item}`).join("\n"));
    }
  }
  return lines.join("\n\n");
}

/** Minimal same-origin preview shell; `#gzh-content` is what gets copied. */
function buildPreviewDoc(html: string): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    "<style>body{margin:0;background:#eef0f2;padding:18px 10px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;}",
    "#gzh-stage{max-width:640px;margin:0 auto;}</style></head><body>",
    `<div id="gzh-stage"><div id="gzh-content">${html}</div></div>`,
    "</body></html>",
  ].join("");
}

/**
 * Standalone downloadable preview page with a copy-to-clipboard toolbar
 * (ported from gzh-design-skill's wrap_preview template).
 */
function buildStandalonePreview(title: string, html: string, copyLabel: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · 公众号排版预览</title>
<style>
  body{margin:0;background:#eef0f2;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;}
  .gzh-toolbar{position:fixed;top:0;left:0;right:0;height:54px;background:#fff;box-shadow:0 1px 10px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:99;}
  .gzh-hint{font-size:13px;color:#6b7280;}
  .gzh-copy{background:#07C160;color:#fff;border:0;border-radius:9px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;}
  .gzh-toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .25s;z-index:100;}
  .gzh-toast.show{opacity:1;}
  .gzh-stage{max-width:700px;margin:78px auto 64px;padding:0 8px;}
</style>
</head>
<body>
<div class="gzh-toolbar">
  <span class="gzh-hint">👇 排版效果 · 点右侧按钮复制后直接粘到公众号</span>
  <button class="gzh-copy" onclick="gzhCopy(this)">📋 ${escapeHtml(copyLabel)}</button>
</div>
<div class="gzh-toast" id="gzhToast"></div>
<div class="gzh-stage"><div id="gzh-content">
${html}
</div></div>
<script>
function gzhCopy(btn){
  var el=document.getElementById('gzh-content');
  var range=document.createRange();range.selectNodeContents(el);
  var sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  var ok=false;try{ok=document.execCommand('copy');}catch(e){}
  sel.removeAllRanges();
  var t=document.getElementById('gzhToast');
  t.textContent=ok?'✅ 已复制！去公众号编辑器 Ctrl/⌘+V 粘贴':'⚠ 复制失败，请手动全选复制';
  t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);
}
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60) || "article";
}
