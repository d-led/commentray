import { describe, expect, it } from "vitest";

import {
  activeBlockIdForCommentrayLine0,
  activeBlockIdForViewport,
  clampViewportYToGutterLocal,
  codeLineDomIndex0,
  cubicBezierAcrossGutterD,
  dedupeBlockScrollLinksById,
  gutterRayBezierPaths,
  nextBlockLinkInCommentrayOrder,
  splitCubicAtT,
  sortBlockLinksByCommentrayLine,
  sortBlockLinksBySource,
} from "./code-browser-block-rays.js";

describe("clampViewportYToGutterLocal", () => {
  it("maps viewport Y into gutter-local space when inside the band", () => {
    expect(clampViewportYToGutterLocal(110, 100, 400, 5)).toEqual({ y: 10, clipped: "none" });
  });

  it("clamps to the top band when the anchor is above the viewport", () => {
    expect(clampViewportYToGutterLocal(50, 100, 400, 5)).toEqual({ y: 5, clipped: "above" });
  });

  it("clamps to the bottom band when the anchor is below the viewport", () => {
    expect(clampViewportYToGutterLocal(600, 100, 400, 5)).toEqual({ y: 395, clipped: "below" });
  });
});

describe("cubicBezierAcrossGutterD", () => {
  it("emits a cubic path across the gutter", () => {
    const d = cubicBezierAcrossGutterD(0, 10, 8, 40);
    expect(d).toMatch(/^M 0\.00 10\.00 C/);
    expect(d).toContain("8.00 40.00");
  });

  it("lengthens handles at clipped ends so the tangent stays horizontal along the viewport edge", () => {
    const unclipped = cubicBezierAcrossGutterD(0, 2, 10, 20);
    const clippedStart = cubicBezierAcrossGutterD(0, 2, 10, 20, {
      tension: 0.38,
      clipStart: "above",
      clipEnd: "none",
    });
    const c1Un = /C ([\d.]+) 2\.00/.exec(unclipped)?.[1];
    const c1Cl = /C ([\d.]+) 2\.00/.exec(clippedStart)?.[1];
    expect(c1Un).toBeDefined();
    expect(c1Cl).toBeDefined();
    expect(Number(c1Cl)).toBeGreaterThan(Number(c1Un));
  });
});

describe("gutterRayBezierPaths", () => {
  it("returns a single solid path when nothing is clipped", () => {
    const out = gutterRayBezierPaths(0, 10, 8, 40);
    expect(out.dotted).toBeUndefined();
    expect(out.solid).toMatch(/^M 0\.00 10\.00 C/);
    expect(out.solid).toContain("8.00 40.00");
  });

  it("adds a dotted Bézier tail when an endpoint is clipped", () => {
    const out = gutterRayBezierPaths(0, 2, 10, 20, { tension: 0.38, clipStart: "above" });
    expect(out.dotted).toBeDefined();
    expect(out.dotted).toMatch(/^M [\d.]+ [\d.]+ C/);
    expect(out.solid).toMatch(/^M 0\.00 2\.00 C/);
  });
});

describe("splitCubicAtT", () => {
  it("joins the two segments at the split point", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 3, y: 0 };
    const p2 = { x: 7, y: 10 };
    const p3 = { x: 10, y: 10 };
    const [left, right] = splitCubicAtT(p0, p1, p2, p3, 0.5);
    expect(left[3]).toEqual(right[0]);
  });
});

describe("sortBlockLinksBySource", () => {
  it("orders by sourceStart", () => {
    const out = sortBlockLinksBySource([
      { id: "b2", commentrayLine: 5, sourceStart: 20, sourceEnd: 25 },
      { id: "b1", commentrayLine: 0, sourceStart: 1, sourceEnd: 5 },
    ]);
    expect(out.map((x) => x.id)).toEqual(["b1", "b2"]);
  });
});

describe("dedupeBlockScrollLinksById", () => {
  it("keeps the earliest source span when the same id appears twice", () => {
    const out = dedupeBlockScrollLinksById([
      { id: "x", commentrayLine: 0, sourceStart: 10, sourceEnd: 12 },
      { id: "x", commentrayLine: 0, sourceStart: 1, sourceEnd: 3 },
    ]);
    expect(out).toEqual([{ id: "x", commentrayLine: 0, sourceStart: 1, sourceEnd: 3 }]);
  });
});

describe("nextBlockLinkInCommentrayOrder", () => {
  it("uses companion line order, not source order", () => {
    const a = { id: "static", commentrayLine: 100, sourceStart: 1, sourceEnd: 10 };
    const b = { id: "angles", commentrayLine: 50, sourceStart: 20, sourceEnd: 30 };
    const both = [a, b];
    expect(sortBlockLinksByCommentrayLine(both).map((x) => x.id)).toEqual(["angles", "static"]);
    expect(nextBlockLinkInCommentrayOrder(both, b)?.id).toBe("static");
    expect(nextBlockLinkInCommentrayOrder(both, a)).toBeUndefined();
  });
});

describe("activeBlockIdForViewport", () => {
  const links = [
    { id: "b1", commentrayLine: 0, sourceStart: 1, sourceEnd: 5 },
    { id: "b2", commentrayLine: 5, sourceStart: 20, sourceEnd: 25 },
  ];

  it("returns the block id that contains the top source line", () => {
    expect(activeBlockIdForViewport(links, 3)).toBe("b1");
    expect(activeBlockIdForViewport(links, 22)).toBe("b2");
  });

  it("returns the nearest preceding block in gaps", () => {
    expect(activeBlockIdForViewport(links, 10)).toBe("b1");
  });
});

describe("activeBlockIdForCommentrayLine0", () => {
  const links = [
    { id: "b1", commentrayLine: 2, sourceStart: 1, sourceEnd: 5 },
    { id: "b2", commentrayLine: 12, sourceStart: 20, sourceEnd: 25 },
  ];

  it("returns the block whose marker is at or above the probed companion line", () => {
    expect(activeBlockIdForCommentrayLine0(links, 2)).toBe("b1");
    expect(activeBlockIdForCommentrayLine0(links, 11)).toBe("b1");
    expect(activeBlockIdForCommentrayLine0(links, 12)).toBe("b2");
    expect(activeBlockIdForCommentrayLine0(links, 99)).toBe("b2");
  });

  it("uses markdown order, not source line order, when ids are inverted", () => {
    const inverted = [
      { id: "lateInFile", commentrayLine: 0, sourceStart: 100, sourceEnd: 110 },
      { id: "earlyInFile", commentrayLine: 8, sourceStart: 1, sourceEnd: 20 },
    ];
    expect(activeBlockIdForCommentrayLine0(inverted, 0)).toBe("lateInFile");
    expect(activeBlockIdForCommentrayLine0(inverted, 8)).toBe("earlyInFile");
  });
});

describe("codeLineDomIndex0", () => {
  it("converts 1-based source lines to 0-based DOM line ids", () => {
    expect(codeLineDomIndex0(1)).toBe(0);
    expect(codeLineDomIndex0(5)).toBe(4);
  });
});
