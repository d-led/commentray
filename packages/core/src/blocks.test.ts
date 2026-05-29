import { describe, expect, it } from "vitest";
import { buildCommentraySnippetV1 } from "./block-snippet.js";
import {
  addBlockToIndex,
  alignAndCleanRegions,
  appendBlockToCommentray,
  createBlockForRange,
  generateBlockId,
  insertBlockBySourceMarkerOrder,
  removeBlockFromCommentray,
  removeBlockFromIndex,
  removeSourceMarkersFromText,
  wrapSourceLineRangeWithCommentrayMarkers,
} from "./blocks.js";
import { emptyIndex } from "./metadata.js";
import type { CommentrayBlock } from "./model.js";

const SOURCE = ["export function greet(name) {", "  return `Hello, ${name}!`;", "}"].join("\n");

function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("Wrapping a source line range with Commentray region delimiters", () => {
  it("uses HTML-style regions in Markdown like the repository README", () => {
    const src = ["# Title", "body", "tail"].join("\n");
    const { sourceText, innerRange } = wrapSourceLineRangeWithCommentrayMarkers({
      sourceText: src,
      range: { startLine: 2, endLine: 2 },
      languageId: "markdown",
      markerId: "readme-why",
    });
    expect(sourceText).toContain("<!-- #region commentray:readme-why -->");
    expect(sourceText).toContain("<!-- #endregion commentray:readme-why -->");
    expect(innerRange).toEqual({ startLine: 3, endLine: 3 });
  });

  it("uses hash line-comment markers in TOML (same pairing contract as README, different comment syntax)", () => {
    const src = ["[storage]", 'dir = "x"', "", "[scm]", "y = 1"].join("\n");
    const { sourceText, innerRange } = wrapSourceLineRangeWithCommentrayMarkers({
      sourceText: src,
      range: { startLine: 1, endLine: 2 },
      languageId: "toml",
      markerId: "toml-lede",
    });
    expect(sourceText).toContain("# commentray:start id=toml-lede");
    expect(sourceText).toContain("# commentray:end id=toml-lede");
    expect(innerRange).toEqual({ startLine: 2, endLine: 3 });
  });
});

describe("Creating a new documentation block for a source range", () => {
  it("anchors the block with a marker id tied to the block id (source regions use the same id)", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "fixed1",
    });
    expect(block.anchor).toBe("marker:fixed1");
    expect(block.markerId).toBe("fixed1");
  });

  it("stores a unified-diff-style snippet of trimmed source lines (not a JSON object)", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "fixed1",
    });
    expect(block.snippet).toBe(
      buildCommentraySnippetV1(["export function greet(name) {", "return `Hello, ${name}!`;", "}"]),
    );
  });

  it("recognises a single-line range and labels it as such in the heading", () => {
    const { markdown } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 2, endLine: 2 },
      id: "fixed1",
    });
    expect(markdown).toContain("## `src/greet.ts` line 2");
    expect(markdown).not.toContain("lines 2–2");
  });

  it("labels a multi-line range with an en dash", () => {
    const { markdown } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "fixed1",
    });
    expect(markdown).toContain("## `src/greet.ts` lines 1–3");
  });

  it("clamps an end line beyond the source to the final line", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 2, endLine: 999 },
      id: "fixed1",
    });
    expect(block.anchor).toBe("marker:fixed1");
    expect(block.snippet).toBe(buildCommentraySnippetV1(["return `Hello, ${name}!`;", "}"]));
  });

  it("emits an invisible id marker that renders to nothing in HTML", () => {
    const { block, markdown } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "abc123",
    });
    expect(markdown).toMatch(/^<!-- commentray:block id=abc123 -->\n/);
    expect(block.id).toBe("abc123");
  });

  it("places the caret on the placeholder paragraph so the author can start typing", () => {
    const { markdown, caretLineOffset } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "abc123",
    });
    const lines = markdown.split("\n");
    expect(lines[caretLineOffset]).toBe("_(write commentary here)_");
  });

  it("derives a deterministic id from the supplied rng", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 1 },
      rng: seeded([0, 0, 0, 0, 0, 0]),
    });
    expect(block.id).toBe("aaaaaa");
  });
});

describe("Appending a block into companion Markdown", () => {
  it("separates the new block from existing content with a blank line", () => {
    const existing = "# Commentray\n\n";
    const blockMd = "<!-- commentray:block id=abc -->\n## line 1\n\nbody\n";
    const next = appendBlockToCommentray(existing, blockMd);
    expect(next).toBe(`# Commentray\n\n${blockMd}`);
  });

  it("keeps a no-trailing-newline existing file intact and still separates", () => {
    const existing = "header without trailing newline";
    const blockMd = "<!-- commentray:block id=abc -->\n## line 1\n";
    const next = appendBlockToCommentray(existing, blockMd);
    expect(next).toBe(`header without trailing newline\n\n${blockMd}`);
  });

  it("handles an empty file by writing the block at the top", () => {
    const next = appendBlockToCommentray("", "<!-- commentray:block id=abc -->\n## x\n");
    expect(next).toBe("<!-- commentray:block id=abc -->\n## x\n");
  });
});

