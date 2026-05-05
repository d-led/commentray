import { pairFromCommentraySourceRel } from "./commentray-disk-pairs.js";
import { commentrayAnglesLayoutEnabled, normalizeRepoRelativePath } from "./paths.js";

/** `{storageDir}/source/` as used for repo-relative path checks (matches extension + `resolvePairedPaths`). */
export function commentrayStorageSourcePrefix(storageDir: string): string {
  const sd = storageDir.replaceAll("\\", "/");
  return `${sd}/source/`;
}

export type CommentrayActiveEditorUiFlags = {
  /** Active path is under `{storageDir}/source/`. */
  underCompanionSourceTree: boolean;
  /** Companion `.md` path maps to a primary source path (flat or Angles). */
  isResolvableCompanionMarkdown: boolean;
};

/**
 * Pure rules for VS Code `when` / `enablement`: which Commentray commands fit the active workspace file.
 *
 * @param normalizedRepoRelativePath — repo-relative path with `/` separators (e.g. from `normalizeRepoRelativePath`).
 */
export function commentrayActiveEditorUiFlags(input: {
  normalizedRepoRelativePath: string;
  storageDir: string;
  repoRoot: string;
  staticSiteCommentrayMarkdownFile?: string;
}): CommentrayActiveEditorUiFlags {
  const normalized = normalizeRepoRelativePath(
    input.normalizedRepoRelativePath.replaceAll("\\", "/"),
  );
  const configuredStaticCompanion = input.staticSiteCommentrayMarkdownFile
    ? normalizeRepoRelativePath(input.staticSiteCommentrayMarkdownFile.replaceAll("\\", "/"))
    : "";
  const sourcePrefix = commentrayStorageSourcePrefix(input.storageDir);
  if (!normalized.startsWith(sourcePrefix)) {
    if (
      configuredStaticCompanion.length > 0 &&
      normalized === configuredStaticCompanion &&
      normalized.endsWith(".md")
    ) {
      return { underCompanionSourceTree: true, isResolvableCompanionMarkdown: true };
    }
    return { underCompanionSourceTree: false, isResolvableCompanionMarkdown: false };
  }
  const relFromSourceDir = normalized.slice(sourcePrefix.length);
  const storageNorm = normalizeRepoRelativePath(input.storageDir.replaceAll("\\", "/"));
  const anglesOn = commentrayAnglesLayoutEnabled(input.repoRoot, input.storageDir);
  const pair = pairFromCommentraySourceRel(storageNorm, relFromSourceDir, anglesOn);
  return {
    underCompanionSourceTree: true,
    isResolvableCompanionMarkdown: Boolean(pair),
  };
}
