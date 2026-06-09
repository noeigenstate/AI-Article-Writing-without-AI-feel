import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../../lib/store.js";
import { messages } from "../../lib/i18n.js";

interface Props {
  heading: string;
  original: string;
  anchor?: FloatingAnchor;
  /** 加载候选（句子候选或标题候选） */
  loadCandidates: () => Promise<string[]>;
  onAdopt: (text: string) => void;
  onClose: () => void;
}

type FloatingAnchor = Pick<DOMRect, "left" | "top" | "bottom">;

/** Modal that lists alternative phrasings (or titles) and lets the user adopt/edit one. */
export default function RewritePopover({
  heading,
  original,
  anchor,
  loadCandidates,
  onAdopt,
  onClose,
}: Props) {
  const lang = useStore((s) => s.lang);
  const t = messages[lang];
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const style = floatingStyle(anchor);

  return (
    <div className="popover-layer">
      <div className="popover floating-popover" style={style}>
        <div className="popover-head">
          <span>{heading}</span>
          <button className="link" onClick={onClose}>
            {t.close}
          </button>
        </div>

        <div className="orig">{t.originalLabel}{original}</div>

        <div className="alts">
          {loading && <div className="hint">{t.loadingCandidates}</div>}
          {err && <div className="error">{err}</div>}
          {!loading &&
            !err &&
            alts.map((a, i) => (
              <button key={i} className="alt" onClick={() => onAdopt(a)}>
                {a}
              </button>
            ))}
          {!loading && !err && alts.length === 0 && (
            <div className="hint">{t.noCandidates}</div>
          )}
        </div>

        <div className="edit-area">
          <label>{t.manualEdit}</label>
          <textarea value={edit} onChange={(e) => setEdit(e.target.value)} rows={3} />
          <div className="row-end">
            <button className="primary" onClick={() => onAdopt(edit)}>
              {t.adopt}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function floatingStyle(anchor: FloatingAnchor | undefined): CSSProperties {
  if (!anchor || typeof window === "undefined") return {};

  const margin = 16;
  const width = Math.min(560, window.innerWidth - margin * 2);
  const leftBase = anchor.left ?? margin;
  const topBase = (anchor.bottom ?? anchor.top ?? margin) + 10;
  const left = Math.max(margin, Math.min(leftBase, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(topBase, window.innerHeight - 240));

  return {
    position: "fixed",
    width,
    left,
    top,
  };
}
