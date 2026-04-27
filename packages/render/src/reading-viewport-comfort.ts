/**
 * Shared vertical comfort band for scroll probes and block snaps (dual-pane code browser).
 * Keeps the “reading line” away from hard viewport edges so layout math matches how people read.
 */

export const READING_VIEWPORT_BOTTOM_EDGE_CSS_PX = 64;

export const READING_VIEWPORT_TOP_INSET_MIN_CSS_PX = 12;

export const READING_VIEWPORT_TOP_INSET_MAX_CSS_PX = 48;

export const READING_VIEWPORT_TOP_INSET_MAX_FRAC = 0.18;

export function readingViewportTopInsetCssPx(visibleHeightPx: number): number {
  return Math.max(
    READING_VIEWPORT_TOP_INSET_MIN_CSS_PX,
    Math.min(
      READING_VIEWPORT_TOP_INSET_MAX_CSS_PX,
      visibleHeightPx * READING_VIEWPORT_TOP_INSET_MAX_FRAC,
    ),
  );
}

export const DUAL_PANE_BLOCK_REVEAL_LEAD_CSS_PX = READING_VIEWPORT_TOP_INSET_MIN_CSS_PX;

export const READING_LEAD_ALIGN_TOLERANCE_CSS_PX = 8;
