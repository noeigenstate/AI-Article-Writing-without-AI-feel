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
  if (maxLength <= 0) return "";
  const text = replaceInvalidUnicode(value).replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= maxLength) {
    return text;
  }
  return `${characters.slice(0, Math.max(0, maxLength - 1)).join("").trimEnd()}…`;
}

/**
 * Escape the five XML-significant characters for safe embedding in SVG/XML text.
 *
 * @param value Raw text.
 * @returns XML-escaped text.
 */
export function escapeSvg(value: string): string {
  return replaceInvalidUnicode(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace lone UTF-16 surrogates so URI/XML serialization cannot throw. */
function replaceInvalidUnicode(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += value[index] + value[index + 1];
        index += 1;
      } else {
        output += "�";
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      output += "�";
    } else {
      output += value[index];
    }
  }
  return output;
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
