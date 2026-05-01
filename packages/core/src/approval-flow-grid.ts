import type { HeightAdjustable, SyncRegionContinuationKind } from "./height-adjustable.js";
import {
  APPROVAL_CELL_WIDTH,
  APPROVAL_COLUMN_GAP,
  APPROVAL_FILLED_ROW,
  APPROVAL_REGION_TOKEN_RE,
  type ApprovalFlowSection,
  type ApprovalGridFormat,
  inferApprovalGridFormatFromAscii,
} from "./buffering-flow-synchronizer-approval-printer.js";

const ANONYMOUS_ID_PREFIX = "__ANON__";

/** One `R{N}XX` header plus up to two continuation rows per column (see `HeightAdjustable.height`). */
const MAX_APPROVAL_REGION_HEIGHT = 3;

export function splitApprovalLineToCells(
  line: string,
  columnCount: number,
  columnGap: string = APPROVAL_COLUMN_GAP,
): string[] {
  const expectedLength = columnCount * APPROVAL_CELL_WIDTH + (columnCount - 1) * columnGap.length;
  if (line.length !== expectedLength) {
    throw new Error(`Row length ${line.length} does not match expected ${expectedLength}.`);
  }
  const cells: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    const start = i * (APPROVAL_CELL_WIDTH + columnGap.length);
    const cell = line.slice(start, start + APPROVAL_CELL_WIDTH);
    cells.push(cell);
    if (i < columnCount - 1) {
      const gap = line.slice(
        start + APPROVAL_CELL_WIDTH,
        start + APPROVAL_CELL_WIDTH + columnGap.length,
      );
      if (gap !== columnGap) {
        throw new Error(
          `Columns must be separated by exactly ${String(columnGap.length)} gap character(s).`,
        );
      }
    }
  }
  return cells;
}

export function parseApprovalRows(
  asciiColumns: string,
  format?: ApprovalGridFormat,
): Array<string[] | null> {
  const lines = asciiColumns.split("\n").map((line) => line.replace(/\r$/, ""));
  const nonBlankLines = lines.filter((line) => line.trim().length > 0);
  if (nonBlankLines.length === 0) return [];
  const fmt = format ?? inferApprovalGridFormatFromAscii(asciiColumns);
  const firstLine = nonBlankLines[0];
  if (firstLine === undefined) return [];
  const first = firstLine.trimEnd();
  const hasGap = first.length > APPROVAL_CELL_WIDTH;
  const columnCount = hasGap ? 2 : 1;
  const rowDataLen = fmt.rowDataLen;
  return lines.map((line) => {
    if (line.trim().length === 0) return null;
    const padded = line.length < rowDataLen ? line.padEnd(rowDataLen, " ") : line;
    return splitApprovalLineToCells(padded, columnCount, fmt.columnGap);
  });
}

type ColumnParserState = {
  currentRegion: string | null;
  currentHeight: number;
  anonymousBlockCount: number;
  /** `bufferAbove` for the block currently being accumulated (set when the block opens). */
  bufferAboveForCurrentOpenBlock: number;
  /**
   * Partner column had `XXXX` while this column stayed empty in a synced `R…XX` — defer closing
   * the region so the printer can emit `BBBB` on this side (encoded as `bufferAbove` on the next block).
   */
  pendingStaggerSlackRows: number;
  /** Continuation rows after the `R{N}XX` header (`height - 1` entries when `height > 1`). */
  syncRegionContinuationRows: SyncRegionContinuationKind[];
};

function emptyColumnState(): ColumnParserState {
  return {
    currentRegion: null,
    currentHeight: 0,
    anonymousBlockCount: 0,
    bufferAboveForCurrentOpenBlock: 0,
    pendingStaggerSlackRows: 0,
    syncRegionContinuationRows: [],
  };
}

function pushCurrentRegionIfAny(items: HeightAdjustable[], st: ColumnParserState): void {
  if (st.currentRegion === null) return;
  const id = st.currentRegion;
  const height = st.currentHeight;
  if (isSyncRegionId(id) && height > 1) {
    if (st.syncRegionContinuationRows.length !== height - 1) {
      throw new Error(
        `Internal parse error: R region ${id} height ${String(height)} but ${String(st.syncRegionContinuationRows.length)} continuation kind(s).`,
      );
    }
  }
  const row: HeightAdjustable = {
    id,
    height,
    bufferAbove: st.bufferAboveForCurrentOpenBlock,
    bufferBelow: 0,
  };
  if (isSyncRegionId(id) && height > 1) {
    row.syncRegionContinuationRows = [...st.syncRegionContinuationRows];
  }
  items.push(row);
  st.currentRegion = null;
  st.currentHeight = 0;
  st.bufferAboveForCurrentOpenBlock = 0;
  st.syncRegionContinuationRows = [];
}

