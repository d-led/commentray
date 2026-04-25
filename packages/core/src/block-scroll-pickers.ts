/** One block as needed for scroll correlation (0-based commentray line, 1-based source range). */
export type BlockScrollLink = {
  /** Same id as `<!-- commentray:block id=… -->` and `index.json` blocks[]. */
  id: string;
  commentrayLine: number;
  /** 1-based inclusive inner lines between paired region markers (unchanged semantics). */
  sourceStart: number;
  sourceEnd: number;
  /**
   * 1-based half-open viewport span for “which block owns this source line?”. Marker-backed
   * blocks use `markerViewportHalfOpen1Based()` in source-markers; `lines:` anchors use
   * `[range.start, range.end + 1)`.
   */
  markerViewportHalfOpen1Based: { lo: number; hiExclusive: number };
};

/**
 * Choose which commentray line (0-based) to reveal so the commentary matches
 * the top of the source viewport. Uses each link’s `markerViewportHalfOpen1Based`:
 * if the top line falls in `[lo, hiExclusive)`, that block wins; in gaps, the block with the
 * greatest `lo` still at or above the top line; if the viewport is above every `lo`, the first
 * block by `lo`.
 */
export function pickCommentrayLineForSourceScroll(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
): number | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort(
    (a, b) => a.markerViewportHalfOpen1Based.lo - b.markerViewportHalfOpen1Based.lo,
  );
  const first = sorted[0];
  if (first === undefined) return null;
  const firstLo = first.markerViewportHalfOpen1Based.lo;
  const inside = sorted.find(
    (b) =>
      b.markerViewportHalfOpen1Based.lo <= topSourceLine1Based &&
      topSourceLine1Based < b.markerViewportHalfOpen1Based.hiExclusive,
  );
  if (inside) return inside.commentrayLine;
  if (topSourceLine1Based < firstLo) return first.commentrayLine;
  let best = first;
  let bestLo = -Infinity;
  for (const b of sorted) {
    const lo = b.markerViewportHalfOpen1Based.lo;
    if (lo <= topSourceLine1Based && lo > bestLo) {
      best = b;
      bestLo = lo;
    }
  }
  return best.commentrayLine;
}

/**
 * Choose a 0-based source line to reveal from the top of the commentray
 * viewport: the block whose marker is at or above that line wins; reveal the
 * first line of its viewport span (`lo` − 1).
 */
export function pickSourceLine0ForCommentrayScroll(
  blocks: BlockScrollLink[],
  topCommentrayLine0Based: number,
): number | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => a.commentrayLine - b.commentrayLine);
  const head = sorted[0];
  if (head === undefined) return null;
  let best = head;
  for (const b of sorted) {
    if (b.commentrayLine <= topCommentrayLine0Based) best = b;
  }
  return best.markerViewportHalfOpen1Based.lo - 1;
}
