import { useStore } from "./lib/store.js";
import UploadPanel from "./components/upload/UploadPanel.js";
import ArticleGenerator from "./components/generate/ArticleGenerator.js";
import DocEditor from "./components/editor/DocEditor.js";
import ScoreBar from "./components/editor/ScoreBar.js";
import { ChatLogo, Sparkle, WordIcon } from "./components/common/icons.js";
import ProgressBanner from "./components/common/ProgressBanner.js";
import { messages } from "./lib/i18n.js";

/** Root component: sidebar navigation, gradient hero, and the active view. */
export default function App() {
  const { lang, step, mode, busy, progress, error, styleSummary, workspaces, reset, setMode, setLang } = useStore();
  const t = messages[lang];
  const rewriteStep = mode === "rewrite" ? step : workspaces.rewrite.step;
  const generateStep = mode === "generate" ? step : workspaces.generate.step;

  function selectMode(next: "rewrite" | "generate") {
    setMode(next);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="logo">
            <ChatLogo />
          </span>
          <div className="brand-text">
            <strong>Speak Plainly</strong>
            {lang === "zh" && <span className="brand-zh">说人话</span>}
          </div>
        </div>

        <nav className="side-nav" aria-label={t.navTools}>
          <span className="side-caption">{t.navTools}</span>
          <button
            className={`side-item${mode === "rewrite" ? " active" : ""}`}
            onClick={() => selectMode("rewrite")}
          >
            <span className="side-icon">
              <WordIcon />
            </span>
            {t.modeRewrite}
          </button>
          <button
            className={`side-item${mode === "generate" ? " active" : ""}`}
            onClick={() => selectMode("generate")}
          >
            <span className="side-icon">
              <Sparkle />
            </span>
            {t.modeGenerate}
          </button>
        </nav>

        <div className="side-foot">
          <button className="side-item side-lang" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {t.langToggle}
          </button>
        </div>
      </aside>

      <div className="main-pane">
        {step === "upload" ? (
          <header className="hero">
            <h1 className="hero-title">{mode === "rewrite" ? t.heroRewriteTitle : t.heroGenerateTitle}</h1>
            <p className="hero-sub">{mode === "rewrite" ? t.heroRewriteSub : t.heroGenerateSub}</p>
          </header>
        ) : (
          <header className="page-head">
            <h1>{t.editorTitle}</h1>
            <button className="ghost" onClick={reset}>
              {t.restart}
            </button>
          </header>
        )}

        {error && <div className="error banner">{error}</div>}
        {busy && progress ? (
          <ProgressBanner busy={busy} progress={progress} lang={lang} />
        ) : (
          busy && <div className="banner busy">{busy}</div>
        )}

        {step === "ready" && <ScoreBar />}

        {step === "ready" && styleSummary && (
          <details className="style-box">
            <summary>{t.styleProfile}</summary>
            <pre>{styleSummary}</pre>
          </details>
        )}

        <main>
          {/* 两个工作区的编辑器都保持挂载、只用 hidden 切换显隐：卸载会丢掉
              公众号排版等组件本地状态，切回来时进行中的排版就被打断了 */}
          <section hidden={mode !== "rewrite"}>
            {rewriteStep === "upload" ? <UploadPanel /> : <DocEditor />}
          </section>
          <section hidden={mode !== "generate"}>
            {generateStep === "upload" ? <ArticleGenerator /> : <DocEditor />}
          </section>
        </main>

        {step === "ready" && <footer className="hint">{t.editorHint}</footer>}
      </div>
    </div>
  );
}
