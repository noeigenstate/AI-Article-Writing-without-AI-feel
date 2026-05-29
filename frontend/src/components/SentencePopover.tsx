import { useEffect, useState } from "react";
import { fetchAlternatives } from "../api.js";
import { useStore } from "../store.js";

interface Props {
  paraIndex: number;
  sentenceIdx: number;
  sentence: string;
  context: string;
  onClose: () => void;
}

export default function SentencePopover({
  paraIndex,
  sentenceIdx,
  sentence,
  context,
  onClose,
}: Props) {
  const docId = useStore((s) => s.docId)!;
  const setSentence = useStore((s) => s.setSentence);

  const [loading, setLoading] = useState(true);
  const [alts, setAlts] = useState<string[]>([]);
  const [edit, setEdit] = useState(sentence);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAlternatives(docId, context, sentence, 3)
      .then((a) => alive && setAlts(a))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [docId, context, sentence]);

  const adopt = (text: string) => {
    setSentence(paraIndex, sentenceIdx, text);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popover" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span>换个说法</span>
          <button className="link" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="orig">原句：{sentence}</div>

        <div className="alts">
          {loading && <div className="hint">生成候选中…</div>}
          {err && <div className="error">{err}</div>}
          {!loading &&
            !err &&
            alts.map((a, i) => (
              <button key={i} className="alt" onClick={() => adopt(a)}>
                {a}
              </button>
            ))}
          {!loading && !err && alts.length === 0 && (
            <div className="hint">没拿到候选，可手动编辑。</div>
          )}
        </div>

        <div className="edit-area">
          <label>手动编辑：</label>
          <textarea value={edit} onChange={(e) => setEdit(e.target.value)} rows={3} />
          <div className="row-end">
            <button className="primary" onClick={() => adopt(edit)}>
              采用这段
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
