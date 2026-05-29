import { describe, expect, it } from "vitest";
import { healSourceFile } from "./self-healing.js";
import { addBlockToIndex } from "./blocks.js";
import { emptyIndex } from "./metadata.js";
import { buildCommentraySnippetV1 } from "./block-snippet.js";

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

    let idx = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/main.ts",
      commentrayPath: "docs/main.md",
      block: { id: "xyz", anchor: "marker:xyz", snippet: buildCommentraySnippetV1(["console.log(1);"]) },
    });

    const result = healSourceFile({
      sourceText: src,
      languageId: "typescript",
      companionMarkdown: markdown,
      index: idx,
      commentrayPath: "docs/main.md",
    });

    expect(result.healedCount).toBe(0);
    expect(result.sourceText).toBe(src);
  });

  it("restores missing region markers when the snippet unique match is found in the source", () => {
    // region markers deleted in source
    const src = [
      "function main() {",
      "  console.log(1);",
      "}",
    ].join("\n");

    const markdown = [
      "<!-- commentray:block id=xyz -->",
      "## src/main.ts line 2",
      "",
      "prose",
      "",
    ].join("\n");

    let idx = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/main.ts",
      commentrayPath: "docs/main.md",
      block: { id: "xyz", anchor: "marker:xyz", snippet: buildCommentraySnippetV1(["console.log(1);"]) },
    });

    const result = healSourceFile({
      sourceText: src,
      languageId: "typescript",
      companionMarkdown: markdown,
      index: idx,
      commentrayPath: "docs/main.md",
    });

    expect(result.healedCount).toBe(1);
    expect(result.sourceText).toContain("//#region commentray:xyz");
    expect(result.sourceText).toContain("console.log(1);");
    expect(result.sourceText).toContain("//#endregion commentray:xyz");
  });

  it("does not heal a block if it is not present in index", () => {
    // source has no region, but companion markdown has block, but index does not have it
    const src = "console.log(1);";
    const markdown = "<!-- commentray:block id=xyz -->\n## x\n\nprose";
    const idx = emptyIndex();

    const result = healSourceFile({
      sourceText: src,
      languageId: "typescript",
      companionMarkdown: markdown,
      index: idx,
      commentrayPath: "docs/main.md",
    });

    expect(result.healedCount).toBe(0);
    expect(result.sourceText).toBe(src);
  });
});
