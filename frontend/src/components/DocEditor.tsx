import { useState } from "react";
import { useStore } from "../store.js";
import SentencePopover from "./SentencePopover.js";

interface Selected {
  paraIndex: number;
  sentenceIdx: number;
  sentence: string;
  context: string;
}

export default function DocEditor() {
  const paragraphs = useStore((s) => s.paragraphs);
  const [sel, setSel] = useState<Selected | null>(null);

  return (
    <div className="doc">
      {paragraphs.map((p) => {
        const Tag =
          p.kind === "heading1" ? "h1" : p.kind === "heading2" ? "h2" : p.kind === "heading3" ? "h3" : "p";
        const context = p.sentences.join("");
        return (
          <Tag key={p.index} className={`para ${p.kind}`}>
            {p.sentences.map((s, i) =>
              s.trim() ? (
                <span
                  key={i}
                  className="sentence"
                  title="点击换个说法 / 编辑"
                  onClick={() =>
                    setSel({ paraIndex: p.index, sentenceIdx: i, sentence: s, context })
                  }
                >
                  {s}
                </span>
              ) : (
                <span key={i}>{s}</span>
              )
            )}
          </Tag>
        );
      })}

      {sel && (
        <SentencePopover
          paraIndex={sel.paraIndex}
          sentenceIdx={sel.sentenceIdx}
          sentence={sel.sentence}
          context={sel.context}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
