import { describe, expect, it } from "vitest";
import { formatLineRange, formatMarkerAnchor, parseAnchor } from "./anchors.js";

describe("Anchor string parsing", () => {
  it("should accept well-formed line-range anchors", () => {
    expect(parseAnchor("lines:1-3")).toEqual({ kind: "lines", range: { start: 1, end: 3 } });
  });

  it("should accept symbol anchors", () => {
    expect(parseAnchor("symbol:Foo")).toEqual({ kind: "symbol", name: "Foo" });
  });

  it("should reject line ranges where the end precedes the start", () => {
    expect(() => parseAnchor("lines:5-2")).toThrow();
  });

  it("should parse marker anchors and normalise ids to lower case", () => {
    expect(parseAnchor("marker:Ab12Cd")).toEqual({ kind: "marker", id: "ab12cd" });
  });
});

describe("Line-range anchor formatting", () => {
  it("should round-trip through parseAnchor", () => {
    const range = { start: 10, end: 40 };
    expect(parseAnchor(formatLineRange(range))).toEqual({ kind: "lines", range });
  });
});

describe("Marker anchor formatting", () => {
  it("should round-trip marker ids through parseAnchor", () => {
    const id = "abc123";
    expect(parseAnchor(formatMarkerAnchor(id))).toEqual({ kind: "marker", id });
  });

  it("should preserve hyphenated slug-style marker ids", () => {
    expect(parseAnchor(formatMarkerAnchor("My-Region"))).toEqual({
      kind: "marker",
      id: "my-region",
    });
  });
});
