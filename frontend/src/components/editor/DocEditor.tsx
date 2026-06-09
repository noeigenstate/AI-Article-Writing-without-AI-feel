import { useState } from "react";
import { useStore } from "../../lib/store.js";
import RewritePopover from "./SentencePopover.js";
import { fetchAlternatives, fetchTitles, type ArticleRenderBlockDTO, type ParagraphDTO } from "../../lib/api.js";
import { messages } from "../../lib/i18n.js";

type Selected =
  | { kind: "sentence"; paraIndex: number; sentenceIdx: number; sentence: string; context: string; anchor: FloatingAnchor }
  | { kind: "title"; paraIndex: number; text: string; anchor: FloatingAnchor };

type FloatingAnchor = Pick<DOMRect, "left" | "top" | "bottom">;

/** Renders the document/article and wires per-sentence and title rephrasing. */
export default function DocEditor() {
  const paragraphs = useStore((s) => s.paragraphs);
  const storedRenderBlocks = useStore((s) => s.renderBlocks);
  const titleIndex = useStore((s) => s.titleIndex);
  const aiScore = useStore((s) => s.aiScore);
  const docId = useStore((s) => s.docId)!;
  const lang = useStore((s) => s.lang);
  const t = messages[lang];
  const setSentence = useStore((s) => s.setSentence);
  const setParagraph = useStore((s) => s.setParagraph);
  const doRewrite = useStore((s) => s.doRewrite);
  const doExport = useStore((s) => s.doExport);
  const [sel, setSel] = useState<Selected | null>(null);

  const currentByIndex = new Map(paragraphs.map((p) => [p.index, p]));
  const originalByIndex = new Map(
    paragraphs.map((p) => [
      p.index,
      {
        ...p,
        sentences: [p.original],
      },
    ])
  );
  const blocks = storedRenderBlocks ?? paragraphs.map((p) => paragraphBlockFromParagraph(p));
  const compare = Boolean(aiScore);

  function renderParagraph(p: ParagraphDTO, isTitle: boolean, interactive: boolean) {
    if (isTitle) {
      const text = p.sentences.join("");
      return (
        <h1 key={p.index} className="para doc-title">
          <span
            className={interactive ? "sentence title-pick" : "sentence readonly-sentence"}
            title={interactive ? t.clickRetitle : undefined}
            onClick={
              interactive
                ? (event) => setSel({ kind: "title", paraIndex: p.index, text, anchor: event.currentTarget.getBoundingClientRect() })
                : undefined
            }
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
              className={interactive ? "sentence" : "sentence readonly-sentence"}
              title={interactive ? t.clickRephrase : undefined}
              onClick={
                interactive
                  ? (event) =>
                      setSel({
                        kind: "sentence",
                        paraIndex: p.index,
                        sentenceIdx: i,
                        sentence: s,
                        context,
                        anchor: event.currentTarget.getBoundingClientRect(),
                      })
                  : undefined
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
  }

  function renderBlockList(paragraphByIndex: Map<number, ParagraphDTO>, interactive: boolean) {
    return blocks.map((block, index) => {
      if (block.type === "figure") {
        return (
          <figure className="doc-figure" key={`figure-${index}`}>
            <h2>{block.title}</h2>
            {block.imageUrl ? (
              <img src={block.imageUrl} alt={block.title} />
            ) : (
              <img src={`data:image/svg+xml;utf8,${encodeURIComponent(block.svg)}`} alt={block.title} />
            )}
            <figcaption>
              {block.caption}
              {block.sourceUrl && (
                <>
                  {" "}
                  <a href={block.sourceUrl} target="_blank" rel="noreferrer">
                    {t.viewSource}
                  </a>
                </>
              )}
            </figcaption>
          </figure>
        );
      }

      if (block.type === "table") {
        return (
          <section className="doc-table-wrap" key={`table-${index}`}>
            <h2>{block.title}</h2>
            <table className="doc-table">
              <thead>
                <tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.note && <p className="table-note">{block.note}</p>}
          </section>
        );
      }

      if (block.type === "references") {
        return (
          <section className="doc-references" key={`references-${index}`}>
            <h2>{block.title}</h2>
            {block.items.map((item) => <p key={item}>{item}</p>)}
          </section>
        );
      }

      const fallback = block.paragraphIndex !== undefined ? paragraphByIndex.get(block.paragraphIndex) : undefined;
      const paragraph = fallback ?? paragraphFromBlock(block, index);
      return renderParagraph(paragraph, paragraph.index === titleIndex, interactive);
    });
  }

  function DocumentActions() {
    return (
      <div className="doc-actions" aria-label={lang === "zh" ? "文档操作" : "Document actions"}>
        <button className="primary doc-action-primary" onClick={doRewrite}>
          {t.polishAll}
        </button>
        <button className="doc-action-secondary" onClick={doExport}>
          {t.exportWord}
        </button>
      </div>
    );
  }

  return (
    <>
      {compare ? (
        <div className="doc-compare">
          <section className="doc compare-doc">
            <div className="compare-label">{lang === "zh" ? "原篇" : "Original"}</div>
            {renderBlockList(originalByIndex, false)}
          </section>
          <section className="doc compare-doc">
            <DocumentActions />
            <div className="compare-label">{lang === "zh" ? "润色后" : "Rewritten"}</div>
            {renderBlockList(currentByIndex, true)}
          </section>
        </div>
      ) : (
        <div className="doc">
          <DocumentActions />
          {renderBlockList(currentByIndex, true)}
        </div>
      )}

      {sel?.kind === "sentence" && (
        <RewritePopover
          heading={t.rephraseHeading}
          original={sel.sentence}
          anchor={sel.anchor}
          loadCandidates={() => fetchAlternatives(docId, sel.context, sel.sentence, 3, lang)}
          onAdopt={(text) => {
            setSentence(sel.paraIndex, sel.sentenceIdx, text);
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}

      {sel?.kind === "title" && (
        <RewritePopover
          heading={t.retitleHeading}
          original={sel.text}
          anchor={sel.anchor}
          loadCandidates={() => fetchTitles(docId, 3, lang)}
          onAdopt={(text) => {
            setParagraph(sel.paraIndex, text);
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}
    </>
  );
}

/** Wrap a plain paragraph as a render block (used when there are no figures/tables). */
function paragraphBlockFromParagraph(p: ParagraphDTO): ArticleRenderBlockDTO {
  return {
    type: "paragraph",
    kind: p.kind,
    text: p.sentences.join(""),
    paragraphIndex: p.index,
  };
}

/** Build an editable paragraph from a render block when no stored paragraph matches. */
function paragraphFromBlock(block: Extract<ArticleRenderBlockDTO, { type: "paragraph" }>, index: number): ParagraphDTO {
  return {
    index: block.paragraphIndex ?? -1 - index,
    kind: block.kind,
    original: block.text,
    sentences: [block.text],
  };
}
