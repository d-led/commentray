import { describe, expect, it } from "vitest";
import type { HeightAdjustable } from "./height-adjustable.js";
import { BufferingFlowSynchronizer } from "./buffering-flow-synchronizer.js";

describe("BufferingFlowSynchronizer", () => {
  it("sets bufferBelow so each region reaches the tallest matching region", () => {
    const left: HeightAdjustable[] = [
      { id: "r1", height: 20, bufferBelow: 0 },
      { id: "r2", height: 10, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [
      { id: "r1", height: 12, bufferBelow: 0 },
      { id: "r2", height: 18, bufferBelow: 0 },
    ];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);

    expect(result).toEqual({
      left: [
        { id: "r1", height: 20, bufferBelow: 0 },
        { id: "r2", height: 10, bufferBelow: 8 },
      ],
      right: [
        { id: "r1", height: 12, bufferBelow: 8 },
        { id: "r2", height: 18, bufferBelow: 0 },
      ],
    });
  });

  it("does not mutate the input items", () => {
    const original = { id: "r1", height: 10, bufferBelow: 4 };
    const left: HeightAdjustable[] = [original];
    const right: HeightAdjustable[] = [{ id: "r1", height: 14, bufferBelow: 0 }];

    const result = new BufferingFlowSynchronizer().synchronize(left, right);
    const synchronizedItem = result.left[0];

    expect(original.bufferBelow).toBe(4);
    expect(synchronizedItem).not.toBe(original);
    expect(synchronizedItem).toEqual({ id: "r1", height: 10, bufferBelow: 4 });
  });

  it("keeps original region values when no matching region exists in another flow", () => {
    const left: HeightAdjustable[] = [
      { id: "r1", height: 10, bufferBelow: 0 },
      { id: "r2", height: 7, bufferBelow: 0 },
    ];
    const right: HeightAdjustable[] = [{ id: "r1", height: 15, bufferBelow: 0 }];
    const result = new BufferingFlowSynchronizer().synchronize(left, right);
    expect(result.left[1]).toEqual({ id: "r2", height: 7, bufferBelow: 0 });
  });
});
