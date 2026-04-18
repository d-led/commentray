import { parseAnchor } from "./anchors.js";
import type { BlockScrollLink } from "./block-scroll-pickers.js";
import { MARKER_ID_BODY } from "./marker-ids.js";
import type { CommentrayIndex } from "./model.js";
import { sourceLineRangeForMarkerId } from "./source-markers.js";

export type { BlockScrollLink } from "./block-scroll-pickers.js";
export {
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./block-scroll-pickers.js";

const BLOCK_MARKER_RE = new RegExp(`<!-- commentray:block id=(${MARKER_ID_BODY}) -->`);

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
        id: block.id,
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
        id: block.id,
        commentrayLine,
        sourceStart: range.start,
        sourceEnd: range.end,
      });
    }
  }
  links.sort((a, b) => a.sourceStart - b.sourceStart);
  return links;
}
