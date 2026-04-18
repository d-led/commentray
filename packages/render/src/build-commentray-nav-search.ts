import { readFile } from "node:fs/promises";
import path from "node:path";

import { readIndex } from "@commentray/core";

export const COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION = 1 as const;

/** One searchable unit for a future hub or external tooling — never primary source lines. */
export type CommentrayNavSearchRow =
  | { kind: "sourcePath"; sourcePath: string; commentrayPath: string }
  | { kind: "commentrayPath"; sourcePath: string; commentrayPath: string }
  | {
      kind: "commentrayLine";
      sourcePath: string;
      commentrayPath: string;
      line: number;
      text: string;
    };

export type CommentrayNavSearchDocument = {
  schemaVersion: typeof COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION;
  rows: CommentrayNavSearchRow[];
};

export type BuildCommentrayNavSearchFallback = {
  /** Repo-relative primary path (toolbar / manifest label). */
  sourcePath: string;
  /** Repo-relative commentray Markdown path. */
  commentrayPath: string;
  /** Absolute path to that Markdown file on disk. */
  markdownAbs: string;
};

async function appendPairRowsSync(
  rows: CommentrayNavSearchRow[],
  sourcePath: string,
  commentrayPath: string,
  markdownAbs: string,
): Promise<void> {
  rows.push({ kind: "sourcePath", sourcePath, commentrayPath });
  rows.push({ kind: "commentrayPath", sourcePath, commentrayPath });
  try {
    const md = await readFile(markdownAbs, "utf8");
    const lines = md.split("\n");
    for (let i = 0; i < lines.length; i++) {
      rows.push({ kind: "commentrayLine", sourcePath, commentrayPath, line: i, text: lines[i] });
    }
  } catch {
    /* keep path rows when the companion file is missing */
  }
}

/**
 * Builds a JSON-serialisable search corpus: **filenames / paths** plus **commentray Markdown lines**
 * for each indexed pair. Primary source file contents are intentionally omitted.
 */
export async function buildCommentrayNavSearchDocument(
  repoRoot: string,
  fallback?: BuildCommentrayNavSearchFallback,
): Promise<CommentrayNavSearchDocument> {
  const rows: CommentrayNavSearchRow[] = [];
  const idx = await readIndex(repoRoot);
  const fromIndex =
    idx !== null && Object.keys(idx.byCommentrayPath).length > 0
      ? Object.entries(idx.byCommentrayPath).sort(([a], [b]) => a.localeCompare(b))
      : [];

  if (fromIndex.length > 0) {
    for (const [crPath, entry] of fromIndex) {
      await appendPairRowsSync(rows, entry.sourcePath, crPath, path.join(repoRoot, crPath));
    }
    return { schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION, rows };
  }

  if (fallback !== undefined) {
    await appendPairRowsSync(
      rows,
      fallback.sourcePath,
      fallback.commentrayPath,
      fallback.markdownAbs,
    );
  }

  return { schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION, rows };
}
