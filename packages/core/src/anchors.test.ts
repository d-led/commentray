import { describe, expect, it } from "vitest";
import { formatLineRange, formatMarkerAnchor, parseAnchor } from "./anchors.js";

describe("parseAnchor", () => {
  it("parses line ranges", () => {
    expect(parseAnchor("lines:1-3")).toEqual({ kind: "lines", range: { start: 1, end: 3 } });
  });

  it("parses symbols", () => {
    expect(parseAnchor("symbol:Foo")).toEqual({ kind: "symbol", name: "Foo" });
  });

  it("rejects invalid line ranges", () => {
    expect(() => parseAnchor("lines:5-2")).toThrow();
  });

  it("parses marker anchors (normalises id to lower-case)", () => {
    expect(parseAnchor("marker:Ab12Cd")).toEqual({ kind: "marker", id: "ab12cd" });
  });
});

describe("formatLineRange", () => {
  it("round-trips with parseAnchor", () => {
    const range = { start: 10, end: 40 };
    expect(parseAnchor(formatLineRange(range))).toEqual({ kind: "lines", range });
  });
});

describe("formatMarkerAnchor", () => {
  it("round-trips with parseAnchor", () => {
    const id = "abc123";
    expect(parseAnchor(formatMarkerAnchor(id))).toEqual({ kind: "marker", id });
  });
});
