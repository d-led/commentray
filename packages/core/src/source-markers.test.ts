import { describe, expect, it } from "vitest";
import {
  commentrayRegionInsertions,
  parseCommentrayRegionBoundary,
  sourceLineRangeForMarkerId,
} from "./source-markers.js";

describe("Inserting Commentray region markers into source text", () => {
  it("matches Region Marker-style //#region for TypeScript", () => {
    const { start, end } = commentrayRegionInsertions("typescript", "abc123", "  ");
    expect(start).toBe("  //#region commentray:abc123\n");
    expect(end).toBe("\n  //#endregion commentray:abc123");
  });

  it("uses #pragma region for C++", () => {
    const { start, end } = commentrayRegionInsertions("cpp", "x1", "");
    expect(start).toBe("#pragma region commentray:x1\n");
    expect(end).toBe("\n#pragma endregion commentray:x1");
  });

  it("uses # region for Python", () => {
    const { start, end } = commentrayRegionInsertions("python", "ab", "    ");
    expect(start).toBe("    # region commentray:ab\n");
    expect(end).toBe("\n    # endregion commentray:ab");
  });

  it("uses generic line comments for languages without a #region convention (e.g. Rust)", () => {
    const { start, end } = commentrayRegionInsertions("rust", "r1", "\t");
    expect(start).toBe("\t// commentray:start id=r1\n");
    expect(end).toBe("\n\t// commentray:end id=r1");
  });

  it("uses generic hash comments for shell / YAML style languages", () => {
    const { start, end } = commentrayRegionInsertions("yaml", "y9", "");
    expect(start).toBe("# commentray:start id=y9\n");
    expect(end).toBe("\n# commentray:end id=y9");
  });

  it("uses block comments for plain CSS", () => {
    const { start, end } = commentrayRegionInsertions("css", "c0", "  ");
    expect(start).toBe("  /* commentray:start id=c0 */\n");
    expect(end).toBe("\n  /* commentray:end id=c0 */");
  });
});

describe("Parsing Commentray region boundary lines", () => {
  it("detects //#region / //#endregion with commentray id", () => {
    expect(parseCommentrayRegionBoundary("//#region commentray:ab12")).toEqual({
      kind: "start",
      id: "ab12",
    });
    expect(parseCommentrayRegionBoundary("  //#endregion commentray:ab12  ")).toEqual({
      kind: "end",
      id: "ab12",
    });
  });

  it("still detects legacy commentray:start / end", () => {
    expect(parseCommentrayRegionBoundary("// commentray:start id=zz99")).toEqual({
      kind: "start",
      id: "zz99",
    });
    expect(parseCommentrayRegionBoundary("# commentray:end id=zz99")).toEqual({
      kind: "end",
      id: "zz99",
    });
  });
});

describe("Resolving source line ranges for a marker id", () => {
  it("returns 1-based inclusive lines between region markers", () => {
    const src = [
      "//#region commentray:ab12",
      "line one",
      "line two",
      "//#endregion commentray:ab12",
    ].join("\n");
    expect(sourceLineRangeForMarkerId(src, "ab12")).toEqual({ start: 2, end: 3 });
  });

  it("supports generic // commentray:start markers", () => {
    const src = ["// commentray:start id=zz", "body", "// commentray:end id=zz"].join("\n");
    expect(sourceLineRangeForMarkerId(src, "zz")).toEqual({ start: 2, end: 2 });
  });

  it("supports CSS block comment markers", () => {
    const src = ["/* commentray:start id=bb */", "x{}", "/* commentray:end id=bb */"].join("\n");
    expect(sourceLineRangeForMarkerId(src, "bb")).toEqual({ start: 2, end: 2 });
  });
});
