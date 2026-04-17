import { buildCommentraySnippetV1 } from "./block-snippet.js";
import { formatMarkerAnchor } from "./anchors.js";
import type { CommentrayBlock, CommentrayIndex, SourceFileIndexEntry } from "./model.js";

/** 1-based inclusive range of source lines a block points to. */
export type BlockRange = {
  startLine: number;
  endLine: number;
};

export type CreateBlockForRangeInput = {
  /**
   * Repo-relative path to the primary source file. Shown in the block's
   * heading so readers can see where the range lives without leaving the
   * commentary pane.
   */
  sourcePath: string;
  /** Full source text (lines separated by `\n`). */
  sourceText: string;
  /** Selected range to anchor the block to. */
  range: BlockRange;
  /** Optional explicit id; one is generated when omitted. */
  id?: string;
  /** Seam for deterministic tests. Default: `Math.random`. */
  rng?: () => number;
};

export type CreatedBlock = {
  block: CommentrayBlock;
  /**
   * Markdown fragment to append to the commentray file. Starts with the
   * invisible `<!-- commentray:block ... -->` marker and ends with a
   * trailing newline so subsequent appends stay separated.
   */
  markdown: string;
  /**
   * 0-based line offset within `markdown` where the author's caret should
   * land after insertion — the placeholder line ready to be overwritten.
   */
  caretLineOffset: number;
};

const BLOCK_MARKER_PREFIX = "<!-- commentray:block id=";
const BLOCK_MARKER_SUFFIX = " -->";
const CARET_PLACEHOLDER = "_(write commentary here)_";

/**
 * Create a block (domain entity) together with the Markdown fragment that
 * carries it in the commentary file. Pure: no I/O, deterministic when a
 * fixed `rng` and `id` are supplied.
 */
export function createBlockForRange(input: CreateBlockForRangeInput): CreatedBlock {
  const range = clampRange(input.range, input.sourceText);
  const id = input.id ?? generateBlockId(input.rng);
  const anchor = formatMarkerAnchor(id);
  const snippet = snippetFromRange(input.sourceText, range);
  const block: CommentrayBlock = { id, anchor, markerId: id, snippet };
  const markdown = renderBlockMarkdown({ block, sourcePath: input.sourcePath, range });
  const caretLineOffset = placeholderLineOffset(markdown);
  return { block, markdown, caretLineOffset };
}

/**
 * Append `blockMarkdown` to existing commentary content, guaranteeing a
 * single blank-line separator regardless of how the existing content ended.
 */
export function appendBlockToCommentray(existing: string, blockMarkdown: string): string {
  const trimmed = existing.replace(/\s+$/, "");
  const body = trimmed.length === 0 ? "" : `${trimmed}\n\n`;
  const fragment = blockMarkdown.endsWith("\n") ? blockMarkdown : `${blockMarkdown}\n`;
  return `${body}${fragment}`;
}

export type AddBlockToIndexInput = {
  sourcePath: string;
  commentrayPath: string;
  block: CommentrayBlock;
};

/**
 * Return a new index with the block added under the given source file.
 * The source entry is created lazily when it does not exist yet. Throws
 * when the block id already exists under that source so callers cannot
 * silently corrupt the index.
 */
export function addBlockToIndex(
  index: CommentrayIndex,
  input: AddBlockToIndexInput,
): CommentrayIndex {
  const key = input.commentrayPath;
  const existing = index.byCommentrayPath[key];
  if (existing && existing.sourcePath !== input.sourcePath) {
    throw new Error(
      `commentrayPath ${key} is already indexed for ${existing.sourcePath}, not ${input.sourcePath}`,
    );
  }
  const previousBlocks = existing?.blocks ?? [];
  if (previousBlocks.some((b) => b.id === input.block.id)) {
    throw new Error(
      `block id ${input.block.id} already exists under ${key}; choose a different id`,
    );
  }
  const nextEntry: SourceFileIndexEntry = {
    sourcePath: input.sourcePath,
    commentrayPath: input.commentrayPath,
    blocks: [...previousBlocks, input.block],
  };
  return {
    schemaVersion: index.schemaVersion,
    byCommentrayPath: { ...index.byCommentrayPath, [key]: nextEntry },
  };
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 6;

/**
 * Six-character base-36 id. Alphabet excludes uppercase so ids are case-
 * insensitive-safe on filesystems and URLs. Collision space ≈ 2 billion,
 * comfortably larger than any plausible per-file block count.
 */
export function generateBlockId(rng: () => number = Math.random): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(rng() * ID_ALPHABET.length)];
  }
  return id;
}

function clampRange(range: BlockRange, sourceText: string): BlockRange {
  const lineCount = Math.max(1, sourceText.split("\n").length);
  const start = Math.max(1, Math.min(Math.floor(range.startLine), lineCount));
  const endRaw = Math.max(start, Math.floor(range.endLine));
  const end = Math.min(endRaw, lineCount);
  return { startLine: start, endLine: end };
}

function snippetFromRange(sourceText: string, range: BlockRange): string {
  const lines = sourceText.split("\n");
  const trimmed: string[] = [];
  for (let ln = range.startLine; ln <= range.endLine; ln++) {
    trimmed.push((lines[ln - 1] ?? "").trim());
  }
  return buildCommentraySnippetV1(trimmed);
}

function renderBlockMarkdown(args: {
  block: CommentrayBlock;
  sourcePath: string;
  range: BlockRange;
}): string {
  const marker = `${BLOCK_MARKER_PREFIX}${args.block.id}${BLOCK_MARKER_SUFFIX}`;
  const heading = `## \`${args.sourcePath}\` ${rangeLabel(args.range)}`;
  return `${marker}\n${heading}\n\n${CARET_PLACEHOLDER}\n`;
}

function rangeLabel(range: BlockRange): string {
  if (range.startLine === range.endLine) return `line ${range.startLine}`;
  return `lines ${range.startLine}–${range.endLine}`;
}

function placeholderLineOffset(markdown: string): number {
  const lines = markdown.split("\n");
  return Math.max(0, lines.indexOf(CARET_PLACEHOLDER));
}
