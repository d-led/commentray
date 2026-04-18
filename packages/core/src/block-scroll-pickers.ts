/** One block as needed for scroll correlation (0-based commentray line, 1-based source range). */
export type BlockScrollLink = {
  /** Same id as `<!-- commentray:block id=… -->` and `index.json` blocks[]. */
  id: string;
  commentrayLine: number;
  sourceStart: number;
  sourceEnd: number;
};

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
