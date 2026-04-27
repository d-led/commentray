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
 * Which index block “owns” the source viewport top line (1-based), without hysteresis.
 * Same geometry as {@link pickCommentrayLineForSourceScroll}.
 */
/**
 * The index block whose source viewport span **strictly contains** `topSourceLine1Based`
 * (`[lo, hiExclusive)`). When spans overlap, the earliest block by `lo` wins. Returns `null` in
 * true inter-block **gaps** (including above the first `lo` only when that line is still below
 * `lo` — callers combine with {@link sourceTopLineStrictlyBeforeFirstIndexLine} for “prelude”).
 */
export function blockStrictlyContainingSourceViewportLine(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
): BlockScrollLink | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort(
    (a, b) => a.markerViewportHalfOpen1Based.lo - b.markerViewportHalfOpen1Based.lo,
  );
  for (const b of sorted) {
    const { lo, hiExclusive } = b.markerViewportHalfOpen1Based;
    if (lo <= topSourceLine1Based && topSourceLine1Based < hiExclusive) return b;
  }
  return null;
}

/** True when the viewport top sits **strictly above** every block’s `[lo, hiExclusive)` span. */
export function sourceTopLineStrictlyBeforeFirstIndexLine(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
): boolean {
  if (blocks.length === 0) return false;
  let minLo = Infinity;
  for (const b of blocks) {
    minLo = Math.min(minLo, b.markerViewportHalfOpen1Based.lo);
  }
  return topSourceLine1Based < minLo;
}

/**
 * True when the doc viewport probe sits strictly **between** two block marker lines in companion
 * order (interstitial prose / blanks), not on a marker line and not before the first marker.
 */
export function commentrayProbeInStrictInterMarkerGap(
  blocks: BlockScrollLink[],
  topCommentrayLine0Based: number,
): boolean {
  if (blocks.length === 0) return false;
  const s = [...blocks].sort((a, b) => a.commentrayLine - b.commentrayLine);
  const head = s[0];
  if (head === undefined) return false;
  if (topCommentrayLine0Based < head.commentrayLine) return false;
  for (let i = 0; i < s.length; i++) {
    const cur = s[i];
    if (!cur) continue;
    const next = s[i + 1];
    if (next === undefined) {
      return topCommentrayLine0Based > cur.commentrayLine;
    }
    if (cur.commentrayLine < topCommentrayLine0Based && topCommentrayLine0Based < next.commentrayLine) {
      return true;
    }
  }
  return false;
}

export function pickBlockScrollLinkForSourceViewportTop(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
): BlockScrollLink | null {
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
  if (inside) return inside;
  if (topSourceLine1Based < firstLo) return first;
  let best = first;
  let bestLo = -Infinity;
  for (const b of sorted) {
    const lo = b.markerViewportHalfOpen1Based.lo;
    if (lo <= topSourceLine1Based && lo > bestLo) {
      best = b;
      bestLo = lo;
    }
  }
  return best;
}

/** Mutable lock for {@link pickBlockScrollLinkForSourceViewportWithHysteresis} / commentray twin. */
export type BlockScrollStickyState = {
  lockedId: string | null;
};

/** Default: require this many **source** lines into the naive winner before leaving the locked block. */
export const DEFAULT_SOURCE_VIEWPORT_HYSTERESIS_LINES = 2;

/** Default: require this many **commentray markdown** lines into the naive winner before leaving the lock. */
export const DEFAULT_COMMENTRAY_VIEWPORT_HYSTERESIS_LINES = 4;

/**
 * Schmitt-style block pick for **source→commentray** sync: keeps the active block until the
 * viewport top has moved clearly into another block’s territory, so probe noise at span edges
 * does not flip the partner between unrelated regions.
 */
