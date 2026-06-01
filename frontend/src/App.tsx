import { useStore } from "./store.js";
import UploadPanel from "./components/UploadPanel.js";
import ArticleGenerator from "./components/ArticleGenerator.js";
import DocEditor from "./components/DocEditor.js";
import { ChatLogo, Flower, Heart } from "./components/icons.js";

export default function App() {
  const { step, mode, busy, error, styleSummary, doRewrite, doExport, reset, setMode } = useStore();

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
          <h1>MoZheng · 墨证</h1>
          <span className="spark">✨</span>
        </div>

        {step === "upload" && (
          <div className="mode-switch">
            <button className={mode === "rewrite" ? "active" : ""} onClick={() => setMode("rewrite")}>
              改写 Word
            </button>
            <button className={mode === "generate" ? "active" : ""} onClick={() => setMode("generate")}>
              生成公众号
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="toolbar">
            <button className="primary" onClick={doRewrite}>
              整篇润色（去 AI 味）
            </button>
            <button onClick={doExport}>导出 Word</button>
            <button className="ghost" onClick={reset}>
              重新开始
            </button>
          </div>
        )}
      </header>

      {error && <div className="error banner">{error}</div>}
      {busy && <div className="banner busy">{busy}</div>}

      {step === "ready" && styleSummary && (
        <details className="style-box">
          <summary>已提取的风格画像</summary>
          <pre>{styleSummary}</pre>
        </details>
      )}

      <main>{step === "upload" ? mode === "rewrite" ? <UploadPanel /> : <ArticleGenerator /> : <DocEditor />}</main>

      {step === "ready" && (
        <footer className="hint">点任意句子 → 选候选表达或手动编辑。改完点「导出 Word」。</footer>
      )}

      <div className="deco flower">
        <Flower />
      </div>
      <Heart className="deco heart" />
    </div>
  );
}
