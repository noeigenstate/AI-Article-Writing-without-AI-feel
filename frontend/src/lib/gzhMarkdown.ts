/** Build Markdown from editor state for the 公众号 formatting endpoint. */
import type { ArticleRenderBlockDTO, ParagraphDTO } from "./api.js";

/** Convert plain editor paragraphs back to Markdown. */
export function paragraphsToMarkdown(paragraphs: ParagraphDTO[], titleIndex: number): string {
  const lines: string[] = [];
  for (const p of paragraphs) {
    const text = p.sentences.join("").trim();
    if (!text) continue;
    if (p.kind === "heading1" || p.index === titleIndex) lines.push(`# ${text}`);
    else if (p.kind === "heading2") lines.push(`## ${text}`);
    else if (p.kind === "heading3") lines.push(`### ${text}`);
    else if (p.kind === "list") lines.push(`- ${text}`);
    else lines.push(text);
  }
  return lines.join("\n\n");
}

/** Convert generated-article render blocks (with any manual edits) to Markdown. */
export function renderBlocksToMarkdown(blocks: ArticleRenderBlockDTO[], paragraphs: ParagraphDTO[]): string {
  const edited = new Map(paragraphs.map((p) => [p.index, p.sentences.join("").trim()]));
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph") {
      const text = (b.paragraphIndex !== undefined ? edited.get(b.paragraphIndex) : undefined) ?? b.text.trim();
      if (!text) continue;
      if (b.kind === "heading1") lines.push(`# ${text}`);
      else if (b.kind === "heading2") lines.push(`## ${text}`);
      else if (b.kind === "heading3") lines.push(`### ${text}`);
      else if (b.kind === "list") lines.push(`- ${text}`);
      else lines.push(text);
    } else if (b.type === "figure") {
      // Remote source-image URLs are deliberately not re-emitted: the editor
      // only receives the backend's vetted, inlined SVG representation.
      lines.push(`【插入图表：${b.title}${b.caption ? `——${b.caption}` : ""}】`);
    } else if (b.type === "table") {
      const header = `| ${b.columns.join(" | ")} |`;
      const divider = `| ${b.columns.map(() => "---").join(" | ")} |`;
      const rows = b.rows.map((r) => `| ${r.join(" | ")} |`);
      lines.push(`### ${b.title}`, [header, divider, ...rows].join("\n"));
      if (b.note) lines.push(`> ${b.note}`);
    } else if (b.type === "references") {
      lines.push(`## ${b.title}`, b.items.map((item) => `- ${item}`).join("\n"));
    }
  }
  return lines.join("\n\n");
}
