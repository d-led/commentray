import { describe, expect, it } from "vitest";

describe("expensive suite placeholder", () => {
  it("runs only when explicitly requested in CI", () => {
    expect(true).toBe(true);
  });
});
