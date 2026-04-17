import { describe, expect, it } from "vitest";
import { commentaryMarkdownPath, normalizeRepoRelativePath } from "./paths.js";

describe("normalizeRepoRelativePath", () => {
  it("normalizes separators and rejects escapes", () => {
    expect(normalizeRepoRelativePath("src\\foo.ts")).toBe("src/foo.ts");
    expect(() => normalizeRepoRelativePath("../evil")).toThrow(/escapes/);
  });
});

describe("commentaryMarkdownPath", () => {
  it("appends .md under .commentary/source", () => {
    expect(commentaryMarkdownPath("src/a.ts")).toBe(".commentary/source/src/a.ts.md");
  });
});
