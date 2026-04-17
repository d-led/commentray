import { describe, expect, it } from "vitest";
import { findOrderedTokenSpans, lineAtIndex, offsetToLineIndex } from "./code-browser-search.js";

describe("findOrderedTokenSpans", () => {
  it("finds tokens on one line", () => {
    const spans = findOrderedTokenSpans("const x = 1;", ["const", "x"]);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].start).toBe(0);
    expect(spans[0].end).toBeGreaterThan(spans[0].start);
    expect("const x = 1;".slice(spans[0].start, spans[0].end).toLowerCase()).toMatch(/const.*x/);
  });

  it("allows tokens across lines in order", () => {
    const text = "const a = 1;\nconst b = 2;\nreturn a + b;";
    const spans = findOrderedTokenSpans(text, ["const", "return"]);
    expect(spans.length).toBeGreaterThan(0);
    const first = spans[0];
    expect(first.start).toBe(0);
    expect(first.end).toBeGreaterThanOrEqual(text.indexOf("return") + "return".length);
  });

  it("returns empty when a token is missing", () => {
    expect(findOrderedTokenSpans("hello", ["hello", "missing"])).toEqual([]);
  });

  it("ignores empty tokens", () => {
    expect(findOrderedTokenSpans("ab", ["  ", "a", ""])).toEqual([{ start: 0, end: 1 }]);
  });
});

describe("offsetToLineIndex", () => {
  it("maps offsets to 0-based lines", () => {
    const t = "a\nb\nc";
    expect(offsetToLineIndex(t, 0)).toBe(0);
    expect(offsetToLineIndex(t, 2)).toBe(1);
    expect(offsetToLineIndex(t, 4)).toBe(2);
  });
});

describe("lineAtIndex", () => {
  it("returns the requested line", () => {
    expect(lineAtIndex("x\nyz", 1)).toBe("yz");
  });
});
