import { stat } from "node:fs/promises";
import path from "node:path";

import {
  commentrayAnglesLayoutEnabled,
  normalizeRepoRelativePath,
  resolvePathUnderRepoRoot,
} from "./paths.js";
import { collectMdRelPathsUnderSourceAbs } from "./walk-commentray-source-md.js";

export type DiskCommentrayPair = {
  sourcePath: string;
  commentrayPath: string;
};

/**
 * True when `sourcePath` resolves to a regular file under `repoRoot`.
 * Used so nav / browse never advertise pairs whose companion exists but the primary source is missing
 * (otherwise static browse emits URLs with no backing HTML).
 */
export async function commentrayPairSourceFileExistsOnDisk(
  repoRoot: string,
  sourcePath: string,
): Promise<boolean> {
  const rel = sourcePath.trim();
  if (rel.length === 0) return false;
  try {
    const st = await stat(resolvePathUnderRepoRoot(repoRoot, rel));
    return st.isFile();
  } catch {
    return false;
  }
}

/**
 * Maps a Markdown path relative to `{storage}/source/` to `(sourcePath, commentrayPath)` using
 * the same flat vs Angles rules as the rest of Commentray.
 */
export function pairFromCommentraySourceRel(
  storageDirNorm: string,
  relFromSourceDir: string,
  anglesOn: boolean,
): DiskCommentrayPair | null {
  const norm = relFromSourceDir.replaceAll("\\", "/");
  if (!norm.endsWith(".md") || norm === ".default" || norm.startsWith(".default/")) return null;
  const crPath = path.posix.join(storageDirNorm, "source", norm);
  if (!anglesOn) {
    return { sourcePath: norm.slice(0, Math.max(0, norm.length - 3)), commentrayPath: crPath };
  }
  const dir = path.posix.dirname(norm);
  const base = path.posix.basename(norm);
  const stem = base.slice(0, Math.max(0, base.length - 3));
  const angleStemValid = /^[a-zA-Z0-9_-]{1,64}$/.test(stem);
  if (dir !== "." && dir !== "" && angleStemValid) {
    return { sourcePath: dir, commentrayPath: crPath };
  }
  return { sourcePath: norm.slice(0, Math.max(0, norm.length - 3)), commentrayPath: crPath };
}

/**
 * Lists every `*.md` under `{storage}/source/` as source ↔ commentray path pairs (flat or Angles).
 */
export async function discoverCommentrayPairsOnDisk(
  repoRoot: string,
  storageDir = ".commentray",
): Promise<DiskCommentrayPair[]> {
  const storageNorm = normalizeRepoRelativePath(storageDir.replaceAll("\\", "/"));
  const sourceAbs = path.join(repoRoot, ...storageNorm.split("/"), "source");
  const anglesOn = commentrayAnglesLayoutEnabled(repoRoot, storageDir);
  let rels: string[];
  try {
    rels = await collectMdRelPathsUnderSourceAbs(sourceAbs);
  } catch {
    return [];
  }
  const out: DiskCommentrayPair[] = [];
  const seen = new Set<string>();
  for (const rel of rels) {
    const pair = pairFromCommentraySourceRel(storageNorm, rel, anglesOn);
    if (!pair || seen.has(pair.commentrayPath)) continue;
    if (!(await commentrayPairSourceFileExistsOnDisk(repoRoot, pair.sourcePath))) continue;
    seen.add(pair.commentrayPath);
    out.push(pair);
  }
  out.sort((a, b) => a.commentrayPath.localeCompare(b.commentrayPath));
  return out;
}
