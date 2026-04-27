import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import {
  buildBlockScrollLinks,
  pickBlockScrollLinkForCommentrayScroll,
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

const linesViewport = (start: number, end: number) => ({
  lo: start,
  hiExclusive: end + 1,
});

const idxMarkerB1 = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  byCommentrayPath: {
    [crPath]: {
      sourcePath: "src/a.ts",
      commentrayPath: crPath,
      blocks: [{ id: "b1", anchor: "marker:b1", markerId: "b1" }],
    },
  },
};

const sourceMarkerB1Region = [
  "//#region commentray:b1",
  "const x = 1;",
  "//#endregion commentray:b1",
].join("\n");

describe("Block scroll link derivation from index and markers", () => {
  it("returns an empty list when there is no index entry", () => {
    expect(buildBlockScrollLinks(undefined, "src/a.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "missing.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "src/a.ts", ".commentray/source/other.md", md)).toEqual([]);
  });

  it("pairs markers in the markdown with line anchors from the index", () => {
    expect(buildBlockScrollLinks(index, "src/a.ts", crPath, md)).toEqual([
      {
        id: "b1",
        commentrayLine: 0,
        sourceStart: 1,
        sourceEnd: 5,
        markerViewportHalfOpen1Based: linesViewport(1, 5),
      },
      {
        id: "b2",
        commentrayLine: 5,
        sourceStart: 20,
        sourceEnd: 25,
        markerViewportHalfOpen1Based: linesViewport(20, 25),
      },
    ]);
  });

  it("returns no links when the index entry’s stored companion path disagrees with the lookup key", () => {
    const key = ".commentray/source/README.md/main.md";
    const mismatched: typeof index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [key]: {
          sourcePath: "src/a.ts",
          commentrayPath: ".commentray/source/README.md/architecture.md",
          blocks: [{ id: "b1", anchor: "lines:1-2" }],
        },
      },
    };
    const mdOne = "<!-- commentray:block id=b1 -->\n## x\n";
    expect(buildBlockScrollLinks(mismatched, "src/a.ts", key, mdOne)).toEqual([]);
  });

  it("resolves marker: anchors using Region Marker-style #region delimiters in source", () => {
    expect(
      buildBlockScrollLinks(idxMarkerB1, "src/a.ts", crPath, md, sourceMarkerB1Region),
    ).toEqual([
      {
        id: "b1",
        commentrayLine: 0,
        sourceStart: 2,
        sourceEnd: 2,
        markerViewportHalfOpen1Based: { lo: 1, hiExclusive: 3 },
      },
    ]);
  });
});

describe("Choosing a companion scroll position from a source viewport", () => {
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

describe("Marker viewport: prelude line and start delimiter belong to the next block", () => {
  const crToml = ".commentray/source/x.toml.md";
  const idxToml = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [crToml]: {
        sourcePath: "x.toml",
        commentrayPath: crToml,
        blocks: [
          { id: "scm", anchor: "marker:toml-scm", markerId: "toml-scm" },
          { id: "render", anchor: "marker:toml-render", markerId: "toml-render" },
        ],
      },
    },
  };
  const mdToml = "<!-- commentray:block id=scm -->\n\n" + "<!-- commentray:block id=render -->\n\n";
  const sourceToml = [
    "# commentray:start id=toml-scm",
    "[scm]",
    "x = 1",
    "# commentray:end id=toml-scm",
    "",
    "# commentray:start id=toml-render",
    "[render]",
    "y = 2",
    "# commentray:end id=toml-render",
  ].join("\n");

  it("maps the second block’s prelude line and start delimiter to the second companion", () => {
    const links = buildBlockScrollLinks(idxToml, "x.toml", crToml, mdToml, sourceToml);
    expect(links).toHaveLength(2);
    expect(pickCommentrayLineForSourceScroll(links, 6)).toBe(2);
    expect(pickCommentrayLineForSourceScroll(links, 7)).toBe(2);
  });
});

describe("pickBlockScrollLinkForCommentrayScroll", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("returns the same winning block implied by pickSourceLine0ForCommentrayScroll", () => {
    for (const top of [0, 3, 4, 5, 99]) {
      const link = pickBlockScrollLinkForCommentrayScroll(blocks, top);
      const src0 = pickSourceLine0ForCommentrayScroll(blocks, top);
      expect(link).not.toBeNull();
      if (link && src0 !== null) {
        expect(link.markerViewportHalfOpen1Based.lo - 1).toBe(src0);
      }
    }
  });
});

describe("Choosing a source line from a companion scroll position", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("reveals the start of the block whose marker is at or above the commentray top", () => {
    expect(pickSourceLine0ForCommentrayScroll(blocks, 0)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 3)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 4)).toBe(0);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 5)).toBe(19);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 99)).toBe(19);
  });
});

describe("Choosing source scroll for a marker block includes the delimiter prelude", () => {
  it("reveals the line above the inner body when the companion is at that block", () => {
    const blocks = buildBlockScrollLinks(idxMarkerB1, "src/a.ts", crPath, md, sourceMarkerB1Region);
    expect(pickSourceLine0ForCommentrayScroll(blocks, 0)).toBe(0);
  });
});
