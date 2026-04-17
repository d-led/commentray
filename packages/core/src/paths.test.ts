import { describe, expect, it } from "vitest";
import { commentrayMarkdownPath, normalizeRepoRelativePath } from "./paths.js";

describe("normalizeRepoRelativePath", () => {
  it("normalizes separators and rejects escapes", () => {
    expect(normalizeRepoRelativePath("src\\a.ts")).toBe("src/a.ts");
    expect(() => normalizeRepoRelativePath("../escape")).toThrow(/escapes/);
  });
});

describe("commentrayMarkdownPath", () => {
  it("appends .md under .commentray/source", () => {
    expect(commentrayMarkdownPath("src/a.ts")).toBe(".commentray/source/src/a.ts.md");
  });
});
