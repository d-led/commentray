import type { HeightAdjustable } from "./height-adjustable.js";

export type { HeightAdjustable } from "./height-adjustable.js";

/**
 * Synthetic item appended (on **both** columns, paired) when total-height tail slack must not sit on
 * a synced `R{N}XX` block. The shorter side’s tail entry carries the `bufferBelow`; the other side’s
 * carries zero — same array length for consumers that zip by index (e.g. stretch rows).
 */
export const NON_SYNC_TAIL_SLACK_ITEM_ID = "__NON_SYNC_TAIL_SLACK__";

/**
 * Pairs two vertical **flows** (e.g. code vs commentary columns). Items whose `id` matches `R{N}XX`
 * are **synced regions**; every other id stays **local** (no cross-column start alignment or shared
 * region height — unsynced `XXXX` blocks are never treated as paired regions). Pipeline (see
 * `.commentray.toml`, `commentray:start id=toml-buffering-flow-sync`): (1) `bufferBelow` on the shorter
 * side per shared id so region heights match; (2) align first content rows by **preferring** to lower
 * `bufferAbove` on the later-starting `R{N}XX`, then raising the other side if needed; (3) equalize
 * column totals with tail slack only on non-synced blocks or paired {@link NON_SYNC_TAIL_SLACK_ITEM_ID}
 * slots (`BBBB` in approval grids). Shifting `bufferBelow` between paired `R{N}XX` copies would break
 * per-column scroll totals and force stacked tail `BBBB` rows, so that step is not applied (see
 * `.commentray.toml` `toml-buffering-flow-sync`).
 */
export interface SynchronizedHeightAdjustables {
  left: HeightAdjustable[];
  right: HeightAdjustable[];
}

function columnTotalHeight(items: HeightAdjustable[]): number {
  return items.reduce((s, it) => s + it.bufferAbove + it.height + it.bufferBelow, 0);
}

function applySyncRegionBuffersToColumn(
  items: HeightAdjustable[],
  maxHeightByRegionId: Map<string, number>,
): HeightAdjustable[] {
  return items.map((item) => {
    const maxHeightForRegion = isSyncRegionId(item.id)
      ? (maxHeightByRegionId.get(item.id) ?? item.height)
      : item.height;
    return {
      ...item,
      bufferAbove: item.bufferAbove ?? 0,
      bufferBelow: isSyncRegionId(item.id)
        ? maxHeightForRegion - item.height
        : (item.bufferBelow ?? 0),
      ...(item.syncRegionContinuationRows !== undefined
        ? { syncRegionContinuationRows: [...item.syncRegionContinuationRows] }
        : {}),
    };
  });
}

function isSyncRegionId(id: string): boolean {
  return /^R\d+XX$/.test(id);
}

/** Row index of the first intrinsic line of `items[index]` (after `bufferAbove` slack). */
function startRowBeforeContent(items: HeightAdjustable[], index: number): number {
  let sum = 0;
  for (let i = 0; i < index; i++) {
    const it = items[i];
    if (it === undefined) continue;
    sum += it.bufferAbove + it.height + it.bufferBelow;
  }
  const it = items[index];
  return sum + (it?.bufferAbove ?? 0);
}

function firstIndexWithId(items: HeightAdjustable[], id: string): number {
  return items.findIndex((it) => it.id === id);
}

function alignOnePairedRegionStart(
  left: HeightAdjustable[],
  right: HeightAdjustable[],
  il: number,
  ir: number,
): boolean {
  const sL = startRowBeforeContent(left, il);
  const sR = startRowBeforeContent(right, ir);
  if (sL === sR) return false;
  if (sL > sR) {
    const diff = sL - sR;
    const lIt = left[il];
    const takeFromLeft = lIt !== undefined ? Math.min(diff, lIt.bufferAbove) : 0;
    let changed = false;
    if (takeFromLeft > 0 && lIt !== undefined) {
      lIt.bufferAbove -= takeFromLeft;
      changed = true;
    }
    const rem = diff - takeFromLeft;
    if (rem > 0) {
      const rIt = right[ir];
      if (rIt !== undefined) {
        rIt.bufferAbove += rem;
        changed = true;
      }
    }
    return changed;
  }
  const diff = sR - sL;
  const rIt = right[ir];
  const takeFromRight = rIt !== undefined ? Math.min(diff, rIt.bufferAbove) : 0;
  let changed = false;
  if (takeFromRight > 0 && rIt !== undefined) {
    rIt.bufferAbove -= takeFromRight;
    changed = true;
  }
  const rem = diff - takeFromRight;
  if (rem > 0) {
    const lIt = left[il];
    if (lIt !== undefined) {
      lIt.bufferAbove += rem;
      changed = true;
    }
  }
  return changed;
}

