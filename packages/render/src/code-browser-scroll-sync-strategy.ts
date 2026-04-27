/**
 * Mutually exclusive dual-pane scroll correlation modes for the code browser client.
 *
 * Selected at runtime from `#shell` `data-scroll-sync-strategy` (optional; default when absent).
 * Build-time / preview can set {@link CodeBrowserPageOptions.dualPaneScrollSyncStrategy} on the
 * render package to emit the attribute for experiments.
 */

export const DUAL_PANE_SCROLL_SYNC_STRATEGIES = [
  /** Indexed block snaps + proportional mirror in gaps and when there is no index (current product default). */
  "block-aware-proportional",
  /** Block snaps only; partner is not proportionally mirrored in gaps or without an index (partner “holds” until the next snap). */
  "block-snap-only",
  /**
   * Reserved for height-matched filler / buffer layout so scroll ranges align without ratio mapping.
   * Until that layout ships, the client treats this as an alias of {@link DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY}
   * so the mode switch stays stable and testable.
   */
  "filler-blocks",
] as const;

export type DualPaneScrollSyncStrategyId = (typeof DUAL_PANE_SCROLL_SYNC_STRATEGIES)[number];

export const DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY: DualPaneScrollSyncStrategyId =
  "block-aware-proportional";

export function parseDualPaneScrollSyncStrategy(
  raw: string | null | undefined,
): DualPaneScrollSyncStrategyId {
  if (raw === null || raw === undefined) return DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY;
  const t = raw.trim();
  if (t.length === 0) return DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY;
  if ((DUAL_PANE_SCROLL_SYNC_STRATEGIES as readonly string[]).includes(t)) {
    return t as DualPaneScrollSyncStrategyId;
  }
  return DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY;
}
