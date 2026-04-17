import { describe, expect, it } from "vitest";
import {
  addBlockToIndex,
  appendBlockToCommentray,
  createBlockForRange,
  generateBlockId,
} from "./blocks.js";
import { emptyIndex } from "./metadata.js";
import type { CommentrayBlock } from "./model.js";

const SOURCE = ["export function greet(name) {", "  return `Hello, ${name}!`;", "}"].join("\n");

function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("createBlockForRange", () => {
  it("anchors the block to the selected 1-based range", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "fixed1",
    });
    expect(block.anchor).toBe("lines:1-3");
  });

  it("captures the first and last line content as a drift-resolution fingerprint", () => {
    const { block } = createBlockForRange({
      sourcePath: "src/greet.ts",
      sourceText: SOURCE,
      range: { startLine: 1, endLine: 3 },
      id: "fixed1",
    });
    expect(block.fingerprint).toEqual({
      startLine: "export function greet(name) {",
      endLine: "}",
      lineCount: 3,
    });
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
    expect(block.anchor).toBe("lines:2-3");
    expect(block.fingerprint?.lineCount).toBe(2);
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

describe("appendBlockToCommentray", () => {
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

describe("addBlockToIndex", () => {
  const block: CommentrayBlock = { id: "abc123", anchor: "lines:1-3" };

  it("creates the source entry lazily the first time a block is added", () => {
    const next = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      block,
    });
    expect(next.bySourceFile["src/greet.ts"]).toEqual({
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      blocks: [block],
    });
  });

  it("appends to an existing source entry without mutating the input index", () => {
    const base = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      block,
    });
    const next = addBlockToIndex(base, {
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      block: { id: "def456", anchor: "lines:10-20" },
    });
    expect(next.bySourceFile["src/greet.ts"]?.blocks.map((b) => b.id)).toEqual([
      "abc123",
      "def456",
    ]);
    expect(base.bySourceFile["src/greet.ts"]?.blocks.map((b) => b.id)).toEqual(["abc123"]);
  });

  it("refuses to overwrite a block whose id already exists", () => {
    const base = addBlockToIndex(emptyIndex(), {
      sourcePath: "src/greet.ts",
      commentrayPath: ".commentray/source/src/greet.ts.md",
      block,
    });
    expect(() =>
      addBlockToIndex(base, {
        sourcePath: "src/greet.ts",
        commentrayPath: ".commentray/source/src/greet.ts.md",
        block: { id: "abc123", anchor: "lines:5-7" },
      }),
    ).toThrowError(/already exists/);
  });
});

describe("generateBlockId", () => {
  it("returns a six-character lowercase alphanumeric id", () => {
    const id = generateBlockId(seeded([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
    expect(id).toMatch(/^[a-z0-9]{6}$/);
  });
});
