import { useStore } from "./store.js";
import UploadPanel from "./components/UploadPanel.js";
import DocEditor from "./components/DocEditor.js";
import { ChatLogo, Flower, Heart } from "./components/icons.js";

export default function App() {
  const { step, busy, error, styleSummary, doRewrite, doExport, reset } = useStore();

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
          <h1>Speak Plainly · 去 AI 味改写</h1>
          <span className="spark">✨</span>
        </div>

        {step === "ready" && (
          <div className="toolbar">
            <button className="primary" onClick={doRewrite}>
              整篇改写（去 AI 味）
            </button>
            <button onClick={doExport}>导出 Word</button>
            <button className="ghost" onClick={reset}>
              重新上传
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

      <main>{step === "upload" ? <UploadPanel /> : <DocEditor />}</main>

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
