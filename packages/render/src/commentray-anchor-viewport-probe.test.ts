import { describe, expect, it } from "vitest";

import { maxCommentrayAnchorLine0AtOrAboveViewportY } from "./commentray-anchor-viewport-probe.js";

describe("maxCommentrayAnchorLine0AtOrAboveViewportY", () => {
  it("keeps the deepest block whose anchor is still at or above the probe, even if a later anchor is below", () => {
    const readings = [
      { line0: 2, top: -400 },
      { line0: 12, top: 155 },
      { line0: 20, top: 900 },
    ];
    expect(maxCommentrayAnchorLine0AtOrAboveViewportY(readings, 160)).toBe(12);
  });

  it("does not require DOM order to match increasing top", () => {
    const readings = [
      { line0: 20, top: 50 },
      { line0: 10, top: 120 },
    ];
    expect(maxCommentrayAnchorLine0AtOrAboveViewportY(readings, 200)).toBe(20);
  });
});
