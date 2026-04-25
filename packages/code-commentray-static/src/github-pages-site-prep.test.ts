import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";

import { blockStretchRowsForDocumentedPair } from "./github-pages-site-prep.js";

describe("blockStretchRowsForDocumentedPair", () => {
  const cr = ".commentray/source/extra.ts/main.md";
  const index = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [cr]: {
        sourcePath: "extra.ts",
        commentrayPath: cr,
        blocks: [{ id: "b1", anchor: "lines:1-2" }],
      },
    },
  };

  it("returns undefined when the index is missing", () => {
    expect(blockStretchRowsForDocumentedPair(null, "extra.ts", cr)).toBeUndefined();
  });

  it("returns undefined when the source path does not match the index entry", () => {
    expect(blockStretchRowsForDocumentedPair(index, "other.ts", cr)).toBeUndefined();
  });

  it("returns wiring for a matching pair with blocks", () => {
    expect(blockStretchRowsForDocumentedPair(index, "extra.ts", cr)).toEqual({
      index,
      sourceRelative: "extra.ts",
      commentrayPathRel: cr,
    });
  });

  it("returns undefined when the commentray path is not a key in the index", () => {
    expect(
      blockStretchRowsForDocumentedPair(index, "extra.ts", ".commentray/source/extra.ts/other.md"),
    ).toBeUndefined();
  });

  it("returns undefined when the index entry has no blocks", () => {
    const emptyBlocks = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cr]: {
          sourcePath: "extra.ts",
          commentrayPath: cr,
          blocks: [],
        },
      },
    };
    expect(blockStretchRowsForDocumentedPair(emptyBlocks, "extra.ts", cr)).toBeUndefined();
  });
});
