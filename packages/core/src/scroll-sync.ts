import { parseAnchor } from "./anchors.js";
import type { CommentrayIndex } from "./model.js";
import { sourceLineRangeForMarkerId } from "./source-markers.js";

export { sourceLineRangeForMarkerId };

/** One block as needed for scroll correlation (0-based commentray line, 1-based source range). */
export type BlockScrollLink = {
  commentrayLine: number;
  sourceStart: number;
  sourceEnd: number;
};

const BLOCK_MARKER_RE = /<!-- commentray:block id=([a-z0-9]+) -->/;

function markerLineByIdFromMarkdown(markdown: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = BLOCK_MARKER_RE.exec(lines[i]);
    if (match) map.set(match[1], i);
  }
  return map;
}

/**
 * Correlate index blocks with `<!-- commentray:block id=… -->` markers in
 * commentray. Supports legacy `lines:` anchors and `marker:` anchors (the
 * latter needs `sourceText` to resolve marker comments in the primary file).
 * Sorted by `sourceStart`.
 */
export function buildBlockScrollLinks(
  index: CommentrayIndex | null | undefined,
  sourceRelative: string,
  commentrayPath: string,
  commentrayMarkdown: string,
  sourceText?: string,
): BlockScrollLink[] {
  const entry = index?.byCommentrayPath[commentrayPath];
  if (!entry || entry.sourcePath !== sourceRelative || entry.blocks.length === 0) return [];
  const markerLineById = markerLineByIdFromMarkdown(commentrayMarkdown);
  const links: BlockScrollLink[] = [];
  for (const block of entry.blocks) {
    const anchor = parseAnchor(block.anchor);
    const commentrayLine = markerLineById.get(block.id);
    if (commentrayLine === undefined) continue;
    if (anchor.kind === "lines") {
      links.push({
        commentrayLine,
        sourceStart: anchor.range.start,
        sourceEnd: anchor.range.end,
      });
      continue;
    }
    if (anchor.kind === "marker") {
      if (sourceText === undefined) continue;
      const range = sourceLineRangeForMarkerId(sourceText, anchor.id);
      if (range === null) continue;
      links.push({
        commentrayLine,
        sourceStart: range.start,
        sourceEnd: range.end,
      });
    }
  }
  links.sort((a, b) => a.sourceStart - b.sourceStart);
  return links;
}

/**
 * Choose which commentray line (0-based) to reveal so the commentary matches
 * the top of the source viewport. Prefers the block whose source range
 * **contains** the top line; otherwise the nearest preceding block; if above
 * all blocks, the first block.
 */
export function pickCommentrayLineForSourceScroll(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
): number | null {
  if (blocks.length === 0) return null;
  const inside = blocks.find(
    (b) => b.sourceStart <= topSourceLine1Based && topSourceLine1Based <= b.sourceEnd,
  );
  if (inside) return inside.commentrayLine;
  if (topSourceLine1Based < blocks[0].sourceStart) return blocks[0].commentrayLine;
  let best = blocks[0];
  for (const b of blocks) {
    if (b.sourceStart <= topSourceLine1Based) best = b;
    else break;
  }
  return best.commentrayLine;
}

/**
 * Choose a 0-based source line to reveal from the top of the commentray
 * viewport: the block whose marker is at or above that line wins; reveal the
 * start of its source range.
 */
export function pickSourceLine0ForCommentrayScroll(
  blocks: BlockScrollLink[],
  topCommentrayLine0Based: number,
): number | null {
  if (blocks.length === 0) return null;
  let best = blocks[0];
  for (const b of blocks) {
    if (b.commentrayLine <= topCommentrayLine0Based) best = b;
    else break;
  }
  return best.sourceStart - 1;
}
