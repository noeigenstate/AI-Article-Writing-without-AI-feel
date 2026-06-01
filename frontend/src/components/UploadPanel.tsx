import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { CloudUp } from "./icons.js";
import { messages } from "../i18n.js";

export default function UploadPanel() {
  const doUpload = useStore((s) => s.doUpload);
  const styles = useStore((s) => s.styles);
  const loadStyles = useStore((s) => s.loadStyles);
  const lang = useStore((s) => s.lang);
  const t = messages[lang];
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
          <h2>{t.uploadTitle}</h2>
        </div>
        <label className="filepill">
          <span className="ftype word">W</span>
          <span className="fpick">{t.chooseFile}</span>
          <span className="fsep" />
          <span className={`fname${target ? " has" : ""}`}>
            {target ? target.name : t.noFileChosen}
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
          <h2>{t.chooseStyleTitle}</h2>
        </div>
        <p className="hint">{t.styleHint}</p>

        <select
          className="styleselect"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          <option value="">{t.styleNone}</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {picked && <p className="hint pick-desc">{picked.desc}</p>}

        <label className="filepill">
          <span className="ftype txt">≡</span>
          <span className="fpick">{t.uploadSamples}</span>
          <span className="fsep" />
          <span className={`fname${refs.length ? " has" : ""}`}>
            {refs.length ? t.selectedSamples(refs.length) : t.noSamples}
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
          {t.uploadAndParse}
        </button>
      </div>
    </div>
  );
}
