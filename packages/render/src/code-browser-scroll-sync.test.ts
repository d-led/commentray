import { describe, expect, it } from "vitest";

import { mirroredScrollTop } from "./code-browser-scroll-sync.js";

describe("Proportional scroll position mirroring between panes", () => {
  it("maps top and bottom of the source range to the target range", () => {
    expect(mirroredScrollTop(0, 1000, 400, 500, 400)).toBe(0);
    expect(mirroredScrollTop(600, 1000, 400, 500, 400)).toBe(100);
  });

  it("maps the midpoint proportionally", () => {
    expect(mirroredScrollTop(300, 1000, 400, 500, 400)).toBe(50);
  });

  it("returns 0 when the source pane has nothing to scroll", () => {
    expect(mirroredScrollTop(0, 400, 400, 900, 400)).toBe(0);
  });

  it("clamps the ratio when scrollTop exceeds the computed max (e.g. sub-pixel zoom)", () => {
    expect(mirroredScrollTop(800, 1000, 400, 500, 400)).toBe(100);
  });
});
