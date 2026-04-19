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
});
