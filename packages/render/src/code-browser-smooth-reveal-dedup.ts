/**
 * Historical ceiling for smooth-scroll duration (hash / search helpers may still use `smooth`).
 * Dual-pane block sync uses **instant** partner writes (`applyRevealChildInPane`); partner echo
 * suppression stays above this constant so any remaining smooth paths do not masquerade as driver
 * input mid-gesture.
 */

/**
 * Ceiling used when sizing partner echo suppression in `code-browser-client` so a smooth
 * programmatic scroll (if any) is not mistaken for user input mid-animation.
 */
export const SMOOTH_REVEAL_INFLIGHT_DEDUP_MS = 800;

/** Sub-pixel tolerance — clamp / `getBoundingClientRect` math drifts by less than this between frames. */
export const SMOOTH_REVEAL_TARGET_EPSILON_PX = 0.5;

export type SmoothRevealInFlight = {
  /** Clamped scrollTop the most recent `scrollTo` was aimed at. */
  target: number;
  /** `performance.now()` at the moment of issue. */
  issuedAt: number;
};

/**
 * True when `target` essentially equals the last-issued target and the in-flight glide is still
 * within the typical animation duration. The caller should skip its `scrollTo` in that case.
 */
export function smoothRevealAlreadyInFlight(
  last: SmoothRevealInFlight | null,
  target: number,
  now: number,
): boolean {
  if (last === null) return false;
  if (Math.abs(last.target - target) > SMOOTH_REVEAL_TARGET_EPSILON_PX) return false;
  return now - last.issuedAt < SMOOTH_REVEAL_INFLIGHT_DEDUP_MS;
}
