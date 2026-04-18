import {
  type BlockScrollLink,
  type CommentrayIndex,
  MARKER_ID_BODY,
  buildBlockScrollLinks,
} from "@commentray/core";

import { escapeHtml } from "./html-utils.js";
import {
  type CommentrayOutputUrlOptions,
  renderFencedCode,
  renderMarkdownToHtml,
} from "./markdown-pipeline.js";

const BLOCK_MARKER_LINE = new RegExp(
  `^<!--\\s*commentray:block\\s+id=(${MARKER_ID_BODY})\\s*-->$`,
  "i",
);

export type BlockStretchTableOptions = {
  code: string;
  language: string;
  commentrayMarkdown: string;
  index: CommentrayIndex;
  sourceRelative: string;
  commentrayPathRel: string;
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
};

export function splitCommentrayMarkdownSegments(markdown: string): {
  preamble: string;
  segments: { id: string; body: string }[];
} {
  const lines = markdown.split("\n");
  const preambleLines: string[] = [];
  const segments: { id: string; body: string }[] = [];
  let seenMarker = false;
  let currentId: string | null = null;
  const currentBody: string[] = [];

  function flush(): void {
    if (currentId !== null) {
      segments.push({ id: currentId, body: currentBody.join("\n").trimEnd() });
      currentBody.length = 0;
    }
  }

  for (const line of lines) {
    const m = BLOCK_MARKER_LINE.exec(line);
    if (m && m[1] !== undefined) {
      seenMarker = true;
      flush();
      currentId = m[1];
    } else if (!seenMarker) {
      preambleLines.push(line);
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return { preamble: preambleLines.join("\n").trimEnd(), segments };
}

function extractPreCodeInner(html: string): string {
  const m = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(html.trim());
  return m ? m[1] : escapeHtml(html);
}

async function renderSingleCodeLine(
  line: string,
  lineIndex0: number,
  language: string,
): Promise<string> {
  const display = line === "" ? " " : line;
  const fence = "```" + language + "\n" + display + "\n```\n";
  const block = await renderFencedCode(fence);
  const inner = extractPreCodeInner(block);
  const langAttr = escapeHtml(language);
  const num = lineIndex0 + 1;
  return (
    `<div class="code-line" id="code-line-${lineIndex0}" data-line="${lineIndex0}">` +
    `<span class="ln" aria-hidden="true">${num}</span>` +
    `<pre><code class="hljs language-${langAttr}">${inner}</code></pre>` +
    `</div>`
  );
}

/** Renders a contiguous 0-based inclusive range of source lines into one stacked column. */
async function renderCodeLineStack(
  lines: string[],
  startLine0: number,
  endLine0: number,
  language: string,
): Promise<string> {
  const parts: string[] = [];
  for (let j = startLine0; j <= endLine0; j++) {
    parts.push(await renderSingleCodeLine(lines[j] ?? "", j, language));
  }
  return `<div class="stretch-code-stack">${parts.join("\n")}</div>`;
}

/**
 * When index blocks + markdown markers align, builds a two-column table in the spirit of
 * GitHub **blame**: **one row per block** (plus one row per unmapped source line). The code
 * and commentary cells share the **same row height** — whichever side is taller sets the
 * row; the shorter side is top-aligned with natural empty space below inside its cell.
 * A single outer scroll (`shell--stretch-rows`) keeps both columns in lockstep.
 */
export async function tryBuildBlockStretchTableHtml(
  opts: BlockStretchTableOptions,
): Promise<{ preambleHtml: string; tableInnerHtml: string } | null> {
  const links = buildBlockScrollLinks(
    opts.index,
    opts.sourceRelative,
    opts.commentrayPathRel,
    opts.commentrayMarkdown,
    opts.code,
  );
  if (links.length === 0) return null;

  const { preamble, segments } = splitCommentrayMarkdownSegments(opts.commentrayMarkdown);
  const mdOpts = { commentrayOutputUrls: opts.commentrayOutputUrls };
  const renderedById = new Map<string, string>();
  for (const s of segments) {
    renderedById.set(
      s.id,
      await renderMarkdownToHtml(s.body.trim().length > 0 ? s.body : " ", mdOpts),
    );
  }

  const lines = opts.code.split("\n");
  const lineToBlock = new Map<number, BlockScrollLink>();
  for (const b of links) {
    for (let L = b.sourceStart; L <= b.sourceEnd; L++) {
      lineToBlock.set(L, b);
    }
  }

  const rows: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const L = i + 1;
    const b = lineToBlock.get(L);

    if (!b) {
      const codeLineHtml = await renderSingleCodeLine(lines[i] ?? "", i, opts.language);
      rows.push(
        `<tr class="stretch-row stretch-row--gap"><td class="stretch-code">${codeLineHtml}</td>` +
          `<td class="stretch-doc stretch-doc--gap"><span class="stretch-gap-mark" aria-hidden="true">—</span></td></tr>`,
      );
      i += 1;
      continue;
    }

    if (i !== b.sourceStart - 1) {
      throw new Error(
        `block-stretch desync at 0-based index ${String(i)} (block ${b.id} should start at index ${String(b.sourceStart - 1)})`,
      );
    }

    const start0 = b.sourceStart - 1;
    const end0 = b.sourceEnd - 1;
    const stackHtml = await renderCodeLineStack(lines, start0, end0, opts.language);
    const docInner =
      renderedById.get(b.id) ??
      `<p class="stretch-doc-missing"><em>No commentary segment for block <code>${escapeHtml(b.id)}</code>.</em></p>`;
    rows.push(
      `<tr class="stretch-row stretch-row--block"><td class="stretch-code">${stackHtml}</td>` +
        `<td class="stretch-doc"><div class="stretch-doc-inner">${docInner}</div></td></tr>`,
    );
    i = end0 + 1;
  }

  const preambleHtml =
    preamble.trim().length > 0
      ? `<section class="stretch-preamble" aria-label="Introduction">${await renderMarkdownToHtml(preamble, mdOpts)}</section>`
      : "";

  const tableInnerHtml =
    `<table class="block-stretch pane--code" id="code-pane" role="presentation">` +
    `<colgroup><col class="stretch-col-code" /><col class="stretch-col-doc" /></colgroup>` +
    `<tbody>\n${rows.join("\n")}\n</tbody>` +
    `</table>`;

  return { preambleHtml, tableInnerHtml };
}
