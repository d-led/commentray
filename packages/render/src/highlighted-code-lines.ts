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

/**
 * Renders source into per-line rows: one {@link renderFencedCode} / rehype-highlight pass for the
 * whole buffer (Highlight.js semantics), then splits highlighted HTML on `\n`. Falls back to
 * per-line highlighting only when split lengths disagree (e.g. odd embedded newlines).
 */
export async function renderHighlightedCodeLineRows(
  code: string,
  language: string,
): Promise<string> {
  const lines = code.split("\n");
  const langAttr = escapeHtml(language);
  const lnMinCh = Math.max(2, String(lines.length).length);

  let hlInners: string[];
  if (lines.length === 0) {
    hlInners = [];
  } else {
    const fence = "```" + language + "\n" + code + "\n```\n";
    const block = await renderFencedCode(fence);
    const inner = extractPreCodeInner(block);
    const parts = inner.split("\n");
    if (parts.length === lines.length) {
      hlInners = parts;
    } else {
      hlInners = await Promise.all(lines.map((ln) => highlightOneLine(ln, language)));
    }
  }

  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const inner = hlInners[i] ?? escapeHtml(lines[i] ?? "");
    const num = i + 1;
    parts.push(
      `<div class="code-line" id="code-line-${i}" data-line="${i}">` +
        `<span class="ln" aria-hidden="true">${num}</span>` +
        `<pre><code class="hljs language-${langAttr}">${inner}</code></pre>` +
        `</div>`,
    );
  }

  return (
    `<div class="code-line-stack" style="--code-ln-min-ch:${String(lnMinCh)}">` +
    parts.join("") +
    `</div>`
  );
}
