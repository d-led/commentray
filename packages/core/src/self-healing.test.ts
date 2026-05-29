import { describe, expect, it } from "vitest";
import { healSourceFile } from "./self-healing.js";
import { addBlockToIndex } from "./blocks.js";
import { emptyIndex } from "./metadata.js";
import { buildCommentraySnippetV1 } from "./block-snippet.js";

function createTestIndexWithBlock(id: string, lines: string[]) {
  return addBlockToIndex(emptyIndex(), {
    sourcePath: "src/main.ts",
    commentrayPath: "docs/main.md",
    block: {
      id,
      anchor: `marker:${id}`,
      snippet: buildCommentraySnippetV1(lines),
    },
  });
}

function runHeal(args: {
  sourceText: string;
  companionMarkdown: string;
  index: ReturnType<typeof emptyIndex>;
}) {
  return healSourceFile({
    sourceText: args.sourceText,
    languageId: "typescript",
    companionMarkdown: args.companionMarkdown,
    index: args.index,
    commentrayPath: "docs/main.md",
  });
}

describe("Self-healing source file regions", () => {
  it("returns original source text and index when no markers are missing", () => {
    const src = [
      "function main() {",
      "//#region commentray:xyz",
      "  console.log(1);",
      "//#endregion commentray:xyz",
      "}",
    ].join("\n");

    const markdown = [
      "<!-- commentray:block id=xyz -->",
      "## src/main.ts line 3",
      "",
      "prose",
      "",
    ].join("\n");

    const idx = createTestIndexWithBlock("xyz", ["console.log(1);"]);

    const result = runHeal({
      sourceText: src,
      companionMarkdown: markdown,
      index: idx,
    });

    expect(result.healedCount).toBe(0);
    expect(result.sourceText).toBe(src);
  });

  it("restores missing region markers when the snippet unique match is found in the source", () => {
    const src = ["function main() {", "  console.log(1);", "}"].join("\n");

    const markdown = [
      "<!-- commentray:block id=xyz -->",
      "## src/main.ts line 2",
      "",
      "prose",
      "",
    ].join("\n");

    const idx = createTestIndexWithBlock("xyz", ["console.log(1);"]);

    const result = runHeal({
      sourceText: src,
      companionMarkdown: markdown,
      index: idx,
    });

    expect(result.healedCount).toBe(1);
    expect(result.sourceText).toContain("//#region commentray:xyz");
    expect(result.sourceText).toContain("console.log(1);");
    expect(result.sourceText).toContain("//#endregion commentray:xyz");
  });

  it("does not heal a block if it is not present in index", () => {
    const src = "console.log(1);";
    const markdown = "<!-- commentray:block id=xyz -->\n## x\n\nprose";
    const idx = emptyIndex();

    const result = runHeal({
      sourceText: src,
      companionMarkdown: markdown,
      index: idx,
    });

    expect(result.healedCount).toBe(0);
    expect(result.sourceText).toBe(src);
  });
});
