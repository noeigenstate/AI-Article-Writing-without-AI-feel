import { useState } from "react";
import { useStore } from "../store.js";
import { CloudUp } from "./icons.js";

export default function UploadPanel() {
  const doUpload = useStore((s) => s.doUpload);
  const [target, setTarget] = useState<File | null>(null);
  const [refs, setRefs] = useState<File[]>([]);

  return (
    <div className="upload">
      <div className="step peach">
        <div className="step-head">
          <span className="badge peach">1</span>
          <h2>上传待改写的 Word</h2>
        </div>
        <label className="filepill">
          <span className="ftype word">W</span>
          <span className="fpick">选择文件</span>
          <span className="fsep" />
          <span className={`fname${target ? " has" : ""}`}>
            {target ? target.name : "未选择任何文件"}
          </span>
          <span className="fcloud">
            <CloudUp />
          </span>
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setTarget(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="step mint">
        <div className="step-head">
          <span className="badge mint">2</span>
          <h2>上传风格范文（可多篇，.docx 或 .txt，可选）</h2>
        </div>
        <p className="hint">范文是去 AI 味的标尺——AI 会模仿它们的句长、用词和语气。</p>
        <label className="filepill">
          <span className="ftype txt">≡</span>
          <span className="fpick">选择文件</span>
          <span className="fsep" />
          <span className={`fname${refs.length ? " has" : ""}`}>
            {refs.length ? `已选 ${refs.length} 篇范文` : "未选择任何文件"}
          </span>
          <span className="fcloud">
            <CloudUp />
          </span>
          <input
            type="file"
            accept=".docx,.txt"
            multiple
            onChange={(e) => setRefs(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>

      <div className="row-end">
        <button
          className="cta"
          disabled={!target}
          onClick={() => target && doUpload(target, refs)}
        >
          <CloudUp />
          上传并解析
        </button>
      </div>
    </div>
  );
}
