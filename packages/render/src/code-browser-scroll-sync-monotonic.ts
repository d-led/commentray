/**
 * Normative scroll-sync monotonicity (see `docs/spec/dual-pane-scroll-sync.md`).
 * Pure predicates so Vitest can lock the contract without a browser scroll stack.
 */

/** Sub-pixel / wheel noise: ignore driver direction when |delta| is below this. */
export const SCROLL_SYNC_MONOTONIC_EPS = 1.5;

/**
 * After applying partner scroll from a driver-driven sync, returns whether the partner moved
 * **opposite** to the driver’s direction (forbidden UX: backward jump while scrolling one column).
 */
export function shouldRevertPartnerScrollForMonotonicity(args: {
  driverDelta: number;
  partnerBefore: number;
  partnerAfter: number;
  eps?: number;
}): boolean {
  const eps = args.eps ?? SCROLL_SYNC_MONOTONIC_EPS;
  const { driverDelta, partnerBefore, partnerAfter } = args;
  if (Math.abs(driverDelta) < eps) return false;
  if (driverDelta > eps && partnerAfter < partnerBefore - eps) return true;
  if (driverDelta < -eps && partnerAfter > partnerBefore + eps) return true;
  return false;
}
