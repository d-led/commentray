/**
 * Static browser scroll helpers: proportional mirror plus block pickers from
 * `@commentray/core/block-scroll-pickers` (small browser bundle entry).
 */
export type {
  BlockScrollLink,
  BlockScrollStickyState,
} from "@commentray/core/block-scroll-pickers";
export {
  blockStrictlyContainingSourceViewportLine,
  commentrayProbeInStrictInterMarkerGap,
  DEFAULT_COMMENTRAY_VIEWPORT_HYSTERESIS_LINES,
  DEFAULT_SOURCE_VIEWPORT_HYSTERESIS_LINES,
  pickBlockScrollLinkForCommentrayScroll,
  pickBlockScrollLinkForCommentrayViewportWithHysteresis,
  pickBlockScrollLinkForSourceViewportTop,
  pickBlockScrollLinkForSourceViewportWithHysteresis,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
  sourceTopLineStrictlyBeforeFirstIndexLine,
} from "@commentray/core/block-scroll-pickers";

/**
 * Maps one pane’s scroll position to the other for **proportional** scroll sync
 * (static code browser). Mirrors the ratio fallback used while editing when
 * there are no block markers yet.
 */
export function mirroredScrollTop(
  sourceScrollTop: number,
  sourceScrollHeight: number,
  sourceClientHeight: number,
  targetScrollHeight: number,
  targetClientHeight: number,
): number {
  const maxSource = Math.max(0, sourceScrollHeight - sourceClientHeight);
  const maxTarget = Math.max(0, targetScrollHeight - targetClientHeight);
  if (maxSource <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, sourceScrollTop / maxSource));
  return ratio * maxTarget;
}
