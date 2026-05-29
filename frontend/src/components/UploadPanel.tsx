import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { CloudUp } from "./icons.js";

export default function UploadPanel() {
  const doUpload = useStore((s) => s.doUpload);
  const styles = useStore((s) => s.styles);
  const loadStyles = useStore((s) => s.loadStyles);
  const [target, setTarget] = useState<File | null>(null);
  const [refs, setRefs] = useState<File[]>([]);
  const [styleId, setStyleId] = useState("");

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  const picked = styles.find((s) => s.id === styleId);

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
          <h2>选择改写风格</h2>
        </div>
        <p className="hint">用内置「我的风格」（蒸馏自你的公众号文章），或上传范文，或两者叠加。</p>

        <select
          className="styleselect"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          <option value="">不指定（仅去 AI 味）/ 用下方范文</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {picked && <p className="hint pick-desc">{picked.desc}</p>}

        <label className="filepill">
          <span className="ftype txt">≡</span>
          <span className="fpick">上传范文</span>
          <span className="fsep" />
          <span className={`fname${refs.length ? " has" : ""}`}>
            {refs.length ? `已选 ${refs.length} 篇范文` : "未选择（可选，.docx / .txt）"}
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
          onClick={() => target && doUpload(target, refs, styleId)}
        >
          <CloudUp />
          上传并解析
        </button>
      </div>
    </div>
  );
}
