import { describe, expect, it } from "vitest";
import { buildCommentraySnippetV1 } from "./block-snippet.js";
import {
  addBlockToIndex,
  appendBlockToCommentray,
  createBlockForRange,
  generateBlockId,
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
