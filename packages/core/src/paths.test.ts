import { describe, expect, it } from "vitest";
import { commentrayMarkdownPath, normalizeRepoRelativePath } from "./paths.js";

describe("normalizeRepoRelativePath", () => {
  it("normalizes Windows separators to POSIX", () => {
    expect(normalizeRepoRelativePath("src\\a.ts")).toBe("src/a.ts");
  });

  it("rejects traversal segments regardless of position", () => {
    expect(() => normalizeRepoRelativePath("../escape")).toThrow(/escapes/);
    expect(() => normalizeRepoRelativePath("src/../etc")).toThrow(/escapes/);
    expect(() => normalizeRepoRelativePath("..")).toThrow(/escapes/);
  });

  it("rejects absolute paths with a Windows drive letter", () => {
    expect(() => normalizeRepoRelativePath("C:\\Windows\\System32")).toThrow(/absolute/);
  });

  it("strips a leading absolute-root slash (defense in depth)", () => {
    expect(normalizeRepoRelativePath("/src/a.ts")).toBe("src/a.ts");
  });

  it("allows filenames that merely contain dots", () => {
    expect(normalizeRepoRelativePath("src/..name.ts")).toBe("src/..name.ts");
    expect(normalizeRepoRelativePath("src/foo..bar.ts")).toBe("src/foo..bar.ts");
  });

  it("collapses redundant current-directory segments", () => {
    expect(normalizeRepoRelativePath("./src/./a.ts")).toBe("src/a.ts");
  });
});

describe("commentrayMarkdownPath", () => {
  it("appends .md under .commentray/source", () => {
    expect(commentrayMarkdownPath("src/a.ts")).toBe(".commentray/source/src/a.ts.md");
  });
});
