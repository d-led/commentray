import { describe, expect, it } from "vitest";
import { mergeCommentaryConfig } from "./config.js";

describe("mergeCommentaryConfig", () => {
  it("applies defaults for empty input", () => {
    const cfg = mergeCommentaryConfig(null);
    expect(cfg.storageDir).toBe(".commentary");
    expect(cfg.scmProvider).toBe("git");
    expect(cfg.render.mermaid).toBe(true);
  });

  it("rejects unsupported scm providers", () => {
    expect(() => mergeCommentaryConfig({ scm: { provider: "p4" } })).toThrow(/Unsupported/);
  });
});
