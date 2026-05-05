import fs from "node:fs/promises";
import path from "node:path";

import { loadCommentrayConfig } from "./config.js";
import { emptyIndex } from "./metadata.js";
import type { SourceFileIndexEntry } from "./model.js";
import { resolveCommentrayMarkdownPath } from "./commentray-path-resolution.js";
import { normalizeRepoRelativePath } from "./paths.js";
import { readIndex, writeIndex } from "./validate-project.js";

export type EnsureCompanionForSourceOptions = {
  angleId?: string | null;
  initialMarkdown?: string;
  commentrayPath?: string;
};

export type EnsureCompanionForSourceResult = {
  sourcePath: string;
  commentrayPath: string;
  createdMarkdown: boolean;
  createdIndexEntry: boolean;
};

export function companionPlaceholderMarkdown(sourcePath?: string): string {
  const normalized = sourcePath?.trim();
  if (!normalized) return "# Commentray\n\n";
  return `# ${normalized}\n\nWrite documentation for ${normalized} here.\n`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function ensureEntryMatchesSource(entry: SourceFileIndexEntry, sourcePath: string): void {
  const existing = normalizeRepoRelativePath(entry.sourcePath);
  const requested = normalizeRepoRelativePath(sourcePath);
  if (existing !== requested) {
    throw new Error(
      `commentray path ${entry.commentrayPath} is already indexed for ${entry.sourcePath}, not ${sourcePath}`,
    );
  }
}

export async function ensureCompanionForSource(
  repoRoot: string,
  sourcePath: string,
  opts: EnsureCompanionForSourceOptions = {},
): Promise<EnsureCompanionForSourceResult> {
  const cfg = await loadCommentrayConfig(repoRoot);
  const normalizedSourcePath = normalizeRepoRelativePath(sourcePath.replaceAll("\\", "/"));
  const explicitCommentrayPath = opts.commentrayPath?.trim();
  const commentrayPath =
    explicitCommentrayPath && explicitCommentrayPath.length > 0
      ? normalizeRepoRelativePath(explicitCommentrayPath.replaceAll("\\", "/"))
      : resolveCommentrayMarkdownPath(
          repoRoot,
          normalizedSourcePath,
          cfg,
          opts.angleId ?? undefined,
        ).commentrayPath;
  const mdAbs = path.resolve(repoRoot, commentrayPath);

  let createdMarkdown = false;
  if (!(await pathExists(mdAbs))) {
    await fs.mkdir(path.dirname(mdAbs), { recursive: true });
    await fs.writeFile(
      mdAbs,
      opts.initialMarkdown ?? companionPlaceholderMarkdown(normalizedSourcePath),
      "utf8",
    );
    createdMarkdown = true;
  }

  let index = (await readIndex(repoRoot)) ?? emptyIndex();
  const existing = index.byCommentrayPath[commentrayPath];
  let createdIndexEntry = false;
  if (!existing) {
    index = {
      ...index,
      byCommentrayPath: {
        ...index.byCommentrayPath,
        [commentrayPath]: {
          sourcePath: normalizedSourcePath,
          commentrayPath,
          blocks: [],
        },
      },
    };
    await writeIndex(repoRoot, index);
    createdIndexEntry = true;
  } else {
    ensureEntryMatchesSource(existing, normalizedSourcePath);
  }

  return {
    sourcePath: normalizedSourcePath,
    commentrayPath,
    createdMarkdown,
    createdIndexEntry,
  };
}
