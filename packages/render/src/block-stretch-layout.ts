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

/**
 * When index blocks + markdown markers align, builds a two-column table: one row
 * per source line; the commentary cell uses `rowspan` so rendered prose **stretches**
 * vertically beside the full anchored source range (scroll-sync–friendly alignment
 * on the web, not two independently scrolled panes).
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
  for (let i = 0; i < lines.length; i++) {
    const L = i + 1;
    const codeLineHtml = await renderSingleCodeLine(lines[i] ?? "", i, opts.language);
    const b = lineToBlock.get(L);

    if (!b) {
      rows.push(
        `<tr class="stretch-row stretch-row--gap"><td class="stretch-code">${codeLineHtml}</td>` +
          `<td class="stretch-doc stretch-doc--gap"><span class="stretch-gap-mark" aria-hidden="true">—</span></td></tr>`,
      );
      continue;
    }

    if (L === b.sourceStart) {
      const rowspan = b.sourceEnd - b.sourceStart + 1;
      const docInner =
        renderedById.get(b.id) ??
        `<p class="stretch-doc-missing"><em>No commentary segment for block <code>${escapeHtml(b.id)}</code>.</em></p>`;
      rows.push(
        `<tr class="stretch-row stretch-row--block"><td class="stretch-code">${codeLineHtml}</td>` +
          `<td class="stretch-doc" rowspan="${rowspan}"><div class="stretch-doc-inner">${docInner}</div></td></tr>`,
      );
    } else {
      rows.push(
        `<tr class="stretch-row stretch-row--block-cont"><td class="stretch-code">${codeLineHtml}</td></tr>`,
      );
    }
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
