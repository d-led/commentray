import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import {
  buildBlockScrollLinks,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./scroll-sync.js";

const crPath = ".commentray/source/src/a.ts.md";
const index = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  byCommentrayPath: {
    [crPath]: {
      sourcePath: "src/a.ts",
      commentrayPath: crPath,
      blocks: [
        { id: "b1", anchor: "lines:1-5" },
        { id: "b2", anchor: "lines:20-25" },
      ],
    },
  },
};

const md =
  "<!-- commentray:block id=b1 -->\n## block 1\n\n" +
  "text\n\n" +
  "<!-- commentray:block id=b2 -->\n## block 2\n";

describe("buildBlockScrollLinks", () => {
  it("returns an empty list when there is no index entry", () => {
    expect(buildBlockScrollLinks(undefined, "src/a.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "missing.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "src/a.ts", ".commentray/source/other.md", md)).toEqual([]);
  });

  it("pairs markers in the markdown with line anchors from the index", () => {
    expect(buildBlockScrollLinks(index, "src/a.ts", crPath, md)).toEqual([
      { id: "b1", commentrayLine: 0, sourceStart: 1, sourceEnd: 5 },
      { id: "b2", commentrayLine: 5, sourceStart: 20, sourceEnd: 25 },
    ]);
  });

  it("resolves marker: anchors using Region Marker-style #region delimiters in source", () => {
    const idx = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [crPath]: {
          sourcePath: "src/a.ts",
          commentrayPath: crPath,
          blocks: [{ id: "b1", anchor: "marker:b1", markerId: "b1" }],
        },
      },
    };
    const source = ["//#region commentray:b1", "const x = 1;", "//#endregion commentray:b1"].join(
      "\n",
    );
    expect(buildBlockScrollLinks(idx, "src/a.ts", crPath, md, source)).toEqual([
      { id: "b1", commentrayLine: 0, sourceStart: 2, sourceEnd: 2 },
    ]);
  });
});

describe("pickCommentrayLineForSourceScroll", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("snaps to the block that contains the top source line", () => {
    expect(pickCommentrayLineForSourceScroll(blocks, 3)).toBe(0);
    expect(pickCommentrayLineForSourceScroll(blocks, 22)).toBe(5);
  });

  it("uses the nearest preceding block when the top line sits in a gap", () => {
    expect(pickCommentrayLineForSourceScroll(blocks, 10)).toBe(0);
  });

  it("uses the first block when the viewport is above every range", () => {
    expect(pickCommentrayLineForSourceScroll(blocks, 1)).toBe(0);
  });
});

describe("pickSourceLine0ForCommentrayScroll", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("reveals the start of the block whose marker is at or above the commentray top", () => {
    expect(pickSourceLine0ForCommentrayScroll(blocks, 0)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 3)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 4)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 5)).toBe(19);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 99)).toBe(19);
  });
});
