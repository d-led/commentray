import { describe, expect, it } from "vitest";
import { assertValidIndex } from "./metadata.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";

function indexWithBlock(block: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    bySourceFile: {
      "src/a.ts": {
        sourcePath: "src/a.ts",
        commentrayPath: ".commentray/source/src/a.ts.md",
        blocks: [block],
      },
    },
  };
}

describe("assertValidIndex", () => {
  it("accepts a minimal valid index", () => {
    const idx = assertValidIndex(indexWithBlock({ id: "b1", anchor: "lines:1-2" }));
    expect(idx.bySourceFile["src/a.ts"]?.blocks[0]?.id).toBe("b1");
  });

  it("rejects invalid shapes", () => {
    expect(() => assertValidIndex(null)).toThrow();
    expect(() => assertValidIndex({ schemaVersion: 999, bySourceFile: {} })).toThrow();
  });

  it("accepts an optional fingerprint and markerId on a block", () => {
    expect(() =>
      assertValidIndex(
        indexWithBlock({
          id: "b1",
          anchor: "lines:1-3",
          markerId: "marker-42",
          fingerprint: { startLine: "function foo() {", endLine: "}", lineCount: 3 },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a fingerprint whose lineCount is zero or negative", () => {
    const makeIndex = (lineCount: number) =>
      indexWithBlock({
        id: "b1",
        anchor: "lines:1-1",
        fingerprint: { startLine: "x", endLine: "x", lineCount },
      });
    expect(() => assertValidIndex(makeIndex(0))).toThrow(/positive integer/);
    expect(() => assertValidIndex(makeIndex(-2))).toThrow(/positive integer/);
  });

  it("rejects a fingerprint whose start or end line is not a string", () => {
    expect(() =>
      assertValidIndex(
        indexWithBlock({
          id: "b1",
          anchor: "lines:1-1",
          fingerprint: { startLine: 42, endLine: "x", lineCount: 1 },
        }),
      ),
    ).toThrow(/fingerprint\.startLine/);
  });
});
