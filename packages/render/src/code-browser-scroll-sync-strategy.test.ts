import { describe, expect, it } from "vitest";

import {
  DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY,
  parseDualPaneScrollSyncStrategy,
} from "./code-browser-scroll-sync-strategy.js";

describe("dual-pane scroll sync strategy parse", () => {
  it("given a missing or blank attribute, then the default block-aware proportional strategy is used", () => {
    expect(parseDualPaneScrollSyncStrategy(null)).toBe(DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY);
    expect(parseDualPaneScrollSyncStrategy(undefined)).toBe(DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY);
    expect(parseDualPaneScrollSyncStrategy("")).toBe(DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY);
    expect(parseDualPaneScrollSyncStrategy("   ")).toBe(DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY);
  });

  it("given a known strategy id, then that id is returned", () => {
    expect(parseDualPaneScrollSyncStrategy("block-snap-only")).toBe("block-snap-only");
    expect(parseDualPaneScrollSyncStrategy(" filler-blocks ")).toBe("filler-blocks");
  });

  it("given an unknown value, then the implementation falls back to the default", () => {
    expect(parseDualPaneScrollSyncStrategy("nope")).toBe(DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY);
    expect(parseDualPaneScrollSyncStrategy("block-aware")).toBe(
      DEFAULT_DUAL_PANE_SCROLL_SYNC_STRATEGY,
    );
  });
});
