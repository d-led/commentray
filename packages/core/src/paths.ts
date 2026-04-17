import fs from "node:fs";
import path from "node:path";

import { assertValidAngleId } from "./angles.js";

/**
 * Normalize a repo-relative path to POSIX separators and reject anything that
 * would escape the repository root when joined with it.
 *
 * Rejects:
 *   - Windows drive letters (e.g. `C:\foo`).
 *   - `..` path segments, which would let a config value or CLI argument walk
 *     out of the repo root.
 *
 * Accepts filenames that merely *contain* dots like `..name.ts`; only whole
 * `..` segments are traversal.
 */
export function normalizeRepoRelativePath(relativePath: string): string {
  const posix = relativePath.replaceAll("\\", "/");
  if (/^[a-zA-Z]:\//.test(posix)) {
    throw new Error(`Path must be repository-relative (got absolute: ${relativePath})`);
  }
  const stripped = posix.replace(/^\/+/, "");
  const segments = stripped.split("/").filter((s) => s !== "" && s !== ".");
  if (segments.some((s) => s === "..")) {
    throw new Error(`Path escapes repository root: ${relativePath}`);
  }
  return segments.join("/");
}

/** Commentray Markdown path for a repo-relative source file (implicit default angle, flat layout). */
export function commentrayMarkdownPath(sourceRepoRelativePath: string): string {
  const normalized = normalizeRepoRelativePath(sourceRepoRelativePath);
  return path.posix.join(".commentray", "source", `${normalized}.md`);
}

/**
 * Repo-relative path to the **Angles sentinel**: if this path exists as a file or directory under
 * the storage root, the repository opts into per-source **Angles** layout (see `docs/spec/storage.md`).
 * When absent, the flat `{storage}/source/{P}.md` layout is the only supported shape.
 */
export function commentrayAnglesSentinelPath(storageDir = ".commentray"): string {
  const root = normalizeRepoRelativePath(storageDir.replaceAll("\\", "/"));
  return path.posix.join(root, "source", ".default");
}

/**
 * Returns true when the repository opts into **Angles** layout: `{storage}/source/.default` exists
 * (file or directory). When false, only the flat `{storage}/source/{P}.md` mapping applies.
 */
export function commentrayAnglesLayoutEnabled(
  repoRoot: string,
  storageDir = ".commentray",
): boolean {
  const sentinel = commentrayAnglesSentinelPath(storageDir);
  const absolute = path.join(repoRoot, ...sentinel.split("/"));
  return fs.existsSync(absolute);
}

/**
 * Repo-relative path to commentray for `sourceRepoRelativePath` at a named **Angle** (multi-angle layout).
 * Example: `README.md` + `architecture` → `.commentray/source/README.md/architecture.md` (with default storage dir).
 */
export function commentrayMarkdownPathForAngle(
  sourceRepoRelativePath: string,
  angleId: string,
  storageDir = ".commentray",
): string {
  const normalized = normalizeRepoRelativePath(sourceRepoRelativePath);
  const sid = assertValidAngleId(angleId);
  const root = normalizeRepoRelativePath(storageDir.replaceAll("\\", "/"));
  return path.posix.join(root, "source", normalized, `${sid}.md`);
}

/** Default metadata index location (repo-relative). */
export function defaultMetadataIndexPath(): string {
  return path.posix.join(".commentray", "metadata", "index.json");
}
