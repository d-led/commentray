export interface WithHeight {
  height: number;
}

export interface Identifiable {
  id: string;
}

/** One row after the `R{N}XX` header inside a synced region (`height` includes that header row). */
export type SyncRegionContinuationKind = "body" | "stagger";

/**
 * A vertical segment in a flow: intrinsic `height` plus optional slack so it can align with other
 * flows (padding before the segment and padding after it, in abstract row units).
 */
export interface HeightAdjustable extends Identifiable, WithHeight {
  /** Row slack before the segment’s content when stacking or aligning flows. */
  bufferAbove: number;
  /** Row slack after the segment’s content when stacking or aligning flows. */
  bufferBelow: number;
  /**
   * When `id` matches `R{N}XX` and `height > 1`, each entry is the kind of that continuation row
   * (partner `XXXX` in this column vs empty/stagger in this column). Approval printing uses `XXXX`
   * only for `body`; `stagger` is rendered as an empty cell so slack is not shown as fake code.
   */
  syncRegionContinuationRows?: readonly SyncRegionContinuationKind[];
}
