import fs from "node:fs/promises";
import path from "node:path";

import { assertValidAngleId } from "./angles.js";
import type { CommentrayIndex, SourceFileIndexEntry } from "./model.js";
import {
  commentrayAnglesLayoutEnabled,
  commentrayMarkdownPathForAngle,
  normalizeRepoRelativePath,
} from "./paths.js";
import { collectMdRelPathsUnderSourceAbs } from "./walk-commentray-source-md.js";

export type FlatCompanionEntry = {
  /** Repo-relative path, e.g. `.commentray/source/README.md.md`. */
  flatCommentrayPath: string;
  /** Repo-relative primary source path, e.g. `README.md`. */
  sourcePath: string;
};

export type AnglesMigrationMove = {
  fromRepoRel: string;
  toRepoRel: string;
  sourcePath: string;
};

export type AnglesMigrationPlan = {
  moves: AnglesMigrationMove[];
  /** Old flat companion path → new angle Markdown path (repo-relative). */
  flatToAnglePath: Map<string, string>;
};

/**
 * Lists every flat-layout companion Markdown file under `{storage}/source/`.
 * Returns an empty list when Angles layout is already enabled (sentinel present).
 */
export async function discoverFlatCompanionMarkdownFiles(
  repoRoot: string,
  storageDir = ".commentray",
): Promise<FlatCompanionEntry[]> {
  if (commentrayAnglesLayoutEnabled(repoRoot, storageDir)) {
    return [];
  }
  const storageNorm = normalizeRepoRelativePath(storageDir.replaceAll("\\", "/"));
  const sourceAbs = path.join(repoRoot, ...storageNorm.split("/"), "source");
  let stat;
  try {
    stat = await fs.stat(sourceAbs);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) {
    return [];
  }

  const rels = await collectMdRelPathsUnderSourceAbs(sourceAbs);
  const out: FlatCompanionEntry[] = [];
  for (const rel of rels) {
    if (rel === ".default" || rel.startsWith(".default/")) continue;
    if (!rel.endsWith(".md")) continue;
    const sourcePath = flatRelToSourcePath(rel);
    const flatCommentrayPath = path.posix.join(storageNorm, "source", rel);
    out.push({ flatCommentrayPath, sourcePath });
  }
  out.sort((a, b) => a.flatCommentrayPath.localeCompare(b.flatCommentrayPath));
  return out;
}

/** `rel` is relative to `{storage}/source/` using `/` separators. */
export function flatRelToSourcePath(relFromSourceDir: string): string {
  if (!relFromSourceDir.endsWith(".md")) {
    throw new Error(`Expected *.md under source, got: ${relFromSourceDir}`);
  }
  return relFromSourceDir.slice(0, Math.max(0, relFromSourceDir.length - 3));
}

export function planAnglesMigrationFromCompanions(
  companions: FlatCompanionEntry[],
  angleId: string,
  storageDir: string,
): AnglesMigrationPlan {
  const id = assertValidAngleId(angleId);
  const moves: AnglesMigrationMove[] = [];
  const flatToAnglePath = new Map<string, string>();
  for (const c of companions) {
    const toRepoRel = commentrayMarkdownPathForAngle(c.sourcePath, id, storageDir);
    if (c.flatCommentrayPath === toRepoRel) continue;
    moves.push({
      fromRepoRel: c.flatCommentrayPath,
      toRepoRel: toRepoRel,
      sourcePath: c.sourcePath,
    });
    flatToAnglePath.set(c.flatCommentrayPath, toRepoRel);
  }
  return { moves, flatToAnglePath };
}

export function rewriteIndexKeysForAnglesMigration(
  index: CommentrayIndex,
  flatToAnglePath: Map<string, string>,
): CommentrayIndex {
  const next: Record<string, SourceFileIndexEntry> = {};
  for (const [k, entry] of Object.entries(index.byCommentrayPath)) {
    const newKey = flatToAnglePath.get(k) ?? k;
    next[newKey] = { ...entry, commentrayPath: newKey };
  }
  return { ...index, byCommentrayPath: next };
}
