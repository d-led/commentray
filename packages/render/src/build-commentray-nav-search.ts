import { readFile } from "node:fs/promises";
import path from "node:path";

import { discoverCommentrayPairsOnDisk, githubRepoBlobFileUrl, readIndex } from "@commentray/core";

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

function mergeNavSearchPairs(
  indexPairs: { commentrayPath: string; sourcePath: string }[],
  diskPairs: { commentrayPath: string; sourcePath: string }[],
  fallback?: BuildCommentrayNavSearchFallback,
): { sourcePath: string; commentrayPath: string }[] {
  const byCr = new Map<string, { sourcePath: string; commentrayPath: string }>();
  for (const p of diskPairs) {
    byCr.set(p.commentrayPath, { sourcePath: p.sourcePath, commentrayPath: p.commentrayPath });
  }
  for (const e of indexPairs) {
    byCr.set(e.commentrayPath, { sourcePath: e.sourcePath, commentrayPath: e.commentrayPath });
  }
  if (fallback !== undefined) {
    const fp = {
      sourcePath: fallback.sourcePath,
      commentrayPath: fallback.commentrayPath,
    };
    if (!byCr.has(fp.commentrayPath)) {
      byCr.set(fp.commentrayPath, fp);
    }
  }
  return [...byCr.values()].sort((a, b) => a.commentrayPath.localeCompare(b.commentrayPath));
}

function markdownAbsForMergedPair(
  repoRoot: string,
  pair: { sourcePath: string; commentrayPath: string },
  fallback?: BuildCommentrayNavSearchFallback,
): string {
  if (
    fallback !== undefined &&
    pair.commentrayPath === fallback.commentrayPath &&
    pair.sourcePath === fallback.sourcePath
  ) {
    return fallback.markdownAbs;
  }
  return path.join(repoRoot, pair.commentrayPath);
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
 *
 * Pairs are merged from the metadata index, a walk of the configured storage `source` tree for
 * every `*.md` companion (flat or Angles layout), and an optional single-page `fallback`. For the
 * same `commentrayPath`, the index wins over disk-inferred paths.
 */
export async function buildCommentrayNavSearchDocument(
  repoRoot: string,
  fallback?: BuildCommentrayNavSearchFallback,
  githubBlobBase?: BuildCommentrayNavSearchGithubBlobBase,
  storageDir = ".commentray",
): Promise<CommentrayNavSearchDocument> {
  const rows: CommentrayNavSearchRow[] = [];
  const idx = await readIndex(repoRoot);
  const indexPairs =
    idx !== null && Object.keys(idx.byCommentrayPath).length > 0
      ? Object.entries(idx.byCommentrayPath).map(([crPath, e]) => ({
          commentrayPath: crPath,
          sourcePath: e.sourcePath,
        }))
      : [];

  const diskPairs = await discoverCommentrayPairsOnDisk(repoRoot, storageDir);
  const merged = mergeNavSearchPairs(indexPairs, diskPairs, fallback);

  if (merged.length === 0) {
    return { schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION, rows };
  }

  for (const p of merged) {
    await appendPairRowsSync(
      rows,
      p.sourcePath,
      p.commentrayPath,
      markdownAbsForMergedPair(repoRoot, p, fallback),
    );
  }

  const documentedPairs =
    githubBlobBase !== undefined ? buildDocumentedPairs(merged, githubBlobBase) : undefined;

  return {
    schemaVersion: COMMENTRAY_NAV_SEARCH_SCHEMA_VERSION,
    rows,
    ...(documentedPairs ? { documentedPairs } : {}),
  };
}
