import { describe, expect, it } from "vitest";
import {
  escapeHtmlHighlightingSearchTokens,
  findOrderedTokenSpans,
  lineAtIndex,
  offsetToLineIndex,
} from "./code-browser-search.js";

describe("Ordered in-line search token matching", () => {
  it("should locate every query token in order on a single line", () => {
    const spans = findOrderedTokenSpans("const x = 1;", ["const", "x"]);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].start).toBe(0);
    expect(spans[0].end).toBeGreaterThan(spans[0].start);
    expect("const x = 1;".slice(spans[0].start, spans[0].end).toLowerCase()).toMatch(/const.*x/);
  });

  it("should follow token order across line breaks", () => {
    const text = "const a = 1;\nconst b = 2;\nreturn a + b;";
    const spans = findOrderedTokenSpans(text, ["const", "return"]);
    expect(spans.length).toBeGreaterThan(0);
    const first = spans[0];
    expect(first.start).toBe(0);
    expect(first.end).toBeGreaterThanOrEqual(text.indexOf("return") + "return".length);
  });

  it("should yield no spans when a later token never appears", () => {
    expect(findOrderedTokenSpans("hello", ["hello", "missing"])).toEqual([]);
  });

  it("should ignore blank tokens in the query list", () => {
    expect(findOrderedTokenSpans("ab", ["  ", "a", ""])).toEqual([{ start: 0, end: 1 }]);
  });

  it("should match ASCII tokens without regard to letter case", () => {
    const spans = findOrderedTokenSpans("# Commentray quick-start\n", ["commentray"]);
    expect(spans.length).toBeGreaterThan(0);
  });
});

describe("Mapping character offsets to line indices", () => {
  it("should map each offset to the correct zero-based line", () => {
    const t = "a\nb\nc";
    expect(offsetToLineIndex(t, 0)).toBe(0);
    expect(offsetToLineIndex(t, 2)).toBe(1);
    expect(offsetToLineIndex(t, 4)).toBe(2);
  });
});

describe("Fetching a single line by index", () => {
  it("should return the full line text for a valid index", () => {
    expect(lineAtIndex("x\nyz", 1)).toBe("yz");
  });
});

describe("Search snippet HTML with safe highlighting", () => {
  it("should escape markup and wrap hits in mark.search-hit", () => {
    const html = escapeHtmlHighlightingSearchTokens('Say <script> & "hi"', ["hi"]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<mark class="search-hit">hi</mark>');
  });

  it("should highlight ASCII hits case-insensitively", () => {
    const html = escapeHtmlHighlightingSearchTokens("Commentray on GitHub", ["commentray"]);
    expect(html).toMatch(/<mark class="search-hit">Commentray<\/mark>/i);
  });

  it("should escape the snippet and emit no marks when there are no real tokens", () => {
    expect(escapeHtmlHighlightingSearchTokens("<x>", [])).toBe("&lt;x&gt;");
    expect(escapeHtmlHighlightingSearchTokens("<x>", ["  ", ""])).toBe("&lt;x&gt;");
  });
});
