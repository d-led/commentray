import { describe, expect, it } from "vitest";

import { plannedSymbolResolutionStrategy } from "./language-intelligence.js";

describe("Language intelligence (extension point)", () => {
  it("documents the current resolver stance as none until tree-sitter or LSP is integrated", () => {
    expect(plannedSymbolResolutionStrategy()).toBe("none");
  });
});
