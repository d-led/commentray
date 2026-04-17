import { describe, expect, it } from "vitest";

import { assertValidAngleId } from "./angles.js";

describe("assertValidAngleId", () => {
  it("accepts alphanumeric ids with hyphen and underscore", () => {
    expect(assertValidAngleId("architecture")).toBe("architecture");
    expect(assertValidAngleId("intro-v2")).toBe("intro-v2");
    expect(assertValidAngleId("a_b")).toBe("a_b");
  });

  it("trims surrounding whitespace", () => {
    expect(assertValidAngleId("  main  ")).toBe("main");
  });

  it("rejects empty, dot segments, and invalid characters", () => {
    expect(() => assertValidAngleId("")).toThrow(/Invalid angle id/);
    expect(() => assertValidAngleId("  ")).toThrow(/Invalid angle id/);
    expect(() => assertValidAngleId(".")).toThrow(/Invalid angle id/);
    expect(() => assertValidAngleId("..")).toThrow(/Invalid angle id/);
    expect(() => assertValidAngleId("has space")).toThrow(/Invalid angle id/);
    expect(() => assertValidAngleId("has/slash")).toThrow(/Invalid angle id/);
  });
});
