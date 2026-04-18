import { readFile } from "node:fs/promises";
import path from "node:path";

import { githubRepoBlobFileUrl, readIndex } from "@commentray/core";

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

/** One indexed source ↔ commentray pair with absolute GitHub blob links for static hub pages. */
export type DocumentedPairNav = {
  sourcePath: string;
  commentrayPath: string;
  sourceOnGithub: string;
  commentrayOnGithub: string;
};

export type CommentrayNavSearchDocument = {
  schemaVersion: typeof COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION;
  rows: CommentrayNavSearchRow[];
  /** Present when `githubBlobBase` was passed to the builder — drives the documented-files tree. */
  documentedPairs?: DocumentedPairNav[];
};

export type BuildCommentrayNavSearchFallback = {
  /** Repo-relative primary path (toolbar / manifest label). */
  sourcePath: string;
  /** Repo-relative commentray Markdown path. */
  commentrayPath: string;
  /** Absolute path to that Markdown file on disk. */
  markdownAbs: string;
};

export type BuildCommentrayNavSearchGithubBlobBase = {
  owner: string;
  repo: string;
  branch: string;
};

function buildDocumentedPairs(
  pairs: { sourcePath: string; commentrayPath: string }[],
  gh: BuildCommentrayNavSearchGithubBlobBase,
): DocumentedPairNav[] {
  const { owner, repo, branch } = gh;
  const uniq = new Map<string, DocumentedPairNav>();
  for (const { sourcePath, commentrayPath } of pairs) {
    const key = `${sourcePath}\0${commentrayPath}`;
    if (uniq.has(key)) continue;
    uniq.set(key, {
      sourcePath,
      commentrayPath,
      sourceOnGithub: githubRepoBlobFileUrl(owner, repo, branch, sourcePath),
      commentrayOnGithub: githubRepoBlobFileUrl(owner, repo, branch, commentrayPath),
    });
  }
  return [...uniq.values()].sort((a, b) =>
    a.sourcePath === b.sourcePath
      ? a.commentrayPath.localeCompare(b.commentrayPath)
      : a.sourcePath.localeCompare(b.sourcePath),
  );
}

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
 *
 * When `githubBlobBase` is set, `documentedPairs` lists every pair with GitHub **blob** URLs for
 * the static hub tree and outbound links.
 */
export async function buildCommentrayNavSearchDocument(
  repoRoot: string,
  fallback?: BuildCommentrayNavSearchFallback,
  githubBlobBase?: BuildCommentrayNavSearchGithubBlobBase,
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
    const pairInputs = fromIndex.map(([, e]) => ({
      sourcePath: e.sourcePath,
      commentrayPath: e.commentrayPath,
    }));
    const documentedPairs = githubBlobBase
      ? buildDocumentedPairs(pairInputs, githubBlobBase)
      : undefined;
    return {
      schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION,
      rows,
      ...(documentedPairs ? { documentedPairs } : {}),
    };
  }

  if (fallback !== undefined) {
    await appendPairRowsSync(
      rows,
      fallback.sourcePath,
      fallback.commentrayPath,
      fallback.markdownAbs,
    );
  }

  const documentedPairs =
    githubBlobBase && fallback !== undefined
      ? buildDocumentedPairs(
          [{ sourcePath: fallback.sourcePath, commentrayPath: fallback.commentrayPath }],
          githubBlobBase,
        )
      : undefined;

  return {
    schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION,
    rows,
    ...(documentedPairs ? { documentedPairs } : {}),
  };
}