/**
 * Aligns paired `R{N}XX` starts at the **same** row index using **minimal** slack: prefer lowering
 * `bufferAbove` on the region that starts **later** (down to 0) before raising `bufferAbove` on the
 * side that starts earlier. That avoids extra symmetric `BBBB`/`BBBB` zip rows when the parse
 * already carried redundant `bufferAbove` on one side.
 */
function alignSyncRegionStarts(left: HeightAdjustable[], right: HeightAdjustable[]): void {
  const ids = new Set<string>();
  for (const it of left) {
    if (isSyncRegionId(it.id)) ids.add(it.id);
  }
  const paired: { id: string; il: number; ir: number }[] = [];
  for (const id of ids) {
    const il = firstIndexWithId(left, id);
    const ir = firstIndexWithId(right, id);
    if (il >= 0 && ir >= 0) paired.push({ id, il, ir });
  }
  paired.sort((a, b) => a.il - b.il);

  const maxPasses = paired.length + 8;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const { il, ir } of paired) {
      if (alignOnePairedRegionStart(left, right, il, ir)) changed = true;
    }
    if (!changed) break;
  }
}

function tailSlackPlaceholder(bufferBelow: number): HeightAdjustable {
  return {
    id: NON_SYNC_TAIL_SLACK_ITEM_ID,
    height: 0,
    bufferAbove: 0,
    bufferBelow,
  };
}

/**
 * Column-equalizing slack at the **bottom** of the shorter column only, never as `bufferBelow` on a
 * synced `R{N}XX` item. Prefers extending the last non-synced item; otherwise appends paired tail
 * placeholders so `L` and `R` stay the same length.
 */
function padShorterColumnTail(L: HeightAdjustable[], R: HeightAdjustable[]): void {
  const tL = columnTotalHeight(L);
  const tR = columnTotalHeight(R);
  const delta = tR - tL;
  if (delta > 0 && L.length > 0) {
    padTailSlackOntoShorterColumn(L, R, delta);
    return;
  }
  const deltaR = tL - tR;
  if (deltaR > 0 && R.length > 0) {
    padTailSlackOntoShorterColumn(R, L, deltaR);
  }
}

function padTailSlackOntoShorterColumn(
  shorter: HeightAdjustable[],
  longer: HeightAdjustable[],
  delta: number,
): void {
  if (delta <= 0) return;
  const last = shorter.at(-1);
  if (last !== undefined && !isSyncRegionId(last.id)) {
    shorter[shorter.length - 1] = { ...last, bufferBelow: last.bufferBelow + delta };
    return;
  }
  shorter.push(tailSlackPlaceholder(delta));
  longer.push(tailSlackPlaceholder(0));
}

/**
 * Mutates shallow copies: aligns `R{N}XX` region starts, equalizes per-id region heights, then
 * pads the shorter column’s tail so totals match.
 */
function cloneHeightAdjustable(it: HeightAdjustable): HeightAdjustable {
  return {
    ...it,
    ...(it.syncRegionContinuationRows !== undefined
      ? { syncRegionContinuationRows: [...it.syncRegionContinuationRows] }
      : {}),
  };
}

function applyStackVerticalAlignment(
  left: HeightAdjustable[],
  right: HeightAdjustable[],
): SynchronizedHeightAdjustables {
  const L = left.map(cloneHeightAdjustable);
  const R = right.map(cloneHeightAdjustable);
  alignSyncRegionStarts(L, R);
  padShorterColumnTail(L, R);
  return { left: L, right: R };
}

export class BufferingFlowSynchronizer {
  synchronize(
    left: Iterable<HeightAdjustable>,
    right: Iterable<HeightAdjustable>,
  ): SynchronizedHeightAdjustables {
    const leftItems = [...left];
    const rightItems = [...right];
    const maxHeightByRegionId = new Map<string, number>();
    for (const item of [...leftItems, ...rightItems]) {
      if (!isSyncRegionId(item.id)) continue;
      const currentMax = maxHeightByRegionId.get(item.id) ?? 0;
      if (item.height > currentMax) maxHeightByRegionId.set(item.id, item.height);
    }

    const withRegionBuffers: SynchronizedHeightAdjustables = {
      left: applySyncRegionBuffersToColumn(leftItems, maxHeightByRegionId),
      right: applySyncRegionBuffersToColumn(rightItems, maxHeightByRegionId),
    };

    return applyStackVerticalAlignment(withRegionBuffers.left, withRegionBuffers.right);
  }
}
