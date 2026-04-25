import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import {
  extractCommentrayBlockIdsFromMarkdown,
  validateIndexMarkerSemantics,
  validateMarkerBoundariesInSource,
  validateMarkerRegionsAgainstIndexedSources,
  validateOverlappingMarkerInnerRangesInSource,
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

  it("errors when two regions’ inner line ranges overlap (including nested regions)", () => {
    const src = [
      "//#region commentray:outer",
      "top",
      "//#region commentray:inner",
      "nest",
      "//#endregion commentray:inner",
      "bot",
      "//#endregion commentray:outer",
    ].join("\n");
    const issues = validateMarkerBoundariesInSource(src, "overlap.ts");
    expect(issues.some((i) => i.level === "error" && i.message.includes("overlap"))).toBe(true);
  });

  it("does not treat adjacent inner ranges as overlapping", () => {
    const src = [
      "//#region commentray:a",
      "a",
      "//#endregion commentray:a",
      "//#region commentray:b",
      "b",
      "//#endregion commentray:b",
    ].join("\n");
    expect(validateOverlappingMarkerInnerRangesInSource(src, "adjacent.ts")).toEqual([]);
  });
});

describe("extractCommentrayBlockIdsFromMarkdown", () => {
  it("collects ids from block marker lines", () => {
    const md =
      "<!-- commentray:block id=intro -->\n# Hi\n\n<!-- commentray:block id=tail -->\nBye\n";
    expect([...extractCommentrayBlockIdsFromMarkdown(md)].sort()).toEqual(["intro", "tail"]);
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

describe("Marker anchors versus regions in indexed primaries", () => {
  const cr = ".commentray/source/x.md";
  const indexMarkerX1 = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [cr]: {
        sourcePath: "src/p.ts",
        commentrayPath: cr,
        blocks: [{ id: "x1", anchor: "marker:x1", markerId: "x1" }],
      },
    },
  };
  const srcMarkerX1 = ["//#region commentray:x1", "ok", "//#endregion commentray:x1"].join("\n");

  it("errors when a marker anchor does not resolve in the primary", () => {
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cr]: {
          sourcePath: "src/p.ts",
          commentrayPath: cr,
          blocks: [{ id: "missing", anchor: "marker:missing", markerId: "missing" }],
        },
      },
    };
    const src = "no markers here\n";
    const issues = validateMarkerRegionsAgainstIndexedSources(
      index,
      new Map([["src/p.ts", src]]),
      new Map([["src/p.ts", new Set<string>()]]),
    );
    expect(
      issues.some((i) => i.level === "error" && i.message.includes("no resolvable paired")),
    ).toBe(true);
  });

  it("warns when the primary has a paired region not claimed by any block", () => {
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cr]: {
          sourcePath: "src/p.ts",
          commentrayPath: cr,
          blocks: [{ id: "only", anchor: "marker:only", markerId: "only" }],
        },
      },
    };
    const src = [
      "//#region commentray:only",
      "a",
      "//#endregion commentray:only",
      "//#region commentray:orphan",
      "b",
      "//#endregion commentray:orphan",
    ].join("\n");
    const issues = validateMarkerRegionsAgainstIndexedSources(
      index,
      new Map([["src/p.ts", src]]),
      new Map([["src/p.ts", new Set(["only"])]]),
    );
    expect(
      issues.some(
        (i) =>
          i.level === "warn" &&
          i.message.includes("not referenced") &&
          i.message.includes("<!-- commentray:block id=orphan -->"),
      ),
    ).toBe(true);
  });

  it("returns no issues when every region is claimed and resolves", () => {
    expect(
      validateMarkerRegionsAgainstIndexedSources(
        indexMarkerX1,
        new Map([["src/p.ts", srcMarkerX1]]),
        new Map([["src/p.ts", new Set(["x1"])]]),
      ),
    ).toEqual([]);
  });

  it("warns when markdown omits a block marker but the index claims the marker", () => {
    const issues = validateMarkerRegionsAgainstIndexedSources(
      indexMarkerX1,
      new Map([["src/p.ts", srcMarkerX1]]),
      new Map([["src/p.ts", new Set<string>()]]),
    );
    expect(
      issues.some(
        (i) =>
          i.level === "warn" &&
          i.message.includes("not referenced") &&
          i.message.includes("indexed block uses anchor marker:x1"),
      ),
    ).toBe(true);
  });
});
