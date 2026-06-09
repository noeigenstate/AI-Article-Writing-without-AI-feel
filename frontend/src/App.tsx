import { useStore } from "./lib/store.js";
import UploadPanel from "./components/upload/UploadPanel.js";
import ArticleGenerator from "./components/generate/ArticleGenerator.js";
import DocEditor from "./components/editor/DocEditor.js";
import ScoreBar from "./components/editor/ScoreBar.js";
import { ChatLogo } from "./components/common/icons.js";
import LiquidGlass from "./components/common/LiquidGlass.js";
import RainLayer from "./components/common/RainLayer.js";
import { messages } from "./lib/i18n.js";

/** Root component: header, mode switch, score panel, and the active view. */
export default function App() {
  const { lang, step, mode, busy, error, styleSummary, doRewrite, doExport, reset, setMode, setLang } =
    useStore();
  const t = messages[lang];

  return (
    <div className="scene-page">
      <RainLayer />
      <LiquidGlass className="app" variant="panel" radius={34} displacement={46}>
        <header>
          <div className="brand">
            <span className="logo">
              <ChatLogo />
            </span>
            <div className="brand-text">
              <h1>Speak Plainly{lang === "zh" && <span className="brand-zh">说人话</span>}</h1>
            </div>
          </div>

          <div className="header-actions top-controls">
            {step === "upload" && (
              <div className="glass-tabs" role="tablist" aria-label="Mode">
                <button
                  className={`glass-tab${mode === "rewrite" ? " active" : ""}`}
                  onClick={() => setMode("rewrite")}
                >
                  {t.modeRewrite}
                </button>
                <button
                  className={`glass-tab${mode === "generate" ? " active" : ""}`}
                  onClick={() => setMode("generate")}
                >
                  {t.modeGenerate}
                </button>
              </div>
            )}

            {step === "ready" && (
              <div className="toolbar">
                <button className="primary" onClick={doRewrite}>
                  {t.polishAll}
                </button>
                <button onClick={doExport}>{t.exportWord}</button>
                <button className="ghost" onClick={reset}>
                  {t.restart}
                </button>
              </div>
            )}

            <button className="glass-lang" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
              {t.langToggle}
            </button>
          </div>
        </header>

        {error && <div className="error banner">{error}</div>}
        {busy && <div className="banner busy">{busy}</div>}

        {step === "ready" && <ScoreBar />}

        {step === "ready" && styleSummary && (
          <details className="style-box">
            <summary>{t.styleProfile}</summary>
            <pre>{styleSummary}</pre>
          </details>
        )}

        <main>{step === "upload" ? mode === "rewrite" ? <UploadPanel /> : <ArticleGenerator /> : <DocEditor />}</main>

        {step === "ready" && <footer className="hint">{t.editorHint}</footer>}
      </LiquidGlass>
    </div>
  );
}
