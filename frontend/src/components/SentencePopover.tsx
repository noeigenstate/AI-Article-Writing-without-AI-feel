import { useEffect, useState } from "react";

interface Props {
  heading: string;
  original: string;
  /** 加载候选（句子候选或标题候选） */
  loadCandidates: () => Promise<string[]>;
  onAdopt: (text: string) => void;
  onClose: () => void;
}

export default function RewritePopover({
  heading,
  original,
  loadCandidates,
  onAdopt,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [alts, setAlts] = useState<string[]>([]);
  const [edit, setEdit] = useState(original);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCandidates()
      .then((a) => alive && setAlts(a))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popover" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span>{heading}</span>
          <button className="link" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="orig">原文：{original}</div>

        <div className="alts">
          {loading && <div className="hint">生成候选中…</div>}
          {err && <div className="error">{err}</div>}
          {!loading &&
            !err &&
            alts.map((a, i) => (
              <button key={i} className="alt" onClick={() => onAdopt(a)}>
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
            <button className="primary" onClick={() => onAdopt(edit)}>
              采用这段
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