describe("Inserting a block by source marker order", () => {
  it("places a new block before the first companion section that maps after it in source", () => {
    const source = [
      "//#region commentray:a",
      "a",
      "//#endregion commentray:a",
      "//#region commentray:b",
      "b",
      "//#endregion commentray:b",
      "//#region commentray:c",
      "c",
      "//#endregion commentray:c",
    ].join("\n");
    const existing = [
      "<!-- commentray:block id=a -->",
      "## a",
      "",
      "A",
      "",
      "<!-- commentray:block id=c -->",
      "## c",
      "",
      "C",
      "",
    ].join("\n");
    const blockB = ["<!-- commentray:block id=b -->", "## b", "", "B", ""].join("\n");

    const next = insertBlockBySourceMarkerOrder({
      existingCommentray: existing,
      blockMarkdown: blockB,
      sourceText: source,
      markerId: "b",
    });

    const aPos = next.indexOf("<!-- commentray:block id=a -->");
    const bPos = next.indexOf("<!-- commentray:block id=b -->");
    const cPos = next.indexOf("<!-- commentray:block id=c -->");
    expect(aPos).toBeGreaterThanOrEqual(0);
    expect(bPos).toBeGreaterThan(aPos);
    expect(cPos).toBeGreaterThan(bPos);
  });

  it("falls back to append when marker id is missing from source order", () => {
    const source = ["//#region commentray:a", "a", "//#endregion commentray:a"].join("\n");
    const existing = "<!-- commentray:block id=a -->\n## a\n";
    const blockZ = "<!-- commentray:block id=z -->\n## z\n";

    const next = insertBlockBySourceMarkerOrder({
      existingCommentray: existing,
      blockMarkdown: blockZ,
      sourceText: source,
      markerId: "z",
    });

    expect(next).toBe(`${existing.trimEnd()}\n\n${blockZ}`);
  });

  it("uses first marker starts for ordering even when a prior region is temporarily unclosed", () => {
    const source = [
      "<!-- #region commentray:running -->",
      "running body",
      "<!-- #region commentray:unit -->",
      "unit body",
      "<!-- #endregion commentray:unit -->",
    ].join("\n");
    const existing = ["<!-- commentray:block id=unit -->", "## unit", "", "Unit text", ""].join(
      "\n",
    );
    const running = ["<!-- commentray:block id=running -->", "## running", "", "Run text", ""].join(
      "\n",
    );

    const next = insertBlockBySourceMarkerOrder({
      existingCommentray: existing,
      blockMarkdown: running,
      sourceText: source,
      markerId: "running",
    });

    const runningPos = next.indexOf("<!-- commentray:block id=running -->");
    const unitPos = next.indexOf("<!-- commentray:block id=unit -->");
    expect(runningPos).toBeGreaterThanOrEqual(0);
    expect(unitPos).toBeGreaterThan(runningPos);
  });
});

describe("Registering a block in the index", () => {
  const block: CommentrayBlock = { id: "abc123", anchor: "lines:1-3" };

  it("creates the source entry lazily the first time a block is added", () => {
    const next = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      block,
    });
    const cr = ".commentray/source/src/greet.ts.md";
    expect(next.byCommentrayPath[cr]).toEqual({
      sourcePath: "src/greet.ts",
      commentrayPath: cr,
      blocks: [block],
    });
  });

  it("appends to an existing source entry without mutating the input index", () => {
    const cr = ".commentray/source/src/greet.ts.md";
    const base = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: cr,
      block,
    });
    const next = addBlockToIndex(base, {
      sourcePath: "src/greet.ts",
      commentrayPath: cr,
      block: { id: "def456", anchor: "lines:10-20" },
    });
    expect(next.byCommentrayPath[cr]?.blocks.map((b) => b.id)).toEqual(["abc123", "def456"]);
    expect(base.byCommentrayPath[cr]?.blocks.map((b) => b.id)).toEqual(["abc123"]);
  });

  it("refuses to overwrite a block whose id already exists", () => {
    const cr = ".commentray/source/src/greet.ts.md";
    const base = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: cr,
      block,
    });
    expect(() =>
      addBlockToIndex(base, {
        sourcePath: "src/greet.ts",
        commentrayPath: cr,
        block: { id: "abc123", anchor: "lines:5-7" },
      }),
    ).toThrowError(/already exists/);
  });

  it("refuses the same commentrayPath indexed for a different source file", () => {
    const cr = ".commentray/source/x.md";
    const base = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/a.ts",
      commentrayPath: cr,
      block,
    });
    expect(() =>
      addBlockToIndex(base, {
        sourcePath: "src/other.ts",
        commentrayPath: cr,
        block: { id: "def456", anchor: "lines:1-2" },
      }),
    ).toThrow(/already indexed for/);
  });
});

