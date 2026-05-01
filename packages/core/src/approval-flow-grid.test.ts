import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BufferingFlowSynchronizer } from "./buffering-flow-synchronizer.js";
import {
  parseApprovalFlowSections,
  parseApprovalFlowSectionsWithFormat,
} from "./approval-flow-grid.js";
import {
  inferApprovalGridFormatFromAscii,
  printApprovalSynchronizedFlow,
} from "./buffering-flow-synchronizer-approval-printer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zigZagInputPath = path.join(
  __dirname,
  "buffering-flow-synchronizer.approvals/two-columns.zig-zag-alternating-sync-needs.input.txt",
);

describe("parseApprovalFlowSections ↔ printApprovalSynchronizedFlow", () => {
  it("parses consecutive XXXX in one column as one anonymous block (height 1–3), not a new block per row", () => {
    const input = ["XXXX  XXXX", "XXXX      "].join("\n");
    const [{ left, right }] = parseApprovalFlowSections(input);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({
      id: "__ANON__1",
      height: 2,
      bufferAbove: 0,
      bufferBelow: 0,
    });
    expect(right).toHaveLength(1);
    expect(right[0]).toMatchObject({
      id: "__ANON__1",
      height: 1,
      bufferAbove: 0,
      bufferBelow: 0,
    });
  });

  it("renders continuation rows inside R1 so both columns stay on the same zip rows until slack", () => {
    const input = fs.readFileSync(zigZagInputPath, "utf8");
    const { sections, format } = parseApprovalFlowSectionsWithFormat(input);
    const synchronizedSections = sections.map((sec) =>
      new BufferingFlowSynchronizer().synchronize(sec.left, sec.right),
    );
    const grid = printApprovalSynchronizedFlow(synchronizedSections, format);
    const lines = grid.split("\n");
    expect(lines[0]).toBe("R1XX  R1XX");
    expect(lines[1]).toBe("XXXX  BBBB");
  });

  it("counts one-sided XXXX and stagger rows as part of the same R…XX block (height up to 3)", () => {
    const input = ["R1XX  R1XX", "XXXX      ", "      XXXX"].join("\n");
    const [{ left, right }] = parseApprovalFlowSections(input);
    expect(left.find((x) => x.id === "R1XX")).toMatchObject({
      height: 3,
      bufferAbove: 0,
      bufferBelow: 0,
    });
    expect(right.find((x) => x.id === "R1XX")).toMatchObject({
      height: 3,
      bufferAbove: 0,
      bufferBelow: 0,
    });
  });

  it("aligns the next R{N}XX pair after staggered R1 continuations", () => {
    const input = ["R1XX  R1XX", "R2XX      ", "XXXX  R2XX"].join("\n");
    const [{ left, right }] = parseApprovalFlowSections(input);
    const synchronized = new BufferingFlowSynchronizer().synchronize(left, right);
    const grid = printApprovalSynchronizedFlow(
      [synchronized],
      inferApprovalGridFormatFromAscii(input),
    );
    const lines = grid.split("\n");
    expect(lines[0]).toBe("R1XX  R1XX");
    expect(lines[1]).toBe("BBBB      ");
    expect(lines[2]).toBe("R2XX  R2XX");
    expect(lines[3]).toBe("XXXX  BBBB");
  });
});