function openNewBlock(st: ColumnParserState, id: string): void {
  st.currentRegion = id;
  st.currentHeight = 1;
  st.bufferAboveForCurrentOpenBlock = st.pendingStaggerSlackRows;
  st.pendingStaggerSlackRows = 0;
  st.syncRegionContinuationRows = [];
}

function isSyncRegionId(id: string | null): id is string {
  return id !== null && APPROVAL_REGION_TOKEN_RE.test(id);
}

function consumeEmptyCellOppositeHasInk(items: HeightAdjustable[], st: ColumnParserState): void {
  if (st.currentRegion?.startsWith(ANONYMOUS_ID_PREFIX)) {
    pushCurrentRegionIfAny(items, st);
  }
  if (isSyncRegionId(st.currentRegion)) {
    if (st.currentHeight < MAX_APPROVAL_REGION_HEIGHT) {
      st.currentHeight += 1;
      st.syncRegionContinuationRows.push("stagger");
      return;
    }
    pushCurrentRegionIfAny(items, st);
    st.pendingStaggerSlackRows += 1;
    return;
  }
  st.pendingStaggerSlackRows += 1;
}

function consumeFilledRowToken(items: HeightAdjustable[], st: ColumnParserState): void {
  if (
    st.currentRegion?.startsWith(ANONYMOUS_ID_PREFIX) &&
    st.currentHeight >= MAX_APPROVAL_REGION_HEIGHT
  ) {
    pushCurrentRegionIfAny(items, st);
  }
  if (st.currentRegion === null) {
    st.anonymousBlockCount += 1;
    openNewBlock(st, `${ANONYMOUS_ID_PREFIX}${st.anonymousBlockCount}`);
    return;
  }
  if (isSyncRegionId(st.currentRegion)) {
    if (st.currentHeight < MAX_APPROVAL_REGION_HEIGHT) {
      st.currentHeight += 1;
      st.syncRegionContinuationRows.push("body");
      return;
    }
    pushCurrentRegionIfAny(items, st);
    st.anonymousBlockCount += 1;
    openNewBlock(st, `${ANONYMOUS_ID_PREFIX}${st.anonymousBlockCount}`);
    return;
  }
  st.currentHeight += 1;
}

function consumeOneColumn(
  row: string[],
  columnIndex: 0 | 1,
  items: HeightAdjustable[],
  st: ColumnParserState,
  partnerTrimmed: string,
): void {
  const token = row[columnIndex]?.trim() ?? "";

  if (token === "") {
    if (partnerTrimmed.length > 0) {
      consumeEmptyCellOppositeHasInk(items, st);
      return;
    }
    pushCurrentRegionIfAny(items, st);
    return;
  }

  if (token === APPROVAL_FILLED_ROW) {
    consumeFilledRowToken(items, st);
    return;
  }

  if (!APPROVAL_REGION_TOKEN_RE.test(token)) {
    throw new Error(`Unsupported token "${token}". Use RnXX markers or ${APPROVAL_FILLED_ROW}.`);
  }

  if (token === st.currentRegion) {
    st.currentHeight += 1;
    if (isSyncRegionId(st.currentRegion)) {
      st.syncRegionContinuationRows.push("body");
    }
    return;
  }

  pushCurrentRegionIfAny(items, st);
  openNewBlock(st, token);
}

function finalizeColumn(items: HeightAdjustable[], st: ColumnParserState): void {
  pushCurrentRegionIfAny(items, st);
}

function isSyncRegionMarkerId(id: string): boolean {
  return APPROVAL_REGION_TOKEN_RE.test(id);
}

function shouldMergeApprovalSectionsAcrossBlank(
  a: ApprovalFlowSection,
  b: ApprovalFlowSection,
): boolean {
  const aLastLeft = a.left.at(-1);
  const aLastRight = a.right.at(-1);
  const bFirstLeft = b.left[0];
  const bFirstRight = b.right[0];
  if (
    aLastRight !== undefined &&
    bFirstLeft !== undefined &&
    isSyncRegionMarkerId(aLastRight.id) &&
    aLastRight.id === bFirstLeft.id
  ) {
    return true;
  }
  if (
    aLastLeft !== undefined &&
    bFirstRight !== undefined &&
    isSyncRegionMarkerId(aLastLeft.id) &&
    aLastLeft.id === bFirstRight.id
  ) {
    return true;
  }
  return false;
}

