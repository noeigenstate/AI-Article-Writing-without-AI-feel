import { useEffect, useId, useRef, useState } from "react";
import {
  fetchGzhThemes,
  formatGzhArticle,
  type GzhFormatResponseDTO,
  type GzhThemeDTO,
} from "../../lib/api.js";
import { paragraphsToMarkdown, renderBlocksForGzh } from "../../lib/gzhMarkdown.js";
import { hydrateGzhSourceMedia } from "../../lib/gzhMedia.js";
import { useStore } from "../../lib/store.js";
import { Sparkle } from "../common/icons.js";
import ProgressBanner from "../common/ProgressBanner.js";
import { messages } from "../../lib/i18n.js";

/** A blocking backend validation error makes both rich-copy and HTML download unavailable. */
export function canExportGzhResult(
  result: Pick<GzhFormatResponseDTO, "validation"> | GzhFormatResponseDTO | null
): result is GzhFormatResponseDTO {
  return Boolean(result && result.validation.errors.length === 0);
}

/**
 * Inline 公众号排版 panel for the current editor document: pick a theme,
 * auto-format the current text, then copy the rich text or download HTML.
 */
export default function GzhExportPanel() {
  const lang = useStore((s) => s.lang);
  const paragraphs = useStore((s) => s.paragraphs);
  const renderBlocks = useStore((s) => s.renderBlocks);
  const titleIndex = useStore((s) => s.titleIndex);
  const globalBusy = useStore((s) => s.busy);
  const t = messages[lang];

  const [themes, setThemes] = useState<GzhThemeDTO[]>([]);
  const [themeId, setThemeId] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ task: "gzhFormat"; startedAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GzhFormatResponseDTO | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const themeSelectId = useId();

  useEffect(() => {
    void fetchGzhThemes(lang).then((list) => {
      setThemes(list);
      setThemeId((cur) => (list.some((x) => x.id === cur) ? cur : list[0]?.id ?? ""));
    });
  }, [lang]);

  function buildGzhInput() {
    return renderBlocks?.length
      ? renderBlocksForGzh(renderBlocks, paragraphs)
      : { markdown: paragraphsToMarkdown(paragraphs, titleIndex), sourceMedia: [] };
  }

  function buildMarkdown(): string {
    return buildGzhInput().markdown;
  }

  async function format() {
    setWorking(true);
    setError(null);
    setResult(null);
    setCopied(null);
    setProgress({ task: "gzhFormat", startedAt: Date.now() });
    try {
      const prepared = buildGzhInput();
      const formatted = await formatGzhArticle(prepared.markdown, themeId, "", lang);
      const hydrated = hydrateGzhSourceMedia(formatted.html, prepared.sourceMedia, lang);
      const mediaWarning = hydrated.missingTokens.length > 0
        ? (lang === "zh"
            ? `有 ${hydrated.missingTokens.length} 个来源素材未能恢复，已保留为待补素材。`
            : `${hydrated.missingTokens.length} source media item(s) could not be restored and remain placeholders.`)
        : undefined;
      setResult({
        ...formatted,
        html: hydrated.html,
        validation: mediaWarning
          ? { ...formatted.validation, warnings: [...formatted.validation.warnings, mediaWarning] }
          : formatted.validation,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setProgress(null);
    }
  }

  /** Copy the formatted rich text: ClipboardItem first, iframe selection as fallback. */
  async function copyToClipboard() {
    if (!canExportGzhResult(result)) return;
    if (result && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([result.html], { type: "text/html" }),
            "text/plain": new Blob([buildMarkdown()], { type: "text/plain" }),
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
    if (!canExportGzhResult(result)) return;
    const page = buildStandalonePreview(result.title, result.html, t.gzhCopyBtn, lang);
    const blob = new Blob([page], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(result.title)}_${result.themeName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isBusy = working || Boolean(globalBusy);
  const validation = result?.validation;
  const hasBlockingValidation = Boolean(result && !canExportGzhResult(result));
  const selectedTheme = themes.find((x) => x.id === themeId);

  return (
    <section className="gzh-panel">
      <div className="gzh-panel-row">
        <strong className="gzh-panel-title">{t.gzhPanelTitle}</strong>
        <label className="sr-only" htmlFor={themeSelectId}>
          {lang === "zh" ? "排版主题" : "Formatting theme"}
        </label>
        <select
          id={themeSelectId}
          className="styleselect compact"
          value={themeId}
          disabled={isBusy}
          onChange={(e) => setThemeId(e.target.value)}
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <button className="primary" disabled={isBusy || !paragraphs.length} onClick={() => void format()}>
          <Sparkle />
          {working ? t.gzhFormatting : t.gzhFormatBtn}
        </button>
        {result && (
          <>
            <button
              className="primary"
              disabled={hasBlockingValidation}
              title={hasBlockingValidation ? (lang === "zh" ? "请先解决阻断问题" : "Resolve blocking issues before copying") : undefined}
              onClick={() => void copyToClipboard()}
            >
              {t.gzhCopyBtn}
            </button>
            <button
              className="ghost"
              disabled={hasBlockingValidation}
              title={hasBlockingValidation ? (lang === "zh" ? "请先解决阻断问题" : "Resolve blocking issues before downloading") : undefined}
              onClick={downloadHtml}
            >
              {t.gzhDownloadBtn}
            </button>
          </>
        )}
      </div>
      {selectedTheme && !result && !working && <p className="hint gzh-scene">{selectedTheme.scene}</p>}
      {error && <div className="error topic-error" role="alert">{error}</div>}
      {working && progress && <ProgressBanner busy={t.gzhFormatting} progress={progress} lang={lang} />}
      {copied === "ok" && <div className="banner busy gzh-toast-ok" role="status">{t.gzhCopied}</div>}
      {copied === "fail" && <div className="error topic-error" role="alert">{t.gzhCopyFail}</div>}
      {result && (
        <>
          <div className="gzh-result-bar">
            <span
              className={`gzh-validation ${
                validation && validation.errors.length ? "bad" : validation?.warnings.length ? "warn" : "ok"
              }`}
              role={validation && validation.errors.length ? "alert" : "status"}
            >
              {validation && validation.errors.length
                ? t.gzhValidationErr(validation.errors.length)
                : validation?.warnings.length
                  ? t.gzhValidationWarn(validation.warnings.length)
                  : t.gzhValidationOk}
            </span>
            <span className="hint">{t.gzhPreviewNote}</span>
          </div>
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
          <iframe
            ref={frameRef}
            className="gzh-preview"
            title={t.gzhPanelTitle}
            sandbox="allow-same-origin"
            srcDoc={buildPreviewDoc(result.html, lang)}
          />
        </>
      )}
    </section>
  );
}

/** Minimal same-origin preview shell; `#gzh-content` is what gets copied. */
function buildPreviewDoc(html: string, lang: "en" | "zh"): string {
  return [
    `<!DOCTYPE html><html lang="${lang === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8">`,
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
function buildStandalonePreview(title: string, html: string, copyLabel: string, lang: "en" | "zh"): string {
  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
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
  <span class="gzh-hint">排版预览 · 点击右侧按钮复制，随后粘贴到公众号编辑器</span>
  <button class="gzh-copy" onclick="gzhCopy(this)">${escapeHtml(copyLabel)}</button>
</div>
<div class="gzh-toast" id="gzhToast" aria-live="polite" aria-atomic="true"></div>
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
  t.setAttribute('role',ok?'status':'alert');
  t.setAttribute('aria-live',ok?'polite':'assertive');
  t.textContent=ok?'已复制。请在公众号编辑器中按 Ctrl/⌘+V 粘贴。':'复制失败，请手动全选内容后复制。';
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
