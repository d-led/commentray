import { assertValidAngleId } from "./angles.js";
import type { ResolvedCommentrayConfig } from "./config.js";
import type { CommentrayIndex, SourceFileIndexEntry } from "./model.js";
import type { ScmPathRename } from "./scm/scm-provider.js";
import {
  commentrayAnglesLayoutEnabled,
  commentrayMarkdownPath,
  commentrayMarkdownPathForAngle,
  normalizeRepoRelativePath,
} from "./paths.js";

export type { ScmPathRename as PathRename } from "./scm/scm-provider.js";

function applyExactPathRenames(
  repoRelativePath: string,
  renames: readonly ScmPathRename[],
): string {
  let p = normalizeRepoRelativePath(repoRelativePath);
  for (const { from, to } of renames) {
    if (p === from) p = to;
  }
  return p;
}

/**
 * When Angles layout is active, returns the angle id segment from a commentray path under
 * `{storage}/source/<sourcePath>/<angle>.md`, or null if the path does not match that shape.
 */
export function inferAngleIdFromCommentrayPath(
  commentrayPath: string,
  sourcePath: string,
  storageDir: string,
): string | null {
  const sd = normalizeRepoRelativePath(storageDir.replaceAll("\\", "/"));
  const src = normalizeRepoRelativePath(sourcePath);
  const prefix = `${sd}/source/${src}/`;
  if (!commentrayPath.startsWith(prefix)) return null;
  const rest = commentrayPath.slice(prefix.length);
  if (!rest.endsWith(".md")) return null;
  const id = rest.slice(0, -".md".length);
  return id.length > 0 ? id : null;
}

/**
 * Applies Git-style **full-path** renames to `index.json` entries:
 * - exact renames on `sourcePath` and `commentrayPath` (string equality),
 * - when `sourcePath` changes, recomputes `commentrayPath` from layout rules so companion paths stay paired.
 *
 * Renames should be sorted longest-`from` first by the caller; this function sorts defensively.
 */
export function applyPathRenamesToCommentrayIndex(
  index: CommentrayIndex,
  renames: readonly ScmPathRename[],
  repoRoot: string,
  config: ResolvedCommentrayConfig,
): { index: CommentrayIndex; changed: boolean } {
  const sorted = [...renames]
    .map((r) => ({
      from: normalizeRepoRelativePath(r.from),
      to: normalizeRepoRelativePath(r.to),
    }))
    .filter((r) => r.from !== r.to)
    .sort((a, b) => b.from.length - a.from.length);

  if (sorted.length === 0) return { index, changed: false };

  const anglesLayout = commentrayAnglesLayoutEnabled(repoRoot, config.storageDir);
  const next: Record<string, SourceFileIndexEntry> = {};
  let changed = false;

  for (const [, entry] of Object.entries(index.byCommentrayPath)) {
    const sp = applyExactPathRenames(entry.sourcePath, sorted);
    let cp = applyExactPathRenames(entry.commentrayPath, sorted);

    if (sp !== entry.sourcePath) {
      if (anglesLayout) {
        const angleId = inferAngleIdFromCommentrayPath(
          entry.commentrayPath,
          entry.sourcePath,
          config.storageDir,
        );
        if (angleId) {
          try {
            cp = commentrayMarkdownPathForAngle(sp, assertValidAngleId(angleId), config.storageDir);
          } catch {
            /* keep cp from exact renames if angle segment is not a valid id */
          }
        }
      } else {
        cp = commentrayMarkdownPath(sp, config.storageDir);
      }
    }

    const newEntry: SourceFileIndexEntry = {
      ...entry,
      sourcePath: sp,
      commentrayPath: cp,
    };

    if (sp !== entry.sourcePath || cp !== entry.commentrayPath) {
      changed = true;
    }

    if (next[cp]) {
      throw new Error(
        `After applying renames, two index entries map to the same commentrayPath "${cp}" ` +
          `(merge or fix renames before retrying).`,
      );
    }
    next[cp] = newEntry;
  }

  return {
    index: { schemaVersion: index.schemaVersion, byCommentrayPath: next },
    changed,
  };
}
