import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import type { HeightAdjustable } from "./height-adjustable.js";
import { BufferingFlowSynchronizer } from "./buffering-flow-synchronizer.js";

const require = createRequire(import.meta.url);

type ApprovalsApi = {
  configure(overrideOptions: { reporters?: string[] }): void;
  verify(
    dirName: string,
    testName: string,
    data: string,
    optionsOverride?: { approvedFileExtensionWithDot?: string; reporters?: string[] },
  ): void;
};

const approvals = require("approvals") as ApprovalsApi;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPROVALS_DIR = path.join(__dirname, "buffering-flow-synchronizer.approvals");

const CELL_WIDTH = 4;
const COLUMN_GAP = "  ";
const FILLED_ROW = "XXXX";
const BUFFER_FILL = "BBBB";
const REGION_TOKEN_RE = /^R\dXX$/;
const ANONYMOUS_ID_PREFIX = "__ANON__";

function padCell(value: string): string {
  return value.padEnd(CELL_WIDTH, " ").slice(0, CELL_WIDTH);
}

function splitLineToCells(line: string, columnCount: number): string[] {
  const expectedLength = columnCount * CELL_WIDTH + (columnCount - 1) * COLUMN_GAP.length;
  if (line.length !== expectedLength) {
    throw new Error(`Row length ${line.length} does not match expected ${expectedLength}.`);
  }
  const cells: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    const start = i * (CELL_WIDTH + COLUMN_GAP.length);
    const cell = line.slice(start, start + CELL_WIDTH);
    cells.push(cell);
    if (i < columnCount - 1) {
      const gap = line.slice(start + CELL_WIDTH, start + CELL_WIDTH + COLUMN_GAP.length);
      if (gap !== COLUMN_GAP) {
        throw new Error(`Columns must be separated by exactly ${COLUMN_GAP.length} spaces.`);
      }
    }
  }
  return cells;
}

function parseRows(asciiColumns: string): Array<string[] | null> {
  const lines = asciiColumns.split("\n").map((line) => line.replace(/\r$/, ""));
  const nonBlankLines = lines.filter((line) => line.trim().length > 0);
  if (nonBlankLines.length === 0) return [];
  const firstLength = nonBlankLines[0]?.length ?? 0;
  const hasGap = firstLength > CELL_WIDTH;
  const columnStride = CELL_WIDTH + COLUMN_GAP.length;
  const columnCount = hasGap ? (firstLength + COLUMN_GAP.length) / columnStride : 1;
  if (!Number.isInteger(columnCount) || columnCount < 1) {
    throw new Error("Unable to infer fixed-width columns.");
  }
  return lines.map((line) => {
    if (line.trim().length === 0) return null;
    return splitLineToCells(line, columnCount);
  });
}

function pushCurrentRegionIfAny(
  items: HeightAdjustable[],
  currentRegion: string | null,
  currentHeight: number,
): void {
  if (currentRegion !== null) {
    items.push({ id: currentRegion, height: currentHeight, bufferBelow: 0 });
  }
}

function parseColumnItems(rows: Array<string[] | null>, columnIndex: number): HeightAdjustable[] {
  const items: HeightAdjustable[] = [];
  let currentRegion: string | null = null;
  let currentHeight = 0;
  let anonymousBlockCount = 0;

  for (const row of rows) {
    if (row === null) {
      pushCurrentRegionIfAny(items, currentRegion, currentHeight);
      currentRegion = null;
      currentHeight = 0;
      continue;
    }

    const token = row[columnIndex]?.trim() ?? "";
    if (token === "") {
      pushCurrentRegionIfAny(items, currentRegion, currentHeight);
      currentRegion = null;
      currentHeight = 0;
      continue;
    }
    if (token === FILLED_ROW) {
      if (currentRegion === null) {
        anonymousBlockCount += 1;
        currentRegion = `${ANONYMOUS_ID_PREFIX}${anonymousBlockCount}`;
        currentHeight = 1;
        continue;
      }
      currentHeight += 1;
      continue;
    }
    if (!REGION_TOKEN_RE.test(token)) {
      throw new Error(`Unsupported token "${token}". Use RnXX markers or ${FILLED_ROW}.`);
    }
    if (token === currentRegion) {
      currentHeight += 1;
      continue;
    }
    pushCurrentRegionIfAny(items, currentRegion, currentHeight);
    currentRegion = token;
    currentHeight = 1;
  }

  pushCurrentRegionIfAny(items, currentRegion, currentHeight);
  return items;
}

