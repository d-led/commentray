import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { tryBuildBlockStretchTableHtml } from "./block-stretch-layout.js";

const crPath = ".commentray/source/pkg/x.txt.md";

function tinyIndex() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [crPath]: {
        sourcePath: "pkg/x.txt",
        commentrayPath: crPath,
        blocks: [{ id: "b1", anchor: "lines:2-3" }],
      },
    },
  };
}

describe("Block-aligned stretch table HTML", () => {
  it("emits one blame-style row per block (no rowspan) so code and doc share row height", async () => {
    const md = "<!-- commentray:block id=b1 -->\n\n## Hi\n\nBody.\n";
    const out = await tryBuildBlockStretchTableHtml({
      code: "gap\na\nb",
      language: "txt",
      commentrayMarkdown: md,
      index: tinyIndex(),
      sourceRelative: "pkg/x.txt",
      commentrayPathRel: crPath,
    });
    expect(out).not.toBeNull();
    if (out === null) throw new Error("expected table");
    expect(out.tableInnerHtml).not.toContain("rowspan");
    expect(out.tableInnerHtml).toContain('class="stretch-code-stack"');
    expect(out.tableInnerHtml).toContain('id="code-line-1"');
    expect(out.tableInnerHtml).toContain('id="code-line-2"');
    expect((out.tableInnerHtml.match(/<tr /g) ?? []).length).toBe(2);
    expect((out.tableInnerHtml.match(/stretch-row--gap/g) ?? []).length).toBe(1);
    expect((out.tableInnerHtml.match(/stretch-row--block/g) ?? []).length).toBe(1);
  });

  it("emits gap rows for marker viewport lines before the inner source range", async () => {
    const markerCr = ".commentray/source/marker/readme.md.md";
    const src = ["pad", "# commentray:start id=aa", "[inner]", "# commentray:end id=aa"].join("\n");
    const md = "<!-- commentray:block id=aa -->\n\n## Doc\n";
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [markerCr]: {
          sourcePath: "marker/readme.md",
          commentrayPath: markerCr,
          blocks: [{ id: "aa", anchor: "marker:aa" }],
        },
      },
    };
    const out = await tryBuildBlockStretchTableHtml({
      code: src,
      language: "txt",
      commentrayMarkdown: md,
      index,
      sourceRelative: "marker/readme.md",
      commentrayPathRel: markerCr,
    });
    expect(out).not.toBeNull();
    if (out === null) throw new Error("expected table");
    /* pad + start marker are prefix gaps; inner is the block; end delimiter is an unmapped tail gap. */
    expect((out.tableInnerHtml.match(/stretch-row--gap/g) ?? []).length).toBe(3);
    expect((out.tableInnerHtml.match(/stretch-row--block/g) ?? []).length).toBe(1);
  });
});
