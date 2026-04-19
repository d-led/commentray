import {
  pickCommentrayLineForSourceScroll,
  type BlockScrollLink,
} from "./code-browser-scroll-sync.js";

/** Gutter-local Y after clamping to visible gutter band (viewport-relative input). */
export type GutterYClamp = {
  y: number;
  clipped: "none" | "above" | "below";
};

/**
 * Maps a viewport Y to gutter-local coordinates and clamps into the gutter band
 * so off-screen anchors draw at the top/bottom edge of the gutter.
 */
export function clampViewportYToGutterLocal(
  yViewport: number,
  gutterTop: number,
  gutterHeight: number,
  margin = 5,
): GutterYClamp {
  const lo = gutterTop + margin;
  const hi = gutterTop + gutterHeight - margin;
  if (yViewport < lo) return { y: lo - gutterTop, clipped: "above" };
  if (yViewport > hi) return { y: hi - gutterTop, clipped: "below" };
  return { y: yViewport - gutterTop, clipped: "none" };
}

export type GutterClipKind = GutterYClamp["clipped"];

export type GutterPt = { x: number; y: number };

/**
 * Options for gutter Bézier paths: tension, clipping at viewport edges, and optional split for
 * dotted “tail” segments when an anchor is off-screen.
 */
export type GutterRayBezierOpts = {
  tension?: number;
  clipStart?: GutterClipKind;
  clipEnd?: GutterClipKind;
  splitT?: number;
};

/**
 * Horizontal cubic between the code edge (x0) and doc edge (x1), IntelliJ-style.
 *
 * When an endpoint is **clipped** to the top/bottom of the gutter (anchor off-screen), the
 * corresponding control handle is lengthened so the curve **hugs the viewport boundary** with a
 * horizontal tangent there—read as “the ray meets the edge flat,” not a pointer toward far
 * off-screen content.
 */
export function gutterCubicControlPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: Pick<GutterRayBezierOpts, "tension" | "clipStart" | "clipEnd"> = {},
): [GutterPt, GutterPt, GutterPt, GutterPt] {
  const { tension = 0.38, clipStart = "none", clipEnd = "none" } = opts;
  const boost = 0.24;
  const boosted = Math.min(0.66, tension + boost);
  const t0 = clipStart === "none" ? tension : boosted;
  const t1 = clipEnd === "none" ? tension : boosted;
  const dx = x1 - x0;
  return [
    { x: x0, y: y0 },
    { x: x0 + dx * t0, y: y0 },
    { x: x1 - dx * t1, y: y1 },
    { x: x1, y: y1 },
  ];
}

export function cubicBezierDFromControlPoints(
  p0: GutterPt,
  p1: GutterPt,
  p2: GutterPt,
  p3: GutterPt,
): string {
  return `M ${fmt(p0.x)} ${fmt(p0.y)} C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
}

/** de Casteljau split of a cubic Bézier at t ∈ (0, 1). */
export function splitCubicAtT(
  p0: GutterPt,
  p1: GutterPt,
  p2: GutterPt,
  p3: GutterPt,
  t: number,
): [[GutterPt, GutterPt, GutterPt, GutterPt], [GutterPt, GutterPt, GutterPt, GutterPt]] {
  const q0 = lerpPt(p0, p1, t);
  const q1 = lerpPt(p1, p2, t);
  const q2 = lerpPt(p2, p3, t);
  const r0 = lerpPt(q0, q1, t);
  const r1 = lerpPt(q1, q2, t);
  const s = lerpPt(r0, r1, t);
  return [
    [p0, q0, r0, s],
    [s, r1, q2, p3],
  ];
}

function lerpPt(a: GutterPt, b: GutterPt, t: number): GutterPt {
  return { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
}

export function gutterRayBezierPaths(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: GutterRayBezierOpts = {},
): { solid: string; dotted?: string } {
  const { tension = 0.38, clipStart = "none", clipEnd = "none", splitT = 0.66 } = opts;
  const pts = gutterCubicControlPoints(x0, y0, x1, y1, { tension, clipStart, clipEnd });
  const [p0, p1, p2, p3] = pts;
  const interrupt = clipStart !== "none" || clipEnd !== "none";
  if (!interrupt) {
    return { solid: cubicBezierDFromControlPoints(p0, p1, p2, p3) };
  }
  const [left, right] = splitCubicAtT(p0, p1, p2, p3, splitT);
  const [a0, a1, a2, a3] = left;
  const [b0, b1, b2, b3] = right;
  return {
    solid: cubicBezierDFromControlPoints(a0, a1, a2, a3),
    dotted: cubicBezierDFromControlPoints(b0, b1, b2, b3),
  };
}

export function cubicBezierAcrossGutterD(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: Pick<GutterRayBezierOpts, "tension" | "clipStart" | "clipEnd"> = {},
): string {
  const [p0, p1, p2, p3] = gutterCubicControlPoints(x0, y0, x1, y1, opts);
  return cubicBezierDFromControlPoints(p0, p1, p2, p3);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export function sortBlockLinksBySource(links: BlockScrollLink[]): BlockScrollLink[] {
  return [...links].sort((a, b) => a.sourceStart - b.sourceStart);
}

export function activeBlockIdForViewport(
  links: BlockScrollLink[],
  topSourceLine1Based: number,
): string | null {
  if (links.length === 0) return null;
  const mdLine = pickCommentrayLineForSourceScroll(links, topSourceLine1Based);
  if (mdLine === null) return null;
  const b = links.find((x) => x.commentrayLine === mdLine);
  return b?.id ?? null;
}

/** 0-based index into `code-line-*` ids from 1-based inclusive source line numbers. */
export function codeLineDomIndex0(sourceLine1Based: number): number {
  return Math.max(0, sourceLine1Based - 1);
}
