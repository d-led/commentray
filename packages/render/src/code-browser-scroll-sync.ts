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
