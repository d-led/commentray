import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import {
  validateIndexMarkerSemantics,
  validateMarkerBoundariesInSource,
} from "./marker-validation.js";

describe("Region marker boundary validation in source files", () => {
  it("reports duplicate starts for the same id", () => {
    const src = [
      "// commentray:start id=x",
      "a",
      "// commentray:start id=x",
      "b",
      "// commentray:end id=x",
    ].join("\n");
    const issues = validateMarkerBoundariesInSource(src, "f.ts");
    expect(issues.some((i) => i.level === "error" && i.message.includes("duplicate"))).toBe(true);
  });

  it("reports orphan end", () => {
    const issues = validateMarkerBoundariesInSource("// commentray:end id=z\n", "g.ts");
    expect(issues.some((i) => i.message.includes("no matching start"))).toBe(true);
  });

  it("reports unclosed start", () => {
    const issues = validateMarkerBoundariesInSource("// commentray:start id=u\n", "h.ts");
    expect(issues.some((i) => i.message.includes("no matching end"))).toBe(true);
  });

  it("passes for a balanced pair", () => {
    const src = ["//#region commentray:ok", "1", "//#endregion commentray:ok"].join("\n");
    expect(validateMarkerBoundariesInSource(src, "t.ts")).toEqual([]);
  });
});

describe("Index marker semantics versus on-disk source", () => {
  it("errors when the same source marker id is claimed by different block ids", () => {
    const cp1 = ".commentray/source/a.md";
    const cp2 = ".commentray/source/b.md";
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cp1]: {
          sourcePath: "src/x.ts",
          commentrayPath: cp1,
          blocks: [{ id: "m1", anchor: "marker:m1", markerId: "m1" }],
        },
        [cp2]: {
          sourcePath: "src/x.ts",
          commentrayPath: cp2,
          blocks: [{ id: "m2", anchor: "marker:m1", markerId: "m1" }],
        },
      },
    };
    const issues = validateIndexMarkerSemantics(index);
    expect(
      issues.some((i) => i.level === "error" && i.message.includes("different block ids")),
    ).toBe(true);
  });

  it("warns when the same marker id is used in different source files", () => {
    const cp1 = ".commentray/source/a.md";
    const cp2 = ".commentray/source/b.md";
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cp1]: {
          sourcePath: "src/a.ts",
          commentrayPath: cp1,
          blocks: [{ id: "dup", anchor: "marker:dup", markerId: "dup" }],
        },
        [cp2]: {
          sourcePath: "src/b.ts",
          commentrayPath: cp2,
          blocks: [{ id: "dup", anchor: "marker:dup", markerId: "dup" }],
        },
      },
    };
    const issues = validateIndexMarkerSemantics(index);
    expect(issues.some((i) => i.level === "warn" && i.message.includes("reused across"))).toBe(
      true,
    );
  });
});
