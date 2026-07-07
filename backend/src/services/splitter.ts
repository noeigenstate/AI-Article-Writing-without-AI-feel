/**
 * 中英文分句。
 *
 * 要求：所有切片**拼接后等于原文**（不丢字符），方便把编辑后的句子重组回段落。
 * 规则：在句末标点（。！？；.!?…）后断句；句末标点后若紧跟收尾引号/括号，一并归入本句；
 *       引号/括号内部的句末标点不切。
 */

const TERMINATORS = new Set(["。", "！", "？", "；", ".", "!", "?", ";"]);
const CLOSERS = new Set(["”", "’", "）", "」", "』", "》", "】", ")", "\""]);
const OPENERS: Record<string, string> = {
  "“": "”",
  "‘": "’",
  "（": "）",
  "「": "」",
  "『": "』",
  "《": "》",
  "【": "】",
  "(": ")",
};
const DOT_ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
]);

/**
 * Split Chinese text into sentences without dropping any characters.
 *
 * Breaks after sentence-final punctuation (。！？；…), keeps trailing closing
 * quotes/brackets with their sentence, and never splits inside quotes/brackets.
 * The concatenation of all pieces equals the input, so edited sentences can be
 * recombined into the original paragraph.
 *
 * @param text The paragraph text.
 * @returns The sentence pieces, in order.
 */
export function splitSentences(text: string): string[] {
  return splitSentencesWithQuotes(text, true);
}

function splitSentencesWithQuotes(text: string, respectPairs: boolean): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0; // 引号/括号嵌套深度
  let pendingQuotedBoundary = false;

  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    buf += ch;

    if (respectPairs && OPENERS[ch]) {
      depth++;
      continue;
    }
    if (respectPairs && CLOSERS.has(ch) && depth > 0) {
      depth--;
      if (depth === 0 && pendingQuotedBoundary) {
        while (i + 1 < chars.length && CLOSERS.has(chars[i + 1])) buf += chars[++i];
        out.push(buf);
        buf = "";
        pendingQuotedBoundary = false;
      }
      continue;
    }

    if (ch === "…" || isAsciiEllipsis(chars, i)) {
      if (ch === ".") {
        while (i + 1 < chars.length && chars[i + 1] === ".") buf += chars[++i];
      } else {
        while (i + 1 < chars.length && chars[i + 1] === "…") buf += chars[++i];
      }
      if (depth === 0) {
        while (i + 1 < chars.length && CLOSERS.has(chars[i + 1])) buf += chars[++i];
        out.push(buf);
        buf = "";
      } else {
        pendingQuotedBoundary = true;
      }
      continue;
    }

    if (!isTerminator(chars, i)) {
      continue;
    }

    if (depth === 0) {
      while (i + 1 < chars.length && CLOSERS.has(chars[i + 1])) buf += chars[++i];
      out.push(buf);
      buf = "";
    } else {
      pendingQuotedBoundary = true;
    }
  }

  if (buf.length > 0) {
    if (respectPairs && depth > 0 && hasBoundary(buf)) {
      out.push(...splitSentencesWithQuotes(buf, false));
    } else {
      out.push(buf);
    }
  }
  return out;
}

function isTerminator(chars: string[], index: number): boolean {
  const ch = chars[index];
  if (!TERMINATORS.has(ch)) {
    return false;
  }
  if (ch === ".") {
    return isSentenceDot(chars, index);
  }
  return true;
}

function isAsciiEllipsis(chars: string[], index: number): boolean {
  return chars[index] === "." && chars[index + 1] === "." && chars[index + 2] === ".";
}

function isSentenceDot(chars: string[], index: number): boolean {
  if (chars[index] !== ".") {
    return false;
  }
  if (isAsciiEllipsis(chars, index)) {
    return false;
  }

  const prev = chars[index - 1] ?? "";
  const next = chars[index + 1] ?? "";
  if (/\d/.test(prev) && /\d/.test(next)) {
    return false;
  }

  const prefix = chars.slice(0, index).join("");
  const token = prefix.match(/[A-Za-z.]+$/)?.[0]?.toLowerCase() ?? "";
  if (DOT_ABBREVIATIONS.has(token)) {
    return false;
  }
  if (/^[a-z]$/i.test(token) && /\s+[A-Z]/.test(chars.slice(index + 1, index + 4).join(""))) {
    return false;
  }

  return true;
}

function hasBoundary(value: string): boolean {
  const chars = Array.from(value);
  return chars.some((_, index) => isTerminator(chars, index) || chars[index] === "…" || isAsciiEllipsis(chars, index));
}
