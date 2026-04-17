import path from "node:path";

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

/** Commentray Markdown path for a repo-relative source file. */
export function commentrayMarkdownPath(sourceRepoRelativePath: string): string {
  const normalized = normalizeRepoRelativePath(sourceRepoRelativePath);
  return path.posix.join(".commentray", "source", `${normalized}.md`);
}

/** Default metadata index location (repo-relative). */
export function defaultMetadataIndexPath(): string {
  return path.posix.join(".commentray", "metadata", "index.json");
}