/**
 * Joins section pairs when a blank line only separated flows that still belong to one sync story
 * (e.g. `XXXX  R1XX` / blank / `R1XX  XXXX` must synchronize as one section).
 */
export function mergeAdjacentApprovalSectionsForContinuedSync(
  sections: ApprovalFlowSection[],
): ApprovalFlowSection[] {
  const out: ApprovalFlowSection[] = [...sections];
  let i = 0;
  while (i < out.length - 1) {
    const a = out[i];
    const b = out[i + 1];
    if (a !== undefined && b !== undefined && shouldMergeApprovalSectionsAcrossBlank(a, b)) {
      out.splice(i, 2, { left: [...a.left, ...b.left], right: [...a.right, ...b.right] });
      continue;
    }
    i++;
  }
  return out;
}

/** A trailing section with items on only one column is folded into the previous section (see `two-columns.second-column-missing-first-region.input.txt`). */
export function mergeOrphanSingleColumnTailSection(
  sections: ApprovalFlowSection[],
): ApprovalFlowSection[] {
  if (sections.length < 2) return sections;
  const last = sections[sections.length - 1];
  const prev = sections[sections.length - 2];
  if (last === undefined || prev === undefined) return sections;
  const lastOrphanLeft = last.right.length === 0 && last.left.length > 0;
  const lastOrphanRight = last.left.length === 0 && last.right.length > 0;
  if (!lastOrphanLeft && !lastOrphanRight) return sections;
  return [
    ...sections.slice(0, -2),
    {
      left: lastOrphanLeft ? [...prev.left, ...last.left] : [...prev.left],
      right: lastOrphanRight ? [...prev.right, ...last.right] : [...prev.right],
    },
  ];
}

/**
 * Parse fixed-width two-column approval **input** grids into flow sections (blank row = section break).
 * A synced region block is one `R{N}XX` row plus continuation rows in that column: `XXXX` body lines
 * and/or empty cells opposite partner content (stagger), up to three rows total height. An anonymous
 * block is consecutive `XXXX` lines in that column (height 1–3); a new `XXXX` row extends the open
 * block unless height is already max, in which case a new `__ANON__*` block opens. Stagger before the
 * next non-region block still adds `pendingStaggerSlackRows` → `bufferAbove` on that column’s next
 * block when the region is closed at max height or by a new `R…XX` / section break.
 */
export function parseApprovalFlowSectionsWithFormat(asciiColumns: string): {
  sections: ApprovalFlowSection[];
  format: ApprovalGridFormat;
} {
  const format = inferApprovalGridFormatFromAscii(asciiColumns);
  const rows = parseApprovalRows(asciiColumns, format);
  if (rows.length === 0) return { sections: [], format };
  const firstDataRow = rows.find((row): row is string[] => row !== null);
  const columnCount = firstDataRow?.length ?? 0;
  if (columnCount !== 2) {
    throw new Error("Approval fixtures must contain exactly 2 columns.");
  }

  const sections: ApprovalFlowSection[] = [];
  let leftItems: HeightAdjustable[] = [];
  let rightItems: HeightAdjustable[] = [];
  let leftSt = emptyColumnState();
  let rightSt = emptyColumnState();

  const flushSection = (): void => {
    if (leftItems.length === 0 && rightItems.length === 0) return;
    sections.push({ left: leftItems, right: rightItems });
    leftItems = [];
    rightItems = [];
    leftSt = emptyColumnState();
    rightSt = emptyColumnState();
  };

  for (const row of rows) {
    if (row === null) {
      finalizeColumn(leftItems, leftSt);
      finalizeColumn(rightItems, rightSt);
      flushSection();
      continue;
    }
    const leftTrim = row[0]?.trim() ?? "";
    const rightTrim = row[1]?.trim() ?? "";
    consumeOneColumn(row, 0, leftItems, leftSt, rightTrim);
    consumeOneColumn(row, 1, rightItems, rightSt, leftTrim);
  }

  finalizeColumn(leftItems, leftSt);
  finalizeColumn(rightItems, rightSt);
  flushSection();

  return {
    sections: mergeOrphanSingleColumnTailSection(
      mergeAdjacentApprovalSectionsForContinuedSync(sections),
    ),
    format,
  };
}

export function parseApprovalFlowSections(asciiColumns: string): ApprovalFlowSection[] {
  return parseApprovalFlowSectionsWithFormat(asciiColumns).sections;
}
