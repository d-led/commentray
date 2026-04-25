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

/** One entry per block id (earliest source span) when scroll-link payloads contain duplicates. */
export function dedupeBlockScrollLinksById(links: BlockScrollLink[]): BlockScrollLink[] {
  const byId = new Map<string, BlockScrollLink>();
  for (const l of sortBlockLinksBySource(links)) {
    if (!byId.has(l.id)) byId.set(l.id, l);
  }
  return sortBlockLinksBySource([...byId.values()]);
}

export function sortBlockLinksByCommentrayLine(links: BlockScrollLink[]): BlockScrollLink[] {
  return [...links].sort((a, b) =>
    a.commentrayLine !== b.commentrayLine
      ? a.commentrayLine - b.commentrayLine
      : a.sourceStart - b.sourceStart,
  );
}

/**
 * Next block in companion document order (`commentrayLine`). Gutter doc bands must follow
 * rendered markdown order, which can differ from source line order (multi-file / inverted pairs).
 */
export function nextBlockLinkInCommentrayOrder(
  all: ReadonlyArray<BlockScrollLink>,
  current: BlockScrollLink,
): BlockScrollLink | undefined {
  const sorted = sortBlockLinksByCommentrayLine([...all]);
  const idx = sorted.findIndex((l) => l.id === current.id);
  if (idx < 0) return undefined;
  return sorted[idx + 1];
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

/**
 * Which index-backed block owns the companion line at/above `topCommentrayLine0Based`, in
 * markdown order. Matches {@link pickSourceLine0ForCommentrayScroll}’s block choice so gutter
 * “active” emphasis tracks the **doc** viewport (what the reader is reading), not only the code
 * pane’s top line — which can disagree briefly (e.g. tall page-break gaps).
 */
export function activeBlockIdForCommentrayLine0(
  links: BlockScrollLink[],
  topCommentrayLine0Based: number,
): string | null {
  if (links.length === 0) return null;
  const sorted = sortBlockLinksByCommentrayLine([...links]);
  const head = sorted[0];
  if (head === undefined) return null;
  let best = head;
  for (const b of sorted) {
    if (b.commentrayLine <= topCommentrayLine0Based) best = b;
  }
  return best.id;
}

/** 0-based index into `code-line-*` ids from 1-based inclusive source line numbers. */
export function codeLineDomIndex0(sourceLine1Based: number): number {
  return Math.max(0, sourceLine1Based - 1);
}

const PAGE_BREAK_HOST_SELECTOR = '.commentray-page-break[data-commentray-page-break="true"]';

function elementFollowsInDocumentOrder(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Page-break hosts rendered between a block anchor and the next block anchor (or all breaks after
 * `docTop` when `endExclusive` is null), in tree order.
 */
export function pageBreakHostsBetweenAnchors(
  docScrollEl: HTMLElement,
  docTop: HTMLElement,
  endExclusive: HTMLElement | null,
): HTMLElement[] {
  return Array.from(docScrollEl.querySelectorAll<HTMLElement>(PAGE_BREAK_HOST_SELECTOR)).filter(
    (pb) =>
      elementFollowsInDocumentOrder(docTop, pb) &&
      (endExclusive === null || elementFollowsInDocumentOrder(pb, endExclusive)),
  );
}

const MIN_LAYOUT_RECT_SIDE = 0.5;

function isInsidePageBreakHost(el: HTMLElement): boolean {
  const host = el.closest(PAGE_BREAK_HOST_SELECTOR);
  return Boolean(host && !el.isSameNode(host));
}

/**
 * Lowest `getBoundingClientRect().bottom` among laid-out elements strictly after `startAfter` and
 * strictly before `endBefore`, excluding page-break hosts and their descendants (same visual intent
 * as a `Range` over the gap, without relying on `Range#getClientRects`, which jsdom omits).
 */
/**
 * Walks laid-out descendants of `docScrollEl` strictly after `startAfter`; when `endBefore` is set,
 * only elements strictly before that node contribute. Shared by bounded segments and the
 * open-ended tail after the last page break.
 */
function maxContentBottomByElementWalk(
  docScrollEl: HTMLElement,
  startAfter: HTMLElement,
  endBefore: HTMLElement | null,
): number {
  let maxBottom = startAfter.getBoundingClientRect().top + 2;
  for (const el of Array.from(docScrollEl.querySelectorAll("*"))) {
    if (!(el instanceof HTMLElement)) continue;
    if (endBefore !== null) {
      if (el === endBefore) continue;
      if (!elementFollowsInDocumentOrder(el, endBefore)) continue;
    }
    if (!elementFollowsInDocumentOrder(startAfter, el)) continue;
    if (isInsidePageBreakHost(el)) continue;
    if (el.matches(PAGE_BREAK_HOST_SELECTOR)) continue;
    const br = el.getBoundingClientRect();
    if (br.width < MIN_LAYOUT_RECT_SIDE || br.height < MIN_LAYOUT_RECT_SIDE) continue;
    maxBottom = Math.max(maxBottom, br.bottom);
  }
  return maxBottom;
}

/**
 * Lowest viewport Y of rendered companion content for one block, **excluding** synthetic
 * `.commentray-page-break` regions. Used so gutter splines do not extend through tall page-break
 * gaps toward the next block.
 *
 * When `endExclusive` is the next block’s `commentray-block-*` anchor, ranges stop before that
 * node. When it is `null` (last block), the final segment runs to the end of `docScrollEl`.
 */
export function maxRenderableCommentaryContentBottomViewport(
  docScrollEl: HTMLElement,
  docTop: HTMLElement,
  endExclusive: HTMLElement | null,
): number {
  const breaks = pageBreakHostsBetweenAnchors(docScrollEl, docTop, endExclusive);
  let maxBottom = docTop.getBoundingClientRect().top + 2;
  let cursor: HTMLElement = docTop;
  for (const pb of breaks) {
    maxBottom = Math.max(maxBottom, maxContentBottomByElementWalk(docScrollEl, cursor, pb));
    cursor = pb;
  }
  if (endExclusive) {
    maxBottom = Math.max(
      maxBottom,
      maxContentBottomByElementWalk(docScrollEl, cursor, endExclusive),
    );
  } else {
    maxBottom = Math.max(maxBottom, maxContentBottomByElementWalk(docScrollEl, cursor, null));
  }
  return maxBottom;
}
