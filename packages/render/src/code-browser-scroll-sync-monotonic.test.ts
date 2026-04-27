import { describe, expect, it } from "vitest";

import {
  SCROLL_SYNC_MONOTONIC_EPS,
  shouldRevertPartnerScrollForMonotonicity,
} from "./code-browser-scroll-sync-monotonic.js";

describe("dual-pane scroll sync — partner monotonicity (spec)", () => {
  it("given the driver scrolled clearly down, when the partner moved up, then revert is required", () => {
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: 40,
        partnerBefore: 200,
        partnerAfter: 100,
      }),
    ).toBe(true);
  });

  it("given the driver scrolled clearly down, when the partner stayed flat or moved down, then no revert", () => {
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: 40,
        partnerBefore: 200,
        partnerAfter: 200,
      }),
    ).toBe(false);
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: 40,
        partnerBefore: 200,
        partnerAfter: 250,
      }),
    ).toBe(false);
  });

  it("given the driver scrolled clearly up, when the partner moved down, then revert is required", () => {
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: -50,
        partnerBefore: 300,
        partnerAfter: 400,
      }),
    ).toBe(true);
  });

  it("given a tiny driver delta (noise), then never revert regardless of partner jitter", () => {
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: SCROLL_SYNC_MONOTONIC_EPS * 0.5,
        partnerBefore: 100,
        partnerAfter: 0,
      }),
    ).toBe(false);
  });

  it("given sub-pixel partner motion within epsilon of unchanged, then no revert when driver is decisive", () => {
    expect(
      shouldRevertPartnerScrollForMonotonicity({
        driverDelta: 20,
        partnerBefore: 100,
        partnerAfter: 100 - SCROLL_SYNC_MONOTONIC_EPS * 0.5,
      }),
    ).toBe(false);
  });
});