function parseRegionFlows(asciiColumns: string): {
  left: HeightAdjustable[];
  right: HeightAdjustable[];
} {
  const rows = parseRows(asciiColumns);
  if (rows.length === 0) return { left: [], right: [] };
  const firstDataRow = rows.find((row): row is string[] => row !== null);
  const columnCount = firstDataRow?.length ?? 0;
  if (columnCount !== 2) {
    throw new Error("Approval fixtures must contain exactly 2 columns.");
  }
  return {
    left: parseColumnItems(rows, 0),
    right: parseColumnItems(rows, 1),
  };
}

function tokenForItem(item: HeightAdjustable): string {
  return REGION_TOKEN_RE.test(item.id) ? item.id : FILLED_ROW;
}

function renderSynchronizedFlows(flows: {
  left: HeightAdjustable[];
  right: HeightAdjustable[];
}): string {
  const flowArrays = [flows.left, flows.right];
  const renderedBlocksByColumn = flowArrays.map((items) =>
    items.map((item) => {
      const lines: string[] = [];
      if (item.height > 0) {
        const headToken = tokenForItem(item);
        lines.push(headToken);
        for (let i = 1; i < item.height; i++) lines.push(FILLED_ROW);
      }
      for (let i = 0; i < item.bufferBelow; i++) lines.push(BUFFER_FILL);
      return lines;
    }),
  );

  const maxBlocks = renderedBlocksByColumn.reduce((max, blocks) => Math.max(max, blocks.length), 0);
  const outputRows: string[] = [];
  for (let blockIndex = 0; blockIndex < maxBlocks; blockIndex++) {
    const blockHeight = renderedBlocksByColumn.reduce((max, columnBlocks) => {
      const block = columnBlocks[blockIndex];
      return Math.max(max, block?.length ?? 0);
    }, 0);
    for (let lineIndex = 0; lineIndex < blockHeight; lineIndex++) {
      const row = renderedBlocksByColumn.map((columnBlocks) => {
        const block = columnBlocks[blockIndex];
        if (!block) return BUFFER_FILL;
        return block[lineIndex] ?? BUFFER_FILL;
      });
      outputRows.push(row.join(COLUMN_GAP));
    }
    if (blockIndex < maxBlocks - 1) {
      outputRows.push(new Array(flowArrays.length).fill(padCell("")).join(COLUMN_GAP));
    }
  }

  return outputRows.join("\n");
}

function assertSingleSpacerRowBetweenBlocks(renderedGrid: string): void {
  const lines = renderedGrid.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const current = lines[i];
    const previous = lines[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current.trim() === "" && previous.trim() === "") {
      throw new Error(
        "Rendered grid must not use more than one spacer line between blocks (only XXXX, RnXX, BBBB rows are content).",
      );
    }
  }
}

/** Block breaks in fixtures are a single blank line — never two consecutive empty lines. */
function assertInputUsesSingleLineBlockBreaks(input: string): void {
  const lines = input.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const current = lines[i];
    const previous = lines[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current.trim() === "" && previous.trim() === "") {
      throw new Error(
        "Fixture input must not contain consecutive blank lines; use exactly one blank line between blocks.",
      );
    }
  }
}

function inputCaseFiles(): string[] {
  return fs
    .readdirSync(APPROVALS_DIR)
    .filter((fileName) => fileName.startsWith("two-columns."))
    .filter((fileName) => fileName.includes(".input."))
    .sort();
}

function approvalNameFromInputFile(fileName: string): string {
  return fileName.replace(".input.", ".");
}

function testNameFromInputFile(fileName: string): string {
  const marker = ".input.";
  const markerIndex = fileName.indexOf(marker);
  return markerIndex >= 0 ? fileName.slice(0, markerIndex) : fileName;
}

function isCiEnv(): boolean {
  const v = process.env.CI?.trim().toLowerCase();
  return v === "true" || v === "1";
}

describe("BufferingFlowSynchronizer approvals", () => {
  if (isCiEnv()) {
    approvals.configure({ reporters: ["donothing"] });
  }

  for (const inputFileName of inputCaseFiles()) {
    it(`approves ${inputFileName}`, () => {
      const inputPath = path.join(APPROVALS_DIR, inputFileName);
      const input = fs.readFileSync(inputPath, "utf8");
      assertInputUsesSingleLineBlockBreaks(input);
      const parsed = parseRegionFlows(input);
      const synchronized = new BufferingFlowSynchronizer().synchronize(parsed.left, parsed.right);
      const renderedGrid = renderSynchronizedFlows(synchronized);
      assertSingleSpacerRowBetweenBlocks(renderedGrid);

      approvals.verify(APPROVALS_DIR, testNameFromInputFile(inputFileName), renderedGrid, {
        approvedFileExtensionWithDot: path.extname(approvalNameFromInputFile(inputFileName)),
      });
    });
  }
});
