import { describe, expect, it } from "vitest";

import {
  READING_VIEWPORT_TOP_INSET_MAX_CSS_PX,
  READING_VIEWPORT_TOP_INSET_MIN_CSS_PX,
  readingViewportTopInsetCssPx,
} from "./reading-viewport-comfort.js";

describe("reading viewport comfort band (spec)", () => {
  it("given a very short visible height, then the inset is at least the minimum comfort px", () => {
    expect(readingViewportTopInsetCssPx(50)).toBe(READING_VIEWPORT_TOP_INSET_MIN_CSS_PX);
  });

  it("given a very tall visible height, then the inset is capped so the probe stays in the upper band", () => {
    expect(readingViewportTopInsetCssPx(2000)).toBe(READING_VIEWPORT_TOP_INSET_MAX_CSS_PX);
  });

  it("given a mid-height viewport, then the inset scales with height but stays within min and max", () => {
    const h = 400;
    const raw = h * 0.18;
    expect(readingViewportTopInsetCssPx(h)).toBe(
      Math.min(
        READING_VIEWPORT_TOP_INSET_MAX_CSS_PX,
        Math.max(READING_VIEWPORT_TOP_INSET_MIN_CSS_PX, raw),
      ),
    );
    expect(raw).toBeGreaterThan(READING_VIEWPORT_TOP_INSET_MIN_CSS_PX);
    expect(raw).toBeGreaterThan(READING_VIEWPORT_TOP_INSET_MAX_CSS_PX);
  });
});
