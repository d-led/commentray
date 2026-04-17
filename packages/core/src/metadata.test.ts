import { describe, expect, it } from "vitest";
import { assertValidIndex } from "./metadata.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";

describe("assertValidIndex", () => {
  it("accepts a minimal valid index", () => {
    const idx = assertValidIndex({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      bySourceFile: {
        "src/a.ts": {
          sourcePath: "src/a.ts",
          commentrayPath: ".commentray/source/src/a.ts.md",
          blocks: [{ id: "b1", anchor: "lines:1-2" }],
        },
      },
    });
    expect(idx.bySourceFile["src/a.ts"]?.blocks[0]?.id).toBe("b1");
  });

  it("rejects invalid shapes", () => {
    expect(() => assertValidIndex(null)).toThrow();
    expect(() => assertValidIndex({ schemaVersion: 999, bySourceFile: {} })).toThrow();
  });
});
