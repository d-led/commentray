import path from "node:path";

/** Normalize repo-relative paths to POSIX-style for storage keys. */
export function normalizeRepoRelativePath(relativePath: string): string {
  const trimmed = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error(`Path escapes repository root: ${relativePath}`);
  }
  return trimmed;
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
