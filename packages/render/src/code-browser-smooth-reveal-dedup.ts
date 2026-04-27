/**
 * Dedup state for partner-pane block-snap glides.
 *
 * Why this exists: `applyRevealChildInPane` issues `scrollTo({ behavior: "smooth" })` on the partner
 * pane to glide it to a block anchor. Per CSSOM-View §15.6, every such call **cancels any in-flight
 * smooth-scroll animation and starts a new one** — even when the target is identical. While the
 * driver pane keeps scrolling inside one block, the apply function fires on every RAF with the
 * same partner target; cancelling and restarting the glide each frame resets the easing curve, so
 * the partner's velocity keeps falling back toward zero and the user sees up/down wobble.
 *
 * The predicate here lets the caller skip an issuance when an in-flight glide to the same target
 * is already running. A genuinely new target (block boundary crossed) compares unequal and goes
 * through immediately — so jumps still feel like jumps, just stable ones.
 */

/** Ceiling on a typical native smooth-scroll duration for the reveal distances we issue. */
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
