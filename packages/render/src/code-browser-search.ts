/**
 * Whole-document search: tokens must appear in order as case-insensitive substrings,
 * but may span multiple lines (any offsets in `text`).
 */

const MAX_ORDERED_SPANS = 400;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML-safe snippet for search hit lists: escapes `display`, wrapping each case-insensitive
 * occurrence of any `tokens` substring in `<mark class="search-hit">…</mark>`.
 */
export function escapeHtmlHighlightingSearchTokens(display: string, tokens: string[]): string {
  const parts = tokens.map((t) => t.trim()).filter(Boolean);
  if (parts.length === 0) return escapeHtml(display);
  try {
    const escaped = parts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    const bits = display.split(re);
    return bits
      .map((bit, i) =>
        i % 2 === 1 ? `<mark class="search-hit">${escapeHtml(bit)}</mark>` : escapeHtml(bit),
      )
      .join("");
  } catch {
    return escapeHtml(display);
  }
}

/**
 * Returns every minimal span [start, end) where each non-empty token appears in order
 * in `text` (case-insensitive). Spans may overlap; iteration advances by one code unit
 * from the start of the previous match.
 */
export function findOrderedTokenSpans(
  text: string,
  tokens: string[],
): Array<{ start: number; end: number }> {
  const parts = tokens.map((t) => t.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const lower = text.toLowerCase();
  const needle = parts.map((t) => t.toLowerCase());
  const out: Array<{ start: number; end: number }> = [];
  let scan = 0;
  let produced = 0;
  while (scan < text.length && produced < MAX_ORDERED_SPANS) {
    let pos = scan;
    let first = -1;
    let ok = true;
    for (const tok of needle) {
      if (tok.length === 0) continue;
      const idx = lower.indexOf(tok, pos);
      if (idx < 0) {
        ok = false;
        break;
      }
      if (first < 0) first = idx;
      pos = idx + tok.length;
    }
    if (!ok || first < 0) break;
    out.push({ start: first, end: pos });
    produced++;
    scan = first + 1;
  }
  return out;
}

/** 0-based line index for the line containing `offset` (offset clamped to [0, length]). */
export function offsetToLineIndex(text: string, offset: number): number {
  const o = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  for (let i = 0; i < o; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

export function lineAtIndex(text: string, lineIndex: number): string {
  const lines = text.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return "";
  return lines[lineIndex] ?? "";
}
