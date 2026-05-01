import {
  type BlockScrollLink,
  type CommentrayIndex,
  DEFAULT_STRETCH_BUFFER_SYNC,
  MARKER_ID_BODY,
  buildBlockScrollLinks,
} from "@commentray/core";

import { escapeHtml } from "./html-utils.js";
import { renderHighlightedCodeLineRows } from "./highlighted-code-lines.js";
import { injectSourceMarkdownAnchors } from "./inject-md-line-anchors.js";
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
  sourceMarkdownOutputUrls?: CommentrayOutputUrlOptions;
  /** Omitted uses `DEFAULT_STRETCH_BUFFER_SYNC` from `@commentray/core` (`flow-synchronizer`). */
  stretchBufferSync?: StretchBufferSyncStrategy;
};

function sourceMarkdownEnabled(language: string): boolean {
  const normalized = language.trim().toLowerCase();
  return normalized === "md" || normalized === "markdown" || normalized === "mdx";
}

async function renderSourceMarkdownSlice(
  lines: string[],
  startLine0: number,
  endLine0: number,
  outputUrls: CommentrayOutputUrlOptions | undefined,
): Promise<string> {
  const markdown = lines.slice(startLine0, endLine0 + 1).join("\n");
  const anchored = injectSourceMarkdownAnchors(markdown, startLine0);
  const rendered = await renderMarkdownToHtml(anchored.trim().length > 0 ? anchored : " ", {
    commentrayOutputUrls: outputUrls,
  });
  return `<div class="source-pane source-pane--rendered-md stretch-source-markdown-body" data-source-markdown-body="true">${rendered}</div>`;
}

function wrapStretchSourceCell(
  codeHtml: string,
  renderedMarkdownHtml: string | undefined,
  mode: StretchBufferSyncStrategy,
): string {
  const rendered = renderedMarkdownHtml ?? "";
  const inner = `<div class="source-pane source-pane--code">${codeHtml}</div>${rendered}`;
  return mode === "flow-synchronizer" ? `<div class="stretch-cell-measure">${inner}</div>` : inner;
}

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
  renderedSourceMarkdownHtml: string | undefined,
): Promise<void> {
  const codeLineHtml = await renderHighlightedCodeLineRows(lines[lineIndex0] ?? "", language, {
    lineIndexOffset: lineIndex0,
    omitLineStackWrapper: true,
  });
  const sourceCellInner = wrapStretchSourceCell(codeLineHtml, renderedSourceMarkdownHtml, mode);
  if (mode === "flow-synchronizer" && gapSyncSeq !== null) {
    const gapId = `__gap__${gapSyncSeq.n}`;
    gapSyncSeq.n += 1;
    rows.push(
      `<tr class="stretch-row stretch-row--gap" data-commentray-stretch-sync-id="${escapeHtml(gapId)}">` +
        `<td class="stretch-code">${sourceCellInner}</td>` +
        `<td class="stretch-doc stretch-doc--gap"><div class="stretch-cell-measure"></div></td></tr>`,
    );
    return;
  }
  rows.push(
    `<tr class="stretch-row stretch-row--gap"><td class="stretch-code">${sourceCellInner}</td>` +
      `<td class="stretch-doc stretch-doc--gap"></td></tr>`,
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
  const sourceMarkdownSlicesEnabled = sourceMarkdownEnabled(opts.language);
  const renderedById = new Map<string, string>();
  for (const s of segments) {
    renderedById.set(
      s.id,
      await renderMarkdownToHtml(s.body.trim().length > 0 ? s.body : " ", mdOpts),
    );
  }

  const lines = opts.code.split("\n");
  const lnMinCh = Math.max(2, String(Math.max(1, lines.length)).length);
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
      const renderedSourceMarkdownHtml = sourceMarkdownSlicesEnabled
        ? await renderSourceMarkdownSlice(
            lines,
            i,
            i,
            opts.sourceMarkdownOutputUrls,
          )
        : undefined;
      await appendStretchGapRow(
        rows,
        lines,
        i,
        opts.language,
        mode,
        gapSyncSeq,
        renderedSourceMarkdownHtml,
      );
      i += 1;
      continue;
    }

    /** `markerViewportHalfOpen1Based` can include lines before `sourceStart` (region prefix). */
    if (i < b.sourceStart - 1) {
      const renderedSourceMarkdownHtml = sourceMarkdownSlicesEnabled
        ? await renderSourceMarkdownSlice(
            lines,
            i,
            i,
            opts.sourceMarkdownOutputUrls,
          )
        : undefined;
      await appendStretchGapRow(
        rows,
        lines,
        i,
        opts.language,
        mode,
        gapSyncSeq,
        renderedSourceMarkdownHtml,
      );
      i += 1;
      continue;
    }

    const start0 = b.sourceStart - 1;
    const end0 = b.sourceEnd - 1;
    const stackHtml = await renderCodeLineStack(lines, start0, end0, opts.language);
    const renderedSourceMarkdownHtml = sourceMarkdownSlicesEnabled
      ? await renderSourceMarkdownSlice(lines, start0, end0, opts.sourceMarkdownOutputUrls)
      : undefined;
    const sourceCellInner = wrapStretchSourceCell(stackHtml, renderedSourceMarkdownHtml, mode);
    const docInner =
      renderedById.get(b.id) ??
      `<p class="stretch-doc-missing"><em>No commentary segment for block <code>${escapeHtml(b.id)}</code>.</em></p>`;
    if (mode === "flow-synchronizer") {
      rows.push(
        `<tr class="stretch-row stretch-row--block" data-commentray-stretch-sync-id="${escapeHtml(b.id)}">` +
          `<td class="stretch-code">${sourceCellInner}</td>` +
          `<td class="stretch-doc"><div class="stretch-cell-measure"><div class="stretch-doc-inner">${docInner}</div></div></td></tr>`,
      );
    } else {
      rows.push(
        `<tr class="stretch-row stretch-row--block"><td class="stretch-code">${sourceCellInner}</td>` +
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
    `<div class="stretch-grid" id="stretch-grid">` +
    `${preambleHtml}` +
    `<table class="block-stretch pane--code" id="code-pane" role="presentation" style="--code-ln-min-ch:${String(
      lnMinCh,
    )}">` +
    `<colgroup><col class="stretch-col-code" /><col class="stretch-col-doc" /></colgroup>` +
    `<tbody>\n${rows.join("\n")}\n</tbody>` +
    `</table>` +
    `<div class="stretch-gutter" id="stretch-gutter" role="separator" aria-orientation="vertical" aria-label="Resize columns"></div>` +
    `</div>`;

  return { preambleHtml: "", tableInnerHtml };
}
