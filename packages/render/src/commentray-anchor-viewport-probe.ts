/**
 * Pure helper: max `line0` among anchors whose layout top is at or above viewport probe `y`.
 * Mirrors {@link bestCommentrayAnchorLine0AtOrAboveY} in `code-browser-client.ts` for tests.
 */
export function maxCommentrayAnchorLine0AtOrAboveViewportY(
  readings: ReadonlyArray<{ line0: number; top: number }>,
  y: number,
): number {
  let best = 0;
  for (const { line0, top } of readings) {
    if (top <= y + 1 + 1e-3) best = Math.max(best, line0);
  }
  return best;
}
