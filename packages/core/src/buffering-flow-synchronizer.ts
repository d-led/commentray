import type { HeightAdjustable } from "./height-adjustable.js";

export interface SynchronizedHeightAdjustables {
  left: HeightAdjustable[];
  right: HeightAdjustable[];
}

export class BufferingFlowSynchronizer {
  synchronize(
    left: Iterable<HeightAdjustable>,
    right: Iterable<HeightAdjustable>,
  ): SynchronizedHeightAdjustables {
    const leftItems = [...left];
    const rightItems = [...right];
    const maxHeightByRegionId = new Map<string, number>();
    for (const items of [leftItems, rightItems]) {
      for (const item of items) {
        const currentMax = maxHeightByRegionId.get(item.id) ?? 0;
        if (item.height > currentMax) {
          maxHeightByRegionId.set(item.id, item.height);
        }
      }
    }

    return {
      left: leftItems.map((item) => {
        const maxHeightForRegion = maxHeightByRegionId.get(item.id) ?? item.height;
        return { ...item, bufferBelow: maxHeightForRegion - item.height };
      }),
      right: rightItems.map((item) => {
        const maxHeightForRegion = maxHeightByRegionId.get(item.id) ?? item.height;
        return { ...item, bufferBelow: maxHeightForRegion - item.height };
      }),
    };
  }
}
