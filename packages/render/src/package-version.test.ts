import { describe, expect, it } from "vitest";

import { commentrayRenderVersion } from "./package-version.js";

describe("commentrayRenderVersion", () => {
  it("reads a semver-like version from this package.json", () => {
    const v = commentrayRenderVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
