import type { ResolvedCommentrayConfig } from "./config.js";
import { assertValidAngleId } from "./angles.js";
import {
  commentrayAnglesLayoutEnabled,
  commentrayMarkdownPath,
  commentrayMarkdownPathForAngle,
} from "./paths.js";

/**
 * When Angles layout is on and the user has not configured a default, tools pick this id so a
 * concrete file path exists (`…/main.md`). Authors may rename via `[angles]` in `.commentray.toml`.
 */
export const FALLBACK_DEFAULT_ANGLE_ID = "main" as const;

export function defaultAngleIdForOpen(config: ResolvedCommentrayConfig): string {
  if (config.angles.defaultAngleId) return config.angles.defaultAngleId;
  const first = config.angles.definitions[0];
  if (first) return first.id;
  return FALLBACK_DEFAULT_ANGLE_ID;
}

export type ResolvedCommentrayMarkdownPath = {
  /** Repo-relative path to the paired `.md` file. */
  commentrayPath: string;
  /** Present when `{storage}/source/.default` exists (Angles layout). */
  angleId: string | null;
  anglesLayout: boolean;
};

/**
 * Resolves the commentray Markdown path for a primary source file, honoring Angles layout and
 * optional explicit `angleId` (when Angles layout is active).
 */
export function resolveCommentrayMarkdownPath(
  repoRoot: string,
  sourceRepoRelativePath: string,
  config: ResolvedCommentrayConfig,
  angleId?: string | null,
): ResolvedCommentrayMarkdownPath {
  const anglesLayout = commentrayAnglesLayoutEnabled(repoRoot, config.storageDir);
  if (!anglesLayout) {
    return {
      commentrayPath: commentrayMarkdownPath(sourceRepoRelativePath),
      angleId: null,
      anglesLayout: false,
    };
  }
  const id =
    angleId !== undefined && angleId !== null && String(angleId).trim() !== ""
      ? assertValidAngleId(String(angleId))
      : defaultAngleIdForOpen(config);
  return {
    commentrayPath: commentrayMarkdownPathForAngle(sourceRepoRelativePath, id, config.storageDir),
    angleId: id,
    anglesLayout: true,
  };
}
