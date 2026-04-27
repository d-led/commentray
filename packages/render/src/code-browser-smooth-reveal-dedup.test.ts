import { describe, expect, it } from "vitest";

import {
  SMOOTH_REVEAL_INFLIGHT_DEDUP_MS,
  SMOOTH_REVEAL_TARGET_EPSILON_PX,
  smoothRevealAlreadyInFlight,
} from "./code-browser-smooth-reveal-dedup.js";

describe("dual-pane scroll sync — smooth-reveal in-flight dedup (spec)", () => {
  it("given no glide is in flight, then a new glide is allowed", () => {
    expect(smoothRevealAlreadyInFlight(null, 100, 0)).toBe(false);
  });

  it("given a glide to the same target is in flight, then re-issuance is suppressed", () => {
    const last = { target: 100, issuedAt: 0 };
    const stillGliding = SMOOTH_REVEAL_INFLIGHT_DEDUP_MS - 1;
    expect(smoothRevealAlreadyInFlight(last, 100, stillGliding)).toBe(true);
  });

  it("given the in-flight window has elapsed, then a fresh glide to the same target is allowed", () => {
    const last = { target: 100, issuedAt: 0 };
    const afterGlide = SMOOTH_REVEAL_INFLIGHT_DEDUP_MS + 1;
    expect(smoothRevealAlreadyInFlight(last, 100, afterGlide)).toBe(false);
  });

  it("given the target changes by more than a pixel, then the new glide is allowed immediately so block-boundary jumps still snap", () => {
    const last = { target: 100, issuedAt: 0 };
    expect(smoothRevealAlreadyInFlight(last, 200, 5)).toBe(false);
  });

  it("given the target moves by sub-pixel clamp / rect-rounding noise, then the in-flight glide is preserved", () => {
    const last = { target: 100, issuedAt: 0 };
    const justInsideEpsilon = 100 + SMOOTH_REVEAL_TARGET_EPSILON_PX * 0.5;
    const justOutsideEpsilon = 100 + SMOOTH_REVEAL_TARGET_EPSILON_PX + 0.01;
    expect(smoothRevealAlreadyInFlight(last, justInsideEpsilon, 5)).toBe(true);
    expect(smoothRevealAlreadyInFlight(last, justOutsideEpsilon, 5)).toBe(false);
  });
});
