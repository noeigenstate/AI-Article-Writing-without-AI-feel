/**
 * 中文分句。
 *
 * 要求：所有切片**拼接后等于原文**（不丢字符），方便把编辑后的句子重组回段落。
 * 规则：在句末标点（。！？；…）后断句；句末标点后若紧跟收尾引号/括号，一并归入本句；
 *       引号/括号内部的句末标点不切。
 */

const TERMINATORS = new Set(["。", "！", "？", "；", "!", "?", ";"]);
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
  const out: string[] = [];
  let buf = "";
  let depth = 0; // 引号/括号嵌套深度

  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    buf += ch;

    if (OPENERS[ch]) {
      depth++;
      continue;
    }
    if (CLOSERS.has(ch) && depth > 0) {
      depth--;
      continue;
    }

    if (depth === 0) {
      // 省略号：…… 或 ...
      if (ch === "…") {
        while (i + 1 < chars.length && chars[i + 1] === "…") {
          buf += chars[++i];
        }
        // 吞掉紧随的收尾符号
        while (i + 1 < chars.length && CLOSERS.has(chars[i + 1])) buf += chars[++i];
        out.push(buf);
        buf = "";
        continue;
      }
      if (TERMINATORS.has(ch)) {
        while (i + 1 < chars.length && CLOSERS.has(chars[i + 1])) buf += chars[++i];
        out.push(buf);
        buf = "";
      }
    }
  }

  if (buf.length > 0) out.push(buf);
  return out;
}
