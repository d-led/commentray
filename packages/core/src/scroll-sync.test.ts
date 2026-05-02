import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, type CommentrayIndex } from "./model.js";
import {
  blockStrictlyContainingSourceViewportLine,
  buildBlockScrollLinks,
  commentrayProbeInStrictInterMarkerGap,
  pickBlockScrollLinkForCommentrayScroll,
  pickBlockScrollLinkForCommentrayViewportWithHysteresis,
  pickBlockScrollLinkForSourceViewportTop,
  pickBlockScrollLinkForSourceViewportWithHysteresis,
  pickCommentrayLineForSourceDualPane,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
  parseMarkdownHtmlCommentrayRegions,
  sourceTopLineStrictlyBeforeFirstIndexLine,
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

const fallbackAnglePath = ".commentray/source/README.md/architecture.md";
const fallbackAngleMarkdown =
  "<!-- commentray:block id=readme-lede -->\n\n" +
  "<!-- commentray:block id=readme-why -->\n\n" +
  "<!-- commentray:block id=readme-user-guides -->\n\n" +
  "<!-- commentray:block id=readme-mobile-flip-check -->\n";
const fallbackSourceMarkdown = [
  "<!-- #region commentray:readme-lede -->",
  "lede",
  "<!-- #endregion commentray:readme-lede -->",
  "",
  "<!-- #region commentray:readme-why -->",
  "why",
  "<!-- #endregion commentray:readme-why -->",
  "",
  "<!-- #region commentray:readme-user-guides -->",
  "guides",
  "<!-- #endregion commentray:readme-user-guides -->",
  "",
  "<!-- #region commentray:readme-mobile-flip-check -->",
  "flip",
  "<!-- #endregion commentray:readme-mobile-flip-check -->",
].join("\n");
const fallbackMarkerLinks = [
  {
    id: "readme-lede",
    commentrayLine: 0,
    sourceStart: 2,
    sourceEnd: 2,
    markerViewportHalfOpen1Based: { lo: 1, hiExclusive: 3 },
  },
  {
    id: "readme-why",
    commentrayLine: 2,
    sourceStart: 6,
    sourceEnd: 6,
    markerViewportHalfOpen1Based: { lo: 4, hiExclusive: 7 },
  },
  {
    id: "readme-user-guides",
    commentrayLine: 4,
    sourceStart: 10,
    sourceEnd: 10,
    markerViewportHalfOpen1Based: { lo: 8, hiExclusive: 11 },
  },
  {
    id: "readme-mobile-flip-check",
    commentrayLine: 6,
    sourceStart: 14,
    sourceEnd: 14,
    markerViewportHalfOpen1Based: { lo: 12, hiExclusive: 15 },
  },
];

describe("Block scroll link derivation from index and markers", () => {
  it("returns an empty list when there is no index entry", () => {
    expect(buildBlockScrollLinks(undefined, "src/a.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "missing.ts", crPath, md)).toEqual([]);
    expect(buildBlockScrollLinks(index, "src/a.ts", ".commentray/source/other.md", md)).toEqual([]);
  });

  it("falls back to marker-derived links when an angle has matching markers but no index entry", () => {
    expect(
      buildBlockScrollLinks(
        index,
        "README.md",
        fallbackAnglePath,
        fallbackAngleMarkdown,
        fallbackSourceMarkdown,
      ),
    ).toEqual(fallbackMarkerLinks);
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
    const mismatched: CommentrayIndex = {
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

describe("Markdown HTML commentray regions (synthetic scroll links)", () => {
  it("parses paired region / endregion spans in companion Markdown", () => {
    const md =
      "<!-- #region commentray:aa -->\nA\n<!-- #endregion commentray:aa -->\n" +
      "<!-- #region commentray:bb -->\nB\n<!-- #endregion commentray:bb -->\n";
    const regions = parseMarkdownHtmlCommentrayRegions(md);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ id: "aa", mdStartLine: 0, mdEndExclusive: 3 });
    expect(regions[1]).toMatchObject({ id: "bb", mdStartLine: 3, mdEndExclusive: 6 });
  });

  it("when there are no block markers but HTML regions exist, buildBlockScrollLinks yields weighted synthetic spans on the source file", () => {
    const md =
      "<!-- #region commentray:r1 -->\nX\n<!-- #endregion commentray:r1 -->\n" +
      "<!-- #region commentray:r2 -->\nY\n<!-- #endregion commentray:r2 -->\n";
    const src = Array.from({ length: 20 }, (_, i) => `L${i + 1}`).join("\n");
    const links = buildBlockScrollLinks(null, "x.ts", "y.md", md, src);
    expect(links).toHaveLength(2);
    const first = links[0];
    const second = links[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    expect(first.sourceStart).toBe(1);
    expect(second.sourceEnd).toBe(20);
    expect(first.sourceEnd + 1).toBe(second.sourceStart);
  });
});

describe("Dual-pane source → companion (gap proportional, intra-block body)", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);
  const mdLineCount = md.split("\n").length;

  it("uses gapFallback when the source top sits in a true gap between block spans", () => {
    expect(pickCommentrayLineForSourceDualPane(blocks, 10, mdLineCount, () => 42)).toBe(42);
  });

  it("maps strictly inside a block onto companion body lines instead of snapping to the marker head", () => {
    const line1 = pickCommentrayLineForSourceDualPane(blocks, 1, mdLineCount, () => -1);
    const line3 = pickCommentrayLineForSourceDualPane(blocks, 3, mdLineCount, () => -1);
    const line5 = pickCommentrayLineForSourceDualPane(blocks, 5, mdLineCount, () => -1);
    expect(line1).toBe(1);
    expect(line3).toBe(3);
    expect(line5).toBe(4);
  });

  it("when there are no blocks, always uses gapFallback", () => {
    expect(pickCommentrayLineForSourceDualPane([], 5, 20, () => 17)).toBe(17);
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

describe("Strict source containment and markdown gap probes", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("detects when the source top sits strictly inside a block span", () => {
    expect(blockStrictlyContainingSourceViewportLine(blocks, 3)?.id).toBe("b1");
    expect(blockStrictlyContainingSourceViewportLine(blocks, 10)).toBeNull();
    expect(blockStrictlyContainingSourceViewportLine(blocks, 22)?.id).toBe("b2");
  });

  it("detects prelude before the first block span", () => {
    expect(sourceTopLineStrictlyBeforeFirstIndexLine(blocks, 0)).toBe(true);
    expect(sourceTopLineStrictlyBeforeFirstIndexLine(blocks, 1)).toBe(false);
  });

  it("detects inter-marker companion gaps for doc-driven sync", () => {
    expect(commentrayProbeInStrictInterMarkerGap(blocks, 0)).toBe(false);
    expect(commentrayProbeInStrictInterMarkerGap(blocks, 3)).toBe(true);
    expect(commentrayProbeInStrictInterMarkerGap(blocks, 5)).toBe(false);
    expect(commentrayProbeInStrictInterMarkerGap(blocks, 99)).toBe(true);
  });
});

describe("Schmitt sticky block picks (boundary hysteresis)", () => {
  const blocks = buildBlockScrollLinks(index, "src/a.ts", crPath, md);

  it("keeps the prior source block until the viewport has moved far enough into the next block", () => {
    const state = { lockedId: null as string | null };
    expect(pickBlockScrollLinkForSourceViewportWithHysteresis(blocks, 10, state, 2)?.id).toBe("b1");
    expect(state.lockedId).toBe("b1");
    expect(pickBlockScrollLinkForSourceViewportWithHysteresis(blocks, 20, state, 2)?.id).toBe("b1");
    expect(pickBlockScrollLinkForSourceViewportWithHysteresis(blocks, 21, state, 2)?.id).toBe("b1");
    expect(pickBlockScrollLinkForSourceViewportWithHysteresis(blocks, 22, state, 2)?.id).toBe("b2");
    expect(state.lockedId).toBe("b2");
  });

  it("keeps the prior commentray block until the doc probe has moved far enough down the next block", () => {
    const state = { lockedId: null as string | null };
    expect(pickBlockScrollLinkForCommentrayViewportWithHysteresis(blocks, 0, state, 4)?.id).toBe(
      "b1",
    );
    expect(pickBlockScrollLinkForCommentrayViewportWithHysteresis(blocks, 5, state, 4)?.id).toBe(
      "b1",
    );
    expect(pickBlockScrollLinkForCommentrayViewportWithHysteresis(blocks, 8, state, 4)?.id).toBe(
      "b1",
    );
    expect(pickBlockScrollLinkForCommentrayViewportWithHysteresis(blocks, 9, state, 4)?.id).toBe(
      "b2",
    );
  });

  it("releases the lock when the naive winner is not cleanly separated (overlap / odd geometry)", () => {
    const state = { lockedId: "b1" as string | null };
    const one = blocks[0];
    const two = blocks[1];
    if (!one || !two) throw new Error("fixture");
    const weird: typeof blocks = [
      { ...one, markerViewportHalfOpen1Based: { lo: 1, hiExclusive: 25 } },
      { ...two, markerViewportHalfOpen1Based: { lo: 3, hiExclusive: 26 } },
    ];
    const topWhereNaiveIsB2 = 25;
    expect(pickBlockScrollLinkForSourceViewportTop(weird, topWhereNaiveIsB2)?.id).toBe("b2");
    const picked = pickBlockScrollLinkForSourceViewportWithHysteresis(
      weird,
      topWhereNaiveIsB2,
      state,
      2,
    );
    expect(picked?.id).toBe("b2");
    expect(state.lockedId).toBe("b2");
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
