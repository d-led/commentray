import {
  BufferingFlowSynchronizer,
  NON_SYNC_TAIL_SLACK_ITEM_ID,
  type HeightAdjustable,
} from "@commentray/core/buffering-flow-synchronizer";

/**
 * Stretch layout uses **one** vertical scroll (`#shell.shell--stretch-rows`). Per logical row we
 * materialize the core synchronizer’s `bufferBelow` / `bufferAbove` as **`padding-bottom`** /
 * **`padding-top`** on the shorter `<td>`: the browser equivalent of approval grids’ `BBBB` fill so
 * both columns share the same row height and scroll as a single surface (see
 * `buffering-flow-synchronizer.approvals/`).
 */
const STRETCH_ROW_SELECTOR = "tbody tr.stretch-row[data-commentray-stretch-sync-id]";
const MERMAID_DONE_EVENT = "commentray-mermaid-done";

const synchronizer = new BufferingFlowSynchronizer();

function roundCssPx(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n));
}

function asHTMLElement(el: Element): HTMLElement {
  return el as unknown as HTMLElement;
}

/** `Node.ELEMENT_NODE` without relying on global `Node` (e.g. some Vitest environments). */
const ELEMENT_NODE = 1;

function readHeightFromDocInner(cell: HTMLTableCellElement): number {
  const docInner = cell.querySelector(":scope .stretch-doc-inner");
  if (docInner === null || docInner.nodeType !== ELEMENT_NODE) return 0;
  const hi = asHTMLElement(docInner);
  const sh = hi.scrollHeight;
  if (typeof sh === "number" && sh > 0) return roundCssPx(sh);
  const byRect = roundCssPx(hi.getBoundingClientRect().height);
  if (byRect > 0) return byRect;
  return 0;
}

function readHeightFromCodeStack(cell: HTMLTableCellElement): number {
  const stack = cell.querySelector(":scope .stretch-code-stack");
  if (stack === null || stack.nodeType !== ELEMENT_NODE) return 0;
  const st = asHTMLElement(stack);
  const sh = st.scrollHeight;
  if (typeof sh === "number" && sh > 0) return roundCssPx(sh);
  const byRect = roundCssPx(st.getBoundingClientRect().height);
  if (byRect > 0) return byRect;
  return 0;
}

function readHeightFromCodeLines(measure: HTMLElement): number {
  const lines = measure.querySelectorAll(".code-line");
  if (lines.length === 0) return 0;
  let top = Infinity;
  let bottom = -Infinity;
  for (const line of lines) {
    const r = line.getBoundingClientRect();
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (bottom <= top || !Number.isFinite(top)) return 0;
  const span = roundCssPx(bottom - top);
  return span > 0 ? span : 0;
}

function readHeightFromGapMark(measure: Element): number {
  const gapMark = measure.querySelector(".stretch-gap-mark");
  if (gapMark === null || gapMark.nodeType !== ELEMENT_NODE) return 0;
  return roundCssPx(asHTMLElement(gapMark).getBoundingClientRect().height);
}

/**
 * Table cells share the row’s used height, so `td.offsetHeight` is useless for slack. Prefer
 * content roots (`.stretch-code-stack`, `.stretch-doc-inner`, gap `.code-line` spans) via
 * geometry / `scrollHeight`, then fall back to the measure wrapper.
 */
function readCellIntrinsicHeightPx(cell: HTMLTableCellElement): number {
  const hDoc = readHeightFromDocInner(cell);
  if (hDoc > 0) return hDoc;
  const hStack = readHeightFromCodeStack(cell);
  if (hStack > 0) return hStack;

  const measure = cell.querySelector(":scope > .stretch-cell-measure");
  if (measure === null || measure.nodeType !== ELEMENT_NODE) return roundCssPx(cell.offsetHeight);
  const me = asHTMLElement(measure);

  const linesSpan = readHeightFromCodeLines(me);
  if (linesSpan > 0) return linesSpan;

  const gapH = readHeightFromGapMark(measure);
  if (gapH > 0) return gapH;

  const wrapRect = roundCssPx(me.getBoundingClientRect().height);
  if (wrapRect > 0) return wrapRect;
  return roundCssPx(me.offsetHeight);
}

function stretchRowsWithSyncId(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>(STRETCH_ROW_SELECTOR)).filter(
    (row) => (row.dataset.commentrayStretchSyncId?.trim() ?? "").length > 0,
  );
}

function clearStretchRowPadding(codeTd: HTMLTableCellElement, docTd: HTMLTableCellElement): void {
  codeTd.style.paddingBottom = "";
  docTd.style.paddingBottom = "";
  codeTd.style.paddingTop = "";
  docTd.style.paddingTop = "";
}

function applyStretchSyncPadding(
  codeTd: HTMLTableCellElement,
  docTd: HTMLTableCellElement,
  l: HeightAdjustable,
  r: HeightAdjustable,
): void {
  if (l.bufferAbove > 0) codeTd.style.paddingTop = `${String(l.bufferAbove)}px`;
  if (r.bufferAbove > 0) docTd.style.paddingTop = `${String(r.bufferAbove)}px`;
  if (l.bufferBelow > 0) codeTd.style.paddingBottom = `${String(l.bufferBelow)}px`;
  if (r.bufferBelow > 0) docTd.style.paddingBottom = `${String(r.bufferBelow)}px`;
}

function stretchRowCells(row: HTMLTableRowElement): {
  codeTd: HTMLTableCellElement;
  docTd: HTMLTableCellElement;
} | null {
  const cells = row.querySelectorAll<HTMLTableCellElement>("td");
  const codeTd = cells[0];
  const docTd = cells[1];
  if (codeTd === undefined || docTd === undefined) return null;
  return { codeTd, docTd };
}

