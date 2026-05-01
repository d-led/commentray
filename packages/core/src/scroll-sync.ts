import { parseAnchor } from "./anchors.js";
import type { BlockScrollLink } from "./block-scroll-pickers.js";
import { MARKER_ID_BODY } from "./marker-ids.js";
import type { CommentrayIndex } from "./model.js";
import { normalizeRepoRelativePath } from "./paths.js";
import { markerViewportHalfOpen1Based, sourceLineRangeForMarkerId } from "./source-markers.js";

export type { BlockScrollLink, BlockScrollStickyState } from "./block-scroll-pickers.js";
export {
  blockStrictlyContainingSourceViewportLine,
  commentrayProbeInStrictInterMarkerGap,
  DEFAULT_COMMENTRAY_VIEWPORT_HYSTERESIS_LINES,
  DEFAULT_SOURCE_VIEWPORT_HYSTERESIS_LINES,
  pickBlockScrollLinkForCommentrayScroll,
  pickBlockScrollLinkForCommentrayViewportWithHysteresis,
  pickBlockScrollLinkForSourceViewportTop,
  pickBlockScrollLinkForSourceViewportWithHysteresis,
  pickCommentrayLineForSourceDualPane,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
  sourceTopLineStrictlyBeforeFirstIndexLine,
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

function buildMarkerFallbackLinks(
  markerLineById: Map<string, number>,
  sourceText: string | undefined,
): BlockScrollLink[] {
  if (sourceText === undefined || markerLineById.size === 0) return [];
  const links: BlockScrollLink[] = [];
  for (const [id, commentrayLine] of markerLineById) {
    const range = sourceLineRangeForMarkerId(sourceText, id);
    const mv = markerViewportHalfOpen1Based(sourceText, id);
    if (range === null || mv === null) continue;
    links.push({
      id,
      commentrayLine,
      sourceStart: range.start,
      sourceEnd: range.end,
      markerViewportHalfOpen1Based: mv,
    });
  }
  links.sort((a, b) => a.sourceStart - b.sourceStart);
  return links;
}

/** Join index + companion markers into `BlockScrollLink[]`; see scroll-sync commentray. */
export function buildBlockScrollLinks(
  index: CommentrayIndex | null | undefined,
  sourceRelative: string,
  commentrayPath: string,
  commentrayMarkdown: string,
  sourceText?: string,
): BlockScrollLink[] {
  const markerLineById = markerLineByIdFromMarkdown(commentrayMarkdown);
  const entry = index?.byCommentrayPath[commentrayPath];
  if (!entry || entry.sourcePath !== sourceRelative || entry.blocks.length === 0) {
    return buildMarkerFallbackLinks(markerLineById, sourceText);
  }
  const entryCrNorm = normalizeRepoRelativePath(entry.commentrayPath.replaceAll("\\", "/"));
  const lookupCrNorm = normalizeRepoRelativePath(commentrayPath.replaceAll("\\", "/"));
  if (entryCrNorm !== lookupCrNorm) return buildMarkerFallbackLinks(markerLineById, sourceText);
  const links: BlockScrollLink[] = [];
  for (const block of entry.blocks) {
    const anchor = parseAnchor(block.anchor);
    const commentrayLine = markerLineById.get(block.id);
    if (commentrayLine === undefined) continue;
    if (anchor.kind === "lines") {
      const lo = anchor.range.start;
      const hiExclusive = anchor.range.end + 1;
      links.push({
        id: block.id,
        commentrayLine,
        sourceStart: anchor.range.start,
        sourceEnd: anchor.range.end,
        markerViewportHalfOpen1Based: { lo, hiExclusive },
      });
      continue;
    }
    if (anchor.kind === "marker") {
      if (sourceText === undefined) continue;
      const range = sourceLineRangeForMarkerId(sourceText, anchor.id);
      const mv = markerViewportHalfOpen1Based(sourceText, anchor.id);
      if (range === null || mv === null) continue;
      links.push({
        id: block.id,
        commentrayLine,
        sourceStart: range.start,
        sourceEnd: range.end,
        markerViewportHalfOpen1Based: mv,
      });
    }
  }
  links.sort((a, b) => a.sourceStart - b.sourceStart);
  return links;
}
