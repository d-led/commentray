import { describe, expect, it } from "vitest";

import {
  buildBlockScrollLinks,
  CURRENT_SCHEMA_VERSION,
  pickCommentrayLineForSourceScroll as pickCoreCommentrayLine,
  pickSourceLine0ForCommentrayScroll as pickCoreSourceLine0,
} from "@commentray/core";

import {
  mirroredScrollTop,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./code-browser-scroll-sync.js";

const crPath = ".commentray/source/src/a.ts.md";
const parityIndex = {
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

const parityMd =
  "<!-- commentray:block id=b1 -->\n## block 1\n\n" +
  "text\n\n" +
  "<!-- commentray:block id=b2 -->\n## block 2\n";

describe("scroll picker parity with @commentray/core", () => {
  const links = buildBlockScrollLinks(parityIndex, "src/a.ts", crPath, parityMd);

  it("matches pickCommentrayLineForSourceScroll for representative viewport lines", () => {
    for (let line1 = 1; line1 <= 30; line1++) {
      expect(pickCommentrayLineForSourceScroll(links, line1)).toBe(
        pickCoreCommentrayLine(links, line1),
      );
    }
  });

  it("matches pickSourceLine0ForCommentrayScroll for representative doc lines", () => {
    for (let md0 = 0; md0 <= 12; md0++) {
      expect(pickSourceLine0ForCommentrayScroll(links, md0)).toBe(pickCoreSourceLine0(links, md0));
    }
  });
});

describe("mirroredScrollTop", () => {
  it("maps top and bottom of the source range to the target range", () => {
    expect(mirroredScrollTop(0, 1000, 400, 500, 400)).toBe(0);
    expect(mirroredScrollTop(600, 1000, 400, 500, 400)).toBe(100);
  });

  it("maps the midpoint proportionally", () => {
    expect(mirroredScrollTop(300, 1000, 400, 500, 400)).toBe(50);
  });

  it("returns 0 when the source pane has nothing to scroll", () => {
    expect(mirroredScrollTop(0, 400, 400, 900, 400)).toBe(0);
  });
});
