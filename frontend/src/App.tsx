import { useStore } from "./store.js";
import UploadPanel from "./components/UploadPanel.js";
import ArticleGenerator from "./components/ArticleGenerator.js";
import DocEditor from "./components/DocEditor.js";
import { ChatLogo, Flower, Heart } from "./components/icons.js";
import { messages } from "./i18n.js";

export default function App() {
  const { lang, step, mode, busy, error, styleSummary, doRewrite, doExport, reset, setMode, setLang } =
    useStore();
  const t = messages[lang];

  return (
    <div className="app">
      <div className="deco stars">
        <span>✨</span>
        <span className="s2">⭐</span>
      </div>

      <header>
        <div className="brand">
          <span className="logo">
            <ChatLogo />
          </span>
          <h1>Speak Plainly</h1>
          {lang === "zh" && <span className="brand-zh">说人话</span>}
          <span className="spark">✨</span>
        </div>

        <div className="header-actions">
          {step === "upload" && (
            <div className="mode-switch">
              <button className={mode === "rewrite" ? "active" : ""} onClick={() => setMode("rewrite")}>
                {t.modeRewrite}
              </button>
              <button className={mode === "generate" ? "active" : ""} onClick={() => setMode("generate")}>
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

          <button className="lang-toggle" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {t.langToggle}
          </button>
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}
      {busy && <div className="banner busy">{busy}</div>}

      {step === "ready" && styleSummary && (
        <details className="style-box">
          <summary>{t.styleProfile}</summary>
          <pre>{styleSummary}</pre>
        </details>
      )}

      <main>{step === "upload" ? mode === "rewrite" ? <UploadPanel /> : <ArticleGenerator /> : <DocEditor />}</main>

      {step === "ready" && <footer className="hint">{t.editorHint}</footer>}

      <div className="deco flower">
        <Flower />
      </div>
      <Heart className="deco heart" />
    </div>
  );
}
