import type { GzhSourceMedia } from "./gzhMarkdown.js";
import { safePublicSourcePageUrl } from "./sourceUrl.js";

export interface GzhMediaHydrationResult {
  html: string;
  restoredCount: number;
  missingTokens: string[];
}

/**
 * Replace model-rendered source-media placeholders with trusted inline media.
 *
 * Source bytes never pass through the formatting model. This function runs
 * only after the backend has returned sanitized HTML and adds a narrowly
 * constructed image block from the already-vetted article response.
 */
export function hydrateGzhSourceMedia(
  html: string,
  sourceMedia: readonly GzhSourceMedia[],
  lang: "en" | "zh"
): GzhMediaHydrationResult {
  if (sourceMedia.length === 0) {
    return { html, restoredCount: 0, missingTokens: [] };
  }

  let hydratedHtml = html;
  let restoredCount = 0;
  const missingTokens: string[] = [];
  for (const media of sourceMedia) {
    if (!isSafeInlineSourceMedia(media)) {
      missingTokens.push(media.token);
      continue;
    }
    const placeholder = sourceMediaPlaceholderRange(hydratedHtml, media.token, true)
      ?? sourceMediaPlaceholderRange(hydratedHtml, media.sourceUrl, false)
      ?? sourceMediaPlaceholderRange(hydratedHtml, escapeHtmlText(media.sourceUrl), false);
    if (!placeholder) {
      missingTokens.push(media.token);
      continue;
    }
    hydratedHtml = `${hydratedHtml.slice(0, placeholder.start)}${buildSourceMediaBlock(media, lang)}${hydratedHtml.slice(placeholder.end)}`;
    restoredCount += 1;
  }

  return { html: hydratedHtml, restoredCount, missingTokens };
}

interface SectionRange {
  start: number;
  end: number;
  openTag: string;
}

/** Find the smallest balanced section around a model-preserved placement token. */
function sourceMediaPlaceholderRange(
  html: string,
  marker: string,
  allowPlainSection: boolean
): SectionRange | undefined {
  let markerIndex = html.indexOf(marker);
  while (markerIndex >= 0) {
    const containing = sectionRangesAtIndex(html, markerIndex);
    const dashed = containing.find((section) => /(?:^|;)\s*border(?:-[^:]+)?\s*:[^;]*dashed/iu.test(
      attributeValue(section.openTag, "style") ?? ""
    ));
    if (dashed) return dashed;

    const pending = containing.find((section) =>
      /待补素材|待补|placeholder|source\s+(?:image|gif)|insert\s+(?:image|gif)/iu.test(
        html.slice(section.start, section.end).replace(/<[^>]*>/gu, " ")
      )
    );
    if (pending) return pending;
    if (allowPlainSection && containing[0]) return containing[0];
    markerIndex = html.indexOf(marker, markerIndex + marker.length);
  }
  return undefined;
}

function sectionRangesAtIndex(html: string, markerIndex: number): SectionRange[] {
  const tagPattern = /<section(?:\s[^>]*)?>|<\/section\s*>/giu;
  const stack: Array<{ start: number; openTag: string }> = [];
  const containing: SectionRange[] = [];
  for (const match of html.matchAll(tagPattern)) {
    const start = match.index;
    const tag = match[0];
    if (!/^<\/section/iu.test(tag)) {
      stack.push({ start, openTag: tag });
      continue;
    }
    const opening = stack.pop();
    if (!opening) continue;
    const end = start + tag.length;
    if (opening.start < markerIndex && markerIndex < end) {
      containing.push({ start: opening.start, end, openTag: opening.openTag });
    }
  }
  return containing;
}

function attributeValue(tag: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2];
}

function isSafeInlineSourceMedia(media: GzhSourceMedia): boolean {
  const allowedMime = media.mediaKind === "gif"
    ? media.mimeType === "image/gif"
    : media.mimeType === "image/png" || media.mimeType === "image/jpeg" || media.mimeType === "image/webp";
  const prefix = `data:${media.mimeType};base64,`;
  const payload = media.mediaDataUri.startsWith(prefix) ? media.mediaDataUri.slice(prefix.length) : "";
  const safeSourceUrl = safePublicSourcePageUrl(media.sourceUrl);
  return allowedMime
    && payload.length > 0
    && /^[a-z0-9+/]+={0,2}$/iu.test(payload)
    && Number.isSafeInteger(media.width)
    && media.width > 0
    && Number.isSafeInteger(media.height)
    && media.height > 0
    && Number.isSafeInteger(media.sourceRef)
    && media.sourceRef > 0
    && Boolean(media.alt.trim() && media.sourceName.trim() && media.sourceTitle.trim())
    && safeSourceUrl === media.sourceUrl;
}

function buildSourceMediaBlock(media: GzhSourceMedia, lang: "en" | "zh"): string {
  const gifBadge = media.mediaKind === "gif"
    ? `<span style="display:inline-block;color:#176a67;border:1px solid #9fd6d1;padding:0 6px;margin:0 6px 2px 0;font-weight:700;"><span leaf="">${lang === "zh" ? "GIF 动图" : "Animated GIF"}</span></span>`
    : "";
  const caption = media.caption ? `<span leaf="">${escapeHtmlText(media.caption)}</span>` : "";
  const captionBreak = media.caption || media.mediaKind === "gif" ? "<br>" : "";
  const sourceLabel = lang === "zh" ? "来源：" : "Source: ";
  const sourceText = `${media.sourceName} · ${media.sourceTitle} [${media.sourceRef}]`;
  return [
    '<section style="margin:0 0 24px;">',
    '<section style="margin:0;overflow:hidden;text-align:center;background:#fff;">',
    `<span leaf=""><img src="${escapeHtmlAttribute(media.mediaDataUri)}" alt="${escapeHtmlAttribute(media.alt)}" width="${media.width}" height="${media.height}" style="max-width:100%;height:auto;display:block;margin:0 auto;"></span>`,
    "</section>",
    '<p style="font-size:15px;color:#596b67;text-align:center;line-height:1.7;margin:8px 0 0;overflow-wrap:anywhere;">',
    gifBadge,
    caption,
    captionBreak,
    `<span leaf="">${sourceLabel}</span>`,
    `<a href="${escapeHtmlAttribute(media.sourceUrl)}" style="color:#176a67;text-decoration:none;border-bottom:1px solid #9fd6d1;"><span leaf="">${escapeHtmlText(sourceText)}</span></a>`,
    "</p>",
    "</section>",
  ].join("");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
}
