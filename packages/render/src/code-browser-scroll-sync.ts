/**
 * Block correlation for static-browser scroll (subset of `@commentray/core`
 * `BlockScrollLink`). Keep picker logic aligned with `packages/core/src/scroll-sync.ts`.
 */
export type BlockScrollLink = {
  id: string;
  commentrayLine: number;
  sourceStart: number;
  sourceEnd: number;
};

/** @see `@commentray/core` `pickCommentrayLineForSourceScroll` */
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

/** @see `@commentray/core` `pickSourceLine0ForCommentrayScroll` */
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
  const ratio = sourceScrollTop / maxSource;
  return ratio * maxTarget;
}
