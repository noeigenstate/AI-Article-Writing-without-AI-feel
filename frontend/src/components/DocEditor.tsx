import { useState } from "react";
import { useStore } from "../store.js";
import RewritePopover from "./SentencePopover.js";
import { fetchAlternatives, fetchTitles } from "../api.js";

type Selected =
  | { kind: "sentence"; paraIndex: number; sentenceIdx: number; sentence: string; context: string }
  | { kind: "title"; paraIndex: number; text: string };

export default function DocEditor() {
  const paragraphs = useStore((s) => s.paragraphs);
  const titleIndex = useStore((s) => s.titleIndex);
  const docId = useStore((s) => s.docId)!;
  const setSentence = useStore((s) => s.setSentence);
  const setParagraph = useStore((s) => s.setParagraph);
  const [sel, setSel] = useState<Selected | null>(null);

  return (
    <div className="doc">
      {paragraphs.map((p) => {
        // 标题：整段作为一个可点块，单独走"重拟标题"逻辑
        if (p.index === titleIndex) {
          const text = p.sentences.join("");
          return (
            <h1 key={p.index} className="para doc-title">
              <span
                className="sentence title-pick"
                title="点击重拟标题（概括全文、抓住注意力）"
                onClick={() => setSel({ kind: "title", paraIndex: p.index, text })}
              >
                {text}
              </span>
            </h1>
          );
        }

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
                    setSel({ kind: "sentence", paraIndex: p.index, sentenceIdx: i, sentence: s, context })
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

      {sel?.kind === "sentence" && (
        <RewritePopover
          heading="换个说法"
          original={sel.sentence}
          loadCandidates={() => fetchAlternatives(docId, sel.context, sel.sentence, 3)}
          onAdopt={(text) => {
            setSentence(sel.paraIndex, sel.sentenceIdx, text);
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}

      {sel?.kind === "title" && (
        <RewritePopover
          heading="重拟标题（概括全文、抓住注意力）"
          original={sel.text}
          loadCandidates={() => fetchTitles(docId, 3)}
          onAdopt={(text) => {
            setParagraph(sel.paraIndex, text);
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
