import { describe, expect, it } from "vitest";
import type { HeightAdjustable } from "./height-adjustable.js";
import {
  BufferingFlowSynchronizer,
  NON_SYNC_TAIL_SLACK_ITEM_ID,
} from "./buffering-flow-synchronizer.js";

describe("BufferingFlowSynchronizer", () => {
  it("sets bufferBelow so each R{N}XX region reaches the tallest matching region", () => {
    const left: HeightAdjustable[] = [
      { id: "R1XX", height: 20, bufferAbove: 0, bufferBelow: 0 },
      { id: "R2XX", height: 10, bufferAbove: 0, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [
      { id: "R1XX", height: 12, bufferAbove: 0, bufferBelow: 0 },
      { id: "R2XX", height: 18, bufferAbove: 0, bufferBelow: 0 },
    ];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);

    expect(result).toEqual({
      left: [
        { id: "R1XX", height: 20, bufferAbove: 0, bufferBelow: 0 },
        { id: "R2XX", height: 10, bufferAbove: 0, bufferBelow: 8 },
      ],
      right: [
        { id: "R1XX", height: 12, bufferAbove: 0, bufferBelow: 8 },
        { id: "R2XX", height: 18, bufferAbove: 0, bufferBelow: 0 },
      ],
    });
  });

  it("does not mutate the input items", () => {
    const original = { id: "R1XX", height: 10, bufferAbove: 0, bufferBelow: 4 };
    const left: HeightAdjustable[] = [original];
    const right: HeightAdjustable[] = [{ id: "R1XX", height: 14, bufferAbove: 0, bufferBelow: 0 }];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);
    const synchronizedItem = result.left[0];

    expect(original.bufferBelow).toBe(4);
    expect(synchronizedItem).not.toBe(original);
    expect(synchronizedItem).toEqual({ id: "R1XX", height: 10, bufferAbove: 0, bufferBelow: 4 });
  });

  it("keeps original region values when no matching region exists in another flow", () => {
    const left: HeightAdjustable[] = [
      { id: "R1XX", height: 10, bufferAbove: 0, bufferBelow: 0 },
      { id: "R2XX", height: 7, bufferAbove: 0, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [{ id: "R1XX", height: 15, bufferAbove: 0, bufferBelow: 0 }];
    const result = new BufferingFlowSynchronizer().synchronize(left, right);
    expect(result.left[1]).toEqual({ id: "R2XX", height: 7, bufferAbove: 0, bufferBelow: 0 });
  });

  it("adds total-height tail slack to the last non-synced block when the shorter column ends with __ANON__", () => {
    const left: HeightAdjustable[] = [
      { id: "__ANON__1", height: 1, bufferAbove: 0, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [
      { id: "__ANON__2", height: 1, bufferAbove: 0, bufferBelow: 0 },
      { id: "__ANON__3", height: 1, bufferAbove: 0, bufferBelow: 0 },
    ];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);

    expect(result.left).toEqual([{ id: "__ANON__1", height: 1, bufferAbove: 0, bufferBelow: 1 }]);
    expect(result.right).toEqual([
      { id: "__ANON__2", height: 1, bufferAbove: 0, bufferBelow: 0 },
      { id: "__ANON__3", height: 1, bufferAbove: 0, bufferBelow: 0 },
    ]);
  });

  it("aligns matching R{N}XX starts and pads the shorter column tail", () => {
    const left: HeightAdjustable[] = [
      { id: "__ANON__1", height: 1, bufferAbove: 0, bufferBelow: 0 },
      { id: "R1XX", height: 1, bufferAbove: 0, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [
      { id: "R1XX", height: 1, bufferAbove: 0, bufferBelow: 0 },
      { id: "__ANON__2", height: 1, bufferAbove: 0, bufferBelow: 0 },
    ];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);

    expect(result).toEqual({
      left: [
        { id: "__ANON__1", height: 1, bufferAbove: 0, bufferBelow: 0 },
        { id: "R1XX", height: 1, bufferAbove: 0, bufferBelow: 0 },
        {
          id: NON_SYNC_TAIL_SLACK_ITEM_ID,
          height: 0,
          bufferAbove: 0,
          bufferBelow: 1,
        },
      ],
      right: [
        { id: "R1XX", height: 1, bufferAbove: 1, bufferBelow: 0 },
        { id: "__ANON__2", height: 1, bufferAbove: 0, bufferBelow: 0 },
        {
          id: NON_SYNC_TAIL_SLACK_ITEM_ID,
          height: 0,
          bufferAbove: 0,
          bufferBelow: 0,
        },
      ],
    });
  });
});
