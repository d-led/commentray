import fs from "node:fs/promises";
import path from "node:path";
import { type ResolvedCommentrayConfig, loadCommentrayConfig } from "./config.js";
import { parseGithubRepoWebUrl } from "./github-url.js";
import { assertValidIndex } from "./metadata.js";
import { defaultMetadataIndexPath } from "./paths.js";
import type { CommentrayIndex } from "./model.js";

export type ValidationIssue = { level: "error" | "warn"; message: string };

export type ValidationResult = {
  issues: ValidationIssue[];
};

export async function validateProject(repoRoot: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let config: ResolvedCommentrayConfig;
  try {
    config = await loadCommentrayConfig(repoRoot);
  } catch (err) {
    issues.push({
      level: "error",
      message: `Failed to load .commentray.toml: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { issues };
  }

  const storageAbs = path.join(repoRoot, config.storageDir);
  for (const sub of ["source", "metadata"]) {
    const p = path.join(storageAbs, sub);
    try {
      await fs.stat(p);
    } catch {
      issues.push({
        level: "warn",
        message: `Missing directory: ${path.join(config.storageDir, sub)}`,
      });
    }
  }

  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    assertValidIndex(JSON.parse(raw) as unknown);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      issues.push({ level: "warn", message: `No metadata index at ${defaultMetadataIndexPath()}` });
    } else {
      issues.push({
        level: "error",
        message: `Invalid metadata index: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  pushRelativeGithubLinkConfigWarnings(config, issues);

  return { issues };
}

function pushRelativeGithubLinkConfigWarnings(
  config: ResolvedCommentrayConfig,
  issues: ValidationIssue[],
): void {
  if (!config.render.relativeGithubBlobLinks) return;
  const gh = config.staticSite.githubUrl;
  if (gh && parseGithubRepoWebUrl(gh)) return;
  issues.push({
    level: "warn",
    message:
      "render.relative_github_blob_links is true but static_site.github_url is missing or " +
      "not a repository home URL (expected https://github.com/owner/repo). Link rewriting is skipped at build time.",
  });
}

export async function readIndex(repoRoot: string): Promise<CommentrayIndex | null> {
  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return assertValidIndex(JSON.parse(raw) as unknown);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Write the metadata index to the default location under `repoRoot`, creating
 * the `.commentray/metadata/` directory if missing. The file is written with
 * two-space indentation and a trailing newline so diffs are easy to read.
 */
export async function writeIndex(repoRoot: string, index: CommentrayIndex): Promise<void> {
  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  const serialized = `${JSON.stringify(index, null, 2)}\n`;
  await fs.writeFile(indexPath, serialized, "utf8");
}