/**
 * Applies `BufferingFlowSynchronizer` per stretch row (one shared sync id per `<tr>`). The shorter
 * cell gets `padding-bottom` so the row matches the taller side—same contract as `BBBB` in core
 * approval fixtures, recomputed when layout changes (Mermaid, wrap, viewport).
 */
export function applyBlockStretchRowBuffers(table: HTMLTableElement): void {
  const rows = stretchRowsWithSyncId(table);
  if (rows.length === 0) return;

  const left: HeightAdjustable[] = [];
  const right: HeightAdjustable[] = [];

  for (const row of rows) {
    const pair = stretchRowCells(row);
    if (pair === null) continue;
    clearStretchRowPadding(pair.codeTd, pair.docTd);
  }

  for (const row of rows) {
    const pair = stretchRowCells(row);
    if (pair === null) continue;
    const id = row.dataset.commentrayStretchSyncId?.trim() ?? "";
    left.push({
      id,
      height: readCellIntrinsicHeightPx(pair.codeTd),
      bufferAbove: 0,
      bufferBelow: 0,
    });
    right.push({
      id,
      height: readCellIntrinsicHeightPx(pair.docTd),
      bufferAbove: 0,
      bufferBelow: 0,
    });
  }

  if (left.length === 0) return;

  const sync = synchronizer.synchronize(left, right);
  const rowCount = rows.length;

  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];
    const pair = row === undefined ? null : stretchRowCells(row);
    const l = sync.left[i];
    const r = sync.right[i];
    if (pair === null || l === undefined || r === undefined) continue;
    applyStretchSyncPadding(pair.codeTd, pair.docTd, l, r);
  }

  let tailLeftBelow = 0;
  let tailRightBelow = 0;
  for (let i = rowCount; i < sync.left.length; i++) {
    const l = sync.left[i];
    const r = sync.right[i];
    if (l?.id === NON_SYNC_TAIL_SLACK_ITEM_ID) tailLeftBelow += l.bufferBelow;
    if (r?.id === NON_SYNC_TAIL_SLACK_ITEM_ID) tailRightBelow += r.bufferBelow;
  }
  if (tailLeftBelow > 0 || tailRightBelow > 0) {
    const lastRow = rows.at(-1);
    const pair = lastRow === undefined ? null : stretchRowCells(lastRow);
    const lLast = sync.left[rowCount - 1];
    const rLast = sync.right[rowCount - 1];
    if (pair !== null && lLast !== undefined && rLast !== undefined) {
      if (tailLeftBelow > 0) {
        pair.codeTd.style.paddingBottom = `${String(lLast.bufferBelow + tailLeftBelow)}px`;
      }
      if (tailRightBelow > 0) {
        pair.docTd.style.paddingBottom = `${String(rLast.bufferBelow + tailRightBelow)}px`;
      }
    }
  }
}

export function dispatchCommentrayMermaidDone(): void {
  globalThis.dispatchEvent(new CustomEvent(MERMAID_DONE_EVENT));
}

export type BlockStretchBufferSyncHandle = {
  disconnect: () => void;
};

/**
 * Schedules `applyBlockStretchRowBuffers` on viewport changes, table geometry changes, and after
 * Mermaid finishes (see `dispatchCommentrayMermaidDone` / inline mermaid module).
 */
export function wireBlockStretchBufferSync(table: HTMLTableElement): BlockStretchBufferSyncHandle {
  let raf = 0;
  let moTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const schedule = (): void => {
    if (raf !== 0) globalThis.cancelAnimationFrame(raf);
    raf = globalThis.requestAnimationFrame(() => {
      raf = 0;
      applyBlockStretchRowBuffers(table);
    });
  };

  const scheduleMutationDebounced = (): void => {
    if (moTimer !== undefined) globalThis.clearTimeout(moTimer);
    moTimer = globalThis.setTimeout(() => {
      moTimer = undefined;
      schedule();
    }, 32);
  };

  const ro = new ResizeObserver(() => {
    schedule();
  });
  ro.observe(table);

  const tbody = table.querySelector("tbody");
  const mo =
    tbody !== null
      ? new MutationObserver(() => {
          scheduleMutationDebounced();
        })
      : null;
  if (mo !== null && tbody !== null) {
    mo.observe(tbody, { childList: true, subtree: true });
  }

  const onWin = (): void => {
    schedule();
  };
  globalThis.addEventListener("resize", onWin, { passive: true });
  globalThis.visualViewport?.addEventListener("resize", onWin, { passive: true });

  const onMermaid = (): void => {
    schedule();
  };
  globalThis.addEventListener(MERMAID_DONE_EVENT, onMermaid);

  queueMicrotask(() => {
    schedule();
    globalThis.requestAnimationFrame(() => {
      schedule();
      globalThis.requestAnimationFrame(() => {
        schedule();
      });
    });
    globalThis.setTimeout(() => {
      schedule();
    }, 120);
  });

  return {
    disconnect: (): void => {
      if (raf !== 0) globalThis.cancelAnimationFrame(raf);
      if (moTimer !== undefined) globalThis.clearTimeout(moTimer);
      ro.disconnect();
      mo?.disconnect();
      globalThis.removeEventListener("resize", onWin);
      globalThis.visualViewport?.removeEventListener("resize", onWin);
      globalThis.removeEventListener(MERMAID_DONE_EVENT, onMermaid);
    },
  };
}