describe("Generating stable block identifiers", () => {
  it("returns a six-character lowercase alphanumeric id", () => {
    const id = generateBlockId(seeded([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
    expect(id).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe("Removing a block from companion Markdown", () => {
  it("returns original text when the block ID does not exist", () => {
    const md = "<!-- commentray:block id=abc -->\n## src/x.ts line 1\n\nprose\n";
    const result = removeBlockFromCommentray(md, "nonexistent");
    expect(result).toBe(md);
  });

  it("removes the only block completely and returns the prelude only", () => {
    const md = "# Prelude Title\nIntro text\n\n<!-- commentray:block id=abc -->\n## src/x.ts line 1\n\nprose\n";
    const result = removeBlockFromCommentray(md, "abc");
    expect(result.trim()).toBe("# Prelude Title\nIntro text");
  });

  it("removes a block in the middle of other blocks, joining them cleanly", () => {
    const md = [
      "<!-- commentray:block id=a -->",
      "## src/x.ts line 1",
      "",
      "prose A",
      "",
      "<!-- commentray:block id=b -->",
      "## src/x.ts line 2",
      "",
      "prose B",
      "",
      "<!-- commentray:block id=c -->",
      "## src/x.ts line 3",
      "",
      "prose C",
      "",
    ].join("\n");

    const result = removeBlockFromCommentray(md, "b");

    expect(result).toContain("id=a");
    expect(result).not.toContain("id=b");
    expect(result).toContain("id=c");
    expect(result).toContain("prose A");
    expect(result).not.toContain("prose B");
    expect(result).toContain("prose C");
  });

  it("removes the last block, preserving the preceding block and its layout", () => {
    const md = [
      "<!-- commentray:block id=a -->",
      "## src/x.ts line 1",
      "",
      "prose A",
      "",
      "<!-- commentray:block id=b -->",
      "## src/x.ts line 2",
      "",
      "prose B",
      "",
    ].join("\n");

    const result = removeBlockFromCommentray(md, "b");

    expect(result.trim()).toBe([
      "<!-- commentray:block id=a -->",
      "## src/x.ts line 1",
      "",
      "prose A",
    ].join("\n"));
  });
});

describe("Removing source markers from source files", () => {
  it("returns unchanged text when the marker ID is not found", () => {
    const src = "function foo() {\n  return 1;\n}\n";
    const result = removeSourceMarkersFromText(src, "abc");
    expect(result).toBe(src);
  });

  it("removes starting and ending marker lines for the given ID", () => {
    const src = [
      "function foo() {",
      "//#region commentray:abc",
      "  console.log('hello');",
      "//#endregion commentray:abc",
      "}",
    ].join("\n");

    const result = removeSourceMarkersFromText(src, "abc");

    expect(result).toBe([
      "function foo() {",
      "  console.log('hello');",
      "}",
    ].join("\n"));
  });

  it("supports multiple comment styles", () => {
    const src = [
      "<!-- #region commentray:abc -->",
      "some markdown",
      "<!-- #endregion commentray:abc -->",
    ].join("\n");

    const result = removeSourceMarkersFromText(src, "abc");

    expect(result).toBe("some markdown");
  });
});

describe("Removing a block from the metadata index", () => {
  it("returns the exact same index when the path or block ID does not exist", () => {
    const base = emptyIndex();
    const result = removeBlockFromIndex(base, "nonexistent.md", "abc");
    expect(result).toBe(base);
  });

  it("removes only the specified block from the entry, keeping other blocks", () => {
    const cp = "docs/x.md";
    let idx = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/x.ts",
      commentrayPath: cp,
      block: { id: "a", anchor: "marker:a" },
    });
    idx = addBlockToIndex(idx, {
      sourcePath: "src/x.ts",
      commentrayPath: cp,
      block: { id: "b", anchor: "marker:b" },
    });

    const result = removeBlockFromIndex(idx, cp, "a");

    expect(result.byCommentrayPath[cp]?.blocks.map(b => b.id)).toEqual(["b"]);
  });

  it("removes the entire entry from byCommentrayPath when the last block is deleted", () => {
    const cp = "docs/x.md";
    const idx = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/x.ts",
      commentrayPath: cp,
      block: { id: "a", anchor: "marker:a" },
    });

    const result = removeBlockFromIndex(idx, cp, "a");

    expect(result.byCommentrayPath[cp]).toBeUndefined();
  });
});

describe("Aligning and cleaning regions across source, markdown, and index", () => {
  const sourceText = [
    "function main() {",
    "//#region commentray:first",
    "  console.log(1);",
    "//#endregion commentray:first",
    "  console.log(2);",
    "//#region commentray:second",
    "  console.log(3);",
    "//#endregion commentray:second",
    "}",
  ].join("\n");

  it("reorders markdown block segments and index blocks to match source region order", () => {
    // Markdown has "second" block first, and "first" block second
    const markdown = [
      "<!-- commentray:block id=second -->",
      "## src/main.ts line 7",
      "",
      "prose second",
      "",
      "<!-- commentray:block id=first -->",
      "## src/main.ts line 3",
      "",
      "prose first",
      "",
    ].join("\n");

    const baseIndex = {
      schemaVersion: 3,
      byCommentrayPath: {
        "docs/main.md": {
          sourcePath: "src/main.ts",
          commentrayPath: "docs/main.md",
          blocks: [
            { id: "second", anchor: "marker:second" },
            { id: "first", anchor: "marker:first" },
          ],
        },
      },
    };

    const { commentrayMarkdown, index } = alignAndCleanRegions({
      sourceText,
      commentrayMarkdown: markdown,
      index: baseIndex,
      commentrayPath: "docs/main.md",
      sourcePath: "src/main.ts",
    });

    // Verify markdown ordering
    const firstPos = commentrayMarkdown.indexOf("id=first");
    const secondPos = commentrayMarkdown.indexOf("id=second");
    expect(firstPos).toBeGreaterThan(-1);
    expect(secondPos).toBeGreaterThan(-1);
    expect(firstPos).toBeLessThan(secondPos);

    // Verify index ordering
    const entry = index.byCommentrayPath["docs/main.md"];
    expect(entry?.blocks.map(b => b.id)).toEqual(["first", "second"]);
  });

  it("creates placeholder blocks when a new region is added in source code", () => {
    // Companion Markdown has only the "first" block, but source has "first" and "second"
    const markdown = [
      "<!-- commentray:block id=first -->",
      "## src/main.ts line 3",
      "",
      "prose first",
      "",
    ].join("\n");

    const baseIndex = {
      schemaVersion: 3,
      byCommentrayPath: {
        "docs/main.md": {
          sourcePath: "src/main.ts",
          commentrayPath: "docs/main.md",
          blocks: [{ id: "first", anchor: "marker:first" }],
        },
      },
    };

    const { commentrayMarkdown, index } = alignAndCleanRegions({
      sourceText,
      commentrayMarkdown: markdown,
      index: baseIndex,
      commentrayPath: "docs/main.md",
      sourcePath: "src/main.ts",
    });

    expect(commentrayMarkdown).toContain("id=first");
    expect(commentrayMarkdown).toContain("id=second");
    expect(commentrayMarkdown).toContain("_(write commentary here)_");

    const entry = index.byCommentrayPath["docs/main.md"];
    expect(entry?.blocks.map(b => b.id)).toEqual(["first", "second"]);
    expect(entry?.blocks.find(b => b.id === "second")?.snippet).toContain("console.log(3)");
  });

  it("removes block sections and index entries when region markers are removed from source", () => {
    // Source code has only "first" (we pass a source text with only "first")
    const srcOnlyFirst = [
      "function main() {",
      "//#region commentray:first",
      "  console.log(1);",
      "//#endregion commentray:first",
      "}",
    ].join("\n");

    const markdown = [
      "<!-- commentray:block id=first -->",
      "## src/main.ts line 3",
      "",
      "prose first",
      "",
      "<!-- commentray:block id=second -->",
      "## src/main.ts line 7",
      "",
      "prose second",
      "",
    ].join("\n");

    const baseIndex = {
      schemaVersion: 3,
      byCommentrayPath: {
        "docs/main.md": {
          sourcePath: "src/main.ts",
          commentrayPath: "docs/main.md",
          blocks: [
            { id: "first", anchor: "marker:first" },
            { id: "second", anchor: "marker:second" },
          ],
        },
      },
    };

    const { commentrayMarkdown, index } = alignAndCleanRegions({
      sourceText: srcOnlyFirst,
      commentrayMarkdown: markdown,
      index: baseIndex,
      commentrayPath: "docs/main.md",
      sourcePath: "src/main.ts",
    });

    expect(commentrayMarkdown).toContain("id=first");
    expect(commentrayMarkdown).not.toContain("id=second");

    const entry = index.byCommentrayPath["docs/main.md"];
    expect(entry?.blocks.map(b => b.id)).toEqual(["first"]);
  });
});
