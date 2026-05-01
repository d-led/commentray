import {
  type BlockScrollLink,
  type CommentrayIndex,
  DEFAULT_STRETCH_BUFFER_SYNC,
  MARKER_ID_BODY,
  buildBlockScrollLinks,
} from "@commentray/core";

import { escapeHtml } from "./html-utils.js";
import { renderHighlightedCodeLineRows } from "./highlighted-code-lines.js";
import { type CommentrayOutputUrlOptions, renderMarkdownToHtml } from "./markdown-pipeline.js";

const BLOCK_MARKER_LINE = new RegExp(
  `^<!--\\s*commentray:block\\s+id=(${MARKER_ID_BODY})\\s*-->$`,
  "i",
);

/**
 * Stretch column slack strategy (see `CodeBrowserPageOptions.stretchBufferSync`).
 * - `flow-synchronizer` (default): row sync ids + measure wrappers + client `BufferingFlowSynchronizer` padding.
 * - `table`: `<table>` row height only (legacy; no client buffer pass).
 */
export type StretchBufferSyncStrategy = "table" | "flow-synchronizer";

export type BlockStretchTableOptions = {
  code: string;
  language: string;
  commentrayMarkdown: string;
  index: CommentrayIndex;
  sourceRelative: string;
  commentrayPathRel: string;
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
  /** Omitted uses `DEFAULT_STRETCH_BUFFER_SYNC` from `@commentray/core` (`flow-synchronizer`). */
  stretchBufferSync?: StretchBufferSyncStrategy;
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

/** Renders a contiguous 0-based inclusive range of source lines into one stacked column. */
async function renderCodeLineStack(
  lines: string[],
  startLine0: number,
  endLine0: number,
  language: string,
): Promise<string> {
  const slice = lines.slice(startLine0, endLine0 + 1).join("\n");
  const inner = await renderHighlightedCodeLineRows(slice, language, {
    lineIndexOffset: startLine0,
  });
  return `<div class="stretch-code-stack">${inner}</div>`;
}

async function appendStretchGapRow(
  rows: string[],
  lines: string[],
  lineIndex0: number,
  language: string,
  mode: StretchBufferSyncStrategy,
  gapSyncSeq: { n: number } | null,
): Promise<void> {
  const codeLineHtml = await renderHighlightedCodeLineRows(lines[lineIndex0] ?? "", language, {
    lineIndexOffset: lineIndex0,
    omitLineStackWrapper: true,
  });
  if (mode === "flow-synchronizer" && gapSyncSeq !== null) {
    const gapId = `__gap__${gapSyncSeq.n}`;
    gapSyncSeq.n += 1;
    rows.push(
      `<tr class="stretch-row stretch-row--gap" data-commentray-stretch-sync-id="${escapeHtml(gapId)}">` +
        `<td class="stretch-code"><div class="stretch-cell-measure">${codeLineHtml}</div></td>` +
        `<td class="stretch-doc stretch-doc--gap"><div class="stretch-cell-measure"><span class="stretch-gap-mark" aria-hidden="true">—</span></div></td></tr>`,
    );
    return;
  }
  rows.push(
    `<tr class="stretch-row stretch-row--gap"><td class="stretch-code">${codeLineHtml}</td>` +
      `<td class="stretch-doc stretch-doc--gap"><span class="stretch-gap-mark" aria-hidden="true">—</span></td></tr>`,
  );
}

/**
 * When index blocks + markdown markers align, builds a two-column **`<table>`**: each logical
 * pair (gap line, or one indexed block) is one `<tr>`. Row height is one number — the taller cell
 * wins; the shorter cell shows top-aligned content with empty space below (browser table layout).
 * “Buffer” rows (`stretch-row--gap`) absorb one-sided slack the same way: one code line + a doc
 * em-dash still share one row height. A single outer scroll (`shell--stretch-rows`) keeps both
 * columns in lockstep — no dual-pane scroll sync. The client may add per-cell bottom padding via
 * `BufferingFlowSynchronizer` so row heights stay matched after async reflow (same idea as `BBBB`
 * fills in `buffering-flow-synchronizer.approvals/`). Default is `flow-synchronizer`; pass
 * `stretchBufferSync: "table"` for legacy table-only markup.
 */
export async function tryBuildBlockStretchTableHtml(
  opts: BlockStretchTableOptions,
): Promise<{ preambleHtml: string; tableInnerHtml: string } | null> {
  const mode: StretchBufferSyncStrategy = opts.stretchBufferSync ?? DEFAULT_STRETCH_BUFFER_SYNC;
  const gapSyncSeq = mode === "flow-synchronizer" ? { n: 0 } : null;

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
    const { lo, hiExclusive } = b.markerViewportHalfOpen1Based;
    for (let L = lo; L < hiExclusive; L++) {
      lineToBlock.set(L, b);
    }
  }

  const rows: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const L = i + 1;
    const b = lineToBlock.get(L);

    if (!b) {
      await appendStretchGapRow(rows, lines, i, opts.language, mode, gapSyncSeq);
      i += 1;
      continue;
    }

    /** `markerViewportHalfOpen1Based` can include lines before `sourceStart` (region prefix). */
    if (i < b.sourceStart - 1) {
      await appendStretchGapRow(rows, lines, i, opts.language, mode, gapSyncSeq);
      i += 1;
      continue;
    }

    const start0 = b.sourceStart - 1;
    const end0 = b.sourceEnd - 1;
    const stackHtml = await renderCodeLineStack(lines, start0, end0, opts.language);
    const docInner =
      renderedById.get(b.id) ??
      `<p class="stretch-doc-missing"><em>No commentary segment for block <code>${escapeHtml(b.id)}</code>.</em></p>`;
    if (mode === "flow-synchronizer") {
      rows.push(
        `<tr class="stretch-row stretch-row--block" data-commentray-stretch-sync-id="${escapeHtml(b.id)}">` +
          `<td class="stretch-code"><div class="stretch-cell-measure">${stackHtml}</div></td>` +
          `<td class="stretch-doc"><div class="stretch-cell-measure"><div class="stretch-doc-inner">${docInner}</div></div></td></tr>`,
      );
    } else {
      rows.push(
        `<tr class="stretch-row stretch-row--block"><td class="stretch-code">${stackHtml}</td>` +
          `<td class="stretch-doc"><div class="stretch-doc-inner">${docInner}</div></td></tr>`,
      );
    }
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
