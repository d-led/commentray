import { escapeHtml } from "./html-utils.js";
import { renderFencedCode } from "./markdown-pipeline.js";

function extractPreCodeInner(html: string): string {
  const m = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(html.trim());
  return m ? m[1] : escapeHtml(html);
}

async function highlightOneLine(line: string, language: string): Promise<string> {
  const display = line === "" ? " " : line;
  const fence = "```" + language + "\n" + display + "\n```\n";
  const block = await renderFencedCode(fence);
  return extractPreCodeInner(block);
}

function normalizeHighlightedLineParts(parts: string[], lines: string[]): string[] {
  if (parts.length === lines.length - 1 && lines.length > 0 && lines.at(-1) === "") {
    return [...parts, ""];
  }
  if (parts.length === lines.length + 1 && parts.at(-1) === "") {
    return parts.slice(0, -1);
  }
  return parts;
}

async function innerHtmlPerSourceLine(
  code: string,
  language: string,
  lines: string[],
): Promise<string[]> {
  if (lines.length === 0) return [];
  const fence = "```" + language + "\n" + code + "\n```\n";
  const block = await renderFencedCode(fence);
  const rawInner = extractPreCodeInner(block);
  const parts = normalizeHighlightedLineParts(rawInner.split("\n"), lines);
  if (parts.length === lines.length) return parts;
  return Promise.all(lines.map((ln) => highlightOneLine(ln, language)));
}

export type HighlightedCodeLineRowsOptions = {
  /**
   * 0-based index of the first source line in `code` (stable `id="code-line-*"` for slices in
   * block-stretch tables).
   */
  lineIndexOffset?: number;
  /**
   * When true, returns only the concatenated `.code-line` rows (no `.code-line-stack` wrapper).
   * Block-stretch gap cells use this so markup stays compatible with existing table layout.
   */
  omitLineStackWrapper?: boolean;
};

/**
 * Renders source into per-line rows: one {@link renderFencedCode} / rehype-highlight pass for the
 * whole buffer (Highlight.js semantics), then splits highlighted HTML on `\n`. Falls back to
 * per-line highlighting only when split lengths disagree (e.g. odd embedded newlines).
 */
export async function renderHighlightedCodeLineRows(
  code: string,
  language: string,
  opts?: HighlightedCodeLineRowsOptions,
): Promise<string> {
  const offset = opts?.lineIndexOffset ?? 0;
  const omitStack = opts?.omitLineStackWrapper ?? false;
  const lines = code.split("\n");
  const langAttr = escapeHtml(language);
  const maxLine1 = offset + lines.length;
  const lnMinCh = Math.max(2, String(Math.max(1, maxLine1)).length);

  const hlInners = await innerHtmlPerSourceLine(code, language, lines);

  const rowParts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineInner = hlInners[i] ?? escapeHtml(lines[i] ?? "");
    const globalI = offset + i;
    const num = globalI + 1;
    rowParts.push(
      `<div class="code-line" id="code-line-${globalI}" data-line="${globalI}">` +
        `<span class="ln" aria-hidden="true">${num}</span>` +
        `<pre><code class="hljs language-${langAttr}">${lineInner}</code></pre>` +
        `</div>`,
    );
  }

  const rowsHtml = rowParts.join("");
  if (omitStack) return rowsHtml;
  return `<div class="code-line-stack" style="--code-ln-min-ch:${String(lnMinCh)}">${rowsHtml}</div>`;
}
