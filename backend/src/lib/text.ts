/**
 * Small, dependency-free string helpers shared across services.
 */

/**
 * Normalize a date-like string to `YYYY-MM-DD`.
 *
 * @param value An ISO date, a partial date, or any parseable date string.
 * @returns The ISO day portion, or the first 10 chars if unparseable, or "".
 */
export function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Collapse whitespace and clip a string to a maximum length, adding an ellipsis.
 *
 * @param value The text to shorten.
 * @param maxLength Maximum length of the returned string (including the ellipsis).
 * @returns The trimmed, possibly ellipsized string.
 */
export function truncate(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * Escape the five XML-significant characters for safe embedding in SVG/XML text.
 *
 * @param value Raw text.
 * @returns XML-escaped text.
 */
export function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Coerce an unknown value to a trimmed string, or "" if it is not a string.
 *
 * @param value Any value, typically from parsed JSON.
 * @returns The trimmed string, or "".
 */
export function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Build a short, URL/id-safe slug from arbitrary (incl. CJK) text.
 *
 * @param value Source text.
 * @returns A slug of at most 32 chars, or "untitled" when empty.
 */
export function slug(value: string): string {
  const cleaned = value.replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 32) || "untitled";
}
