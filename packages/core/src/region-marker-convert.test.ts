import { describe, expect, it } from "vitest";
import {
  convertCommentraySourceMarkersToLanguage,
  findCommentrayMarkerPairs,
  leadingIndentOfLine,
} from "./region-marker-convert.js";

describe("findCommentrayMarkerPairs", () => {
  it("pairs generic // markers in order", () => {
    const src = ["// commentray:start id=ab", "x", "// commentray:end id=ab"].join("\n");
    expect(findCommentrayMarkerPairs(src)).toEqual([{ id: "ab", startLine0: 0, endLine0: 2 }]);
  });

  it("pairs //#region style markers", () => {
    const src = ["//#region commentray:zz", "y", "//#endregion commentray:zz"].join("\n");
    expect(findCommentrayMarkerPairs(src)).toEqual([{ id: "zz", startLine0: 0, endLine0: 2 }]);
  });

  it("pairs two blocks with different ids", () => {
    const src = [
      "// commentray:start id=a",
      "1",
      "// commentray:end id=a",
      "",
      "//#region commentray:b",
      "2",
      "//#endregion commentray:b",
    ].join("\n");
    expect(findCommentrayMarkerPairs(src)).toEqual([
      { id: "a", startLine0: 0, endLine0: 2 },
      { id: "b", startLine0: 4, endLine0: 6 },
    ]);
  });

  it("ignores orphan end markers", () => {
    const src = ["// commentray:end id=x"].join("\n");
    expect(findCommentrayMarkerPairs(src)).toEqual([]);
  });
});

describe("leadingIndentOfLine", () => {
  it("returns leading tabs and spaces only", () => {
    expect(leadingIndentOfLine("  \t// x")).toBe("  \t");
  });
});

describe("convertCommentraySourceMarkersToLanguage", () => {
  it("rewrites generic markers to TypeScript #region style", () => {
    const before = ["// commentray:start id=aa", "const n = 1;", "// commentray:end id=aa"].join("\n");
    const { sourceText, changed, convertedPairs } = convertCommentraySourceMarkersToLanguage(
      before,
      "typescript",
    );
    expect(convertedPairs).toBe(1);
    expect(changed).toBe(true);
    expect(sourceText).toBe(
      ["//#region commentray:aa", "const n = 1;", "//#endregion commentray:aa"].join("\n"),
    );
  });

  it("preserves indentation from the opening line", () => {
    const before = ["  // commentray:start id=bb", "  x();", "  // commentray:end id=bb"].join("\n");
    const { sourceText } = convertCommentraySourceMarkersToLanguage(before, "typescript");
    expect(sourceText).toBe(
      ["  //#region commentray:bb", "  x();", "  //#endregion commentray:bb"].join("\n"),
    );
  });

  it("converts TypeScript regions to Rust-style generic comments", () => {
    const before = ["//#region commentray:cc", "fn f() {}", "//#endregion commentray:cc"].join("\n");
    const { sourceText, convertedPairs } = convertCommentraySourceMarkersToLanguage(before, "rust");
    expect(convertedPairs).toBe(1);
    expect(sourceText).toBe(
      ["// commentray:start id=cc", "fn f() {}", "// commentray:end id=cc"].join("\n"),
    );
  });

  it("does not count a replacement when the target style already matches", () => {
    const before = ["//#region commentray:dd", "x", "//#endregion commentray:dd"].join("\n");
    const { sourceText, changed, convertedPairs } = convertCommentraySourceMarkersToLanguage(
      before,
      "typescript",
    );
    expect(convertedPairs).toBe(0);
    expect(changed).toBe(false);
    expect(sourceText).toBe(before);
  });

  it("normalises CRLF to LF in the output", () => {
    const before = "// commentray:start id=e\r\nbody\r\n// commentray:end id=e";
    const { sourceText, changed } = convertCommentraySourceMarkersToLanguage(before, "typescript");
    expect(changed).toBe(true);
    expect(sourceText).not.toContain("\r");
    expect(sourceText).toContain("//#region commentray:e");
  });
});