export function pickBlockScrollLinkForSourceViewportWithHysteresis(
  blocks: BlockScrollLink[],
  topSourceLine1Based: number,
  state: BlockScrollStickyState,
  hysteresisSourceLines: number = DEFAULT_SOURCE_VIEWPORT_HYSTERESIS_LINES,
): BlockScrollLink | null {
  const HYST = Math.max(1, Math.floor(hysteresisSourceLines));
  const naive = pickBlockScrollLinkForSourceViewportTop(blocks, topSourceLine1Based);
  if (!naive) {
    state.lockedId = null;
    return null;
  }
  if (state.lockedId === null) {
    state.lockedId = naive.id;
    return naive;
  }
  if (state.lockedId === naive.id) {
    return naive;
  }
  const locked = blocks.find((b) => b.id === state.lockedId);
  if (!locked) {
    state.lockedId = naive.id;
    return naive;
  }
  const loL = locked.markerViewportHalfOpen1Based.lo;
  const hiL = locked.markerViewportHalfOpen1Based.hiExclusive;
  const loC = naive.markerViewportHalfOpen1Based.lo;
  const hiC = naive.markerViewportHalfOpen1Based.hiExclusive;
  const separatedBelow = loC >= hiL;
  const separatedAbove = hiC <= loL;
  if (!separatedBelow && !separatedAbove) {
    state.lockedId = naive.id;
    return naive;
  }
  if (separatedBelow) {
    if (topSourceLine1Based >= loC + HYST) {
      state.lockedId = naive.id;
      return naive;
    }
    return locked;
  }
  if (topSourceLine1Based <= loL - HYST) {
    state.lockedId = naive.id;
    return naive;
  }
  return locked;
}

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
  const b = pickBlockScrollLinkForSourceViewportTop(blocks, topSourceLine1Based);
  return b ? b.commentrayLine : null;
}

/**
 * Schmitt twin for **commentray→source**: same idea in markdown line (0-based) space.
 */
export function pickBlockScrollLinkForCommentrayViewportWithHysteresis(
  blocks: BlockScrollLink[],
  topCommentrayLine0Based: number,
  state: BlockScrollStickyState,
  hysteresisMdLines: number = DEFAULT_COMMENTRAY_VIEWPORT_HYSTERESIS_LINES,
): BlockScrollLink | null {
  const HYST = Math.max(1, Math.floor(hysteresisMdLines));
  const naive = pickBlockScrollLinkForCommentrayScroll(blocks, topCommentrayLine0Based);
  if (!naive) {
    state.lockedId = null;
    return null;
  }
  if (state.lockedId === null) {
    state.lockedId = naive.id;
    return naive;
  }
  if (state.lockedId === naive.id) {
    return naive;
  }
  const locked = blocks.find((b) => b.id === state.lockedId);
  if (!locked) {
    state.lockedId = naive.id;
    return naive;
  }
  const lL = locked.commentrayLine;
  const lC = naive.commentrayLine;
  const separatedBelow = lC > lL;
  const separatedAbove = lC < lL;
  if (!separatedBelow && !separatedAbove) {
    state.lockedId = naive.id;
    return naive;
  }
  if (separatedBelow) {
    if (topCommentrayLine0Based >= lC + HYST) {
      state.lockedId = naive.id;
      return naive;
    }
    return locked;
  }
  if (topCommentrayLine0Based <= lL - HYST) {
    state.lockedId = naive.id;
    return naive;
  }
  return locked;
}

/**
 * The block whose companion marker is at or above `topCommentrayLine0Based`
 * (same rule as {@link pickSourceLine0ForCommentrayScroll}).
 */
export function pickBlockScrollLinkForCommentrayScroll(
  blocks: BlockScrollLink[],
  topCommentrayLine0Based: number,
): BlockScrollLink | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => a.commentrayLine - b.commentrayLine);
  const head = sorted[0];
  if (head === undefined) return null;
  let best = head;
  for (const b of sorted) {
    if (b.commentrayLine <= topCommentrayLine0Based) best = b;
  }
  return best;
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
  const link = pickBlockScrollLinkForCommentrayScroll(blocks, topCommentrayLine0Based);
  return link ? link.markerViewportHalfOpen1Based.lo - 1 : null;
}
