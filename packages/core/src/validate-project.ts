import fs from "node:fs/promises";
import path from "node:path";
import { type ResolvedCommentrayConfig, loadCommentrayConfig } from "./config.js";
import { parseGithubRepoWebUrl } from "./github-url.js";
import { normalizeCommentrayIndex } from "./index-normalize.js";
import { assertValidIndex } from "./metadata.js";
import { migrateIndex } from "./migrate.js";
import { defaultMetadataIndexPath } from "./paths.js";
import type { CommentrayIndex } from "./model.js";
import {
  validateIndexMarkerSemantics,
  validateMarkerBoundariesInSource,
} from "./marker-validation.js";

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

  let index: CommentrayIndex | null = null;
  try {
    index = await readIndex(repoRoot);
    if (index === null) {
      issues.push({ level: "warn", message: `No metadata index at ${defaultMetadataIndexPath()}` });
    }
  } catch (err) {
    issues.push({
      level: "error",
      message: `Invalid metadata index: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (index) {
    for (const issue of validateIndexMarkerSemantics(index)) {
      issues.push({ level: issue.level, message: issue.message });
    }
    const seenSources = new Set<string>();
    for (const entry of Object.values(index.byCommentrayPath)) {
      if (seenSources.has(entry.sourcePath)) continue;
      seenSources.add(entry.sourcePath);
      const abs = path.join(repoRoot, ...entry.sourcePath.split("/"));
      try {
        const text = await fs.readFile(abs, "utf8");
        for (const issue of validateMarkerBoundariesInSource(text, entry.sourcePath)) {
          issues.push({ level: issue.level, message: issue.message });
        }
      } catch {
        issues.push({
          level: "warn",
          message: `Could not read "${entry.sourcePath}" to validate Commentray source markers.`,
        });
      }
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

/**
 * Reads `index.json`, applies schema migration and snippet/fingerprint normalization,
 * and persists when anything changed. Throws if the file is missing or not valid JSON.
 */
export async function refreshIndexMigrationsOnDisk(
  repoRoot: string,
): Promise<{ index: CommentrayIndex; changed: boolean }> {
  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const { index: migrated, changed: schemaChanged } = migrateIndex(parsed);
  const { index: normalized, changed: snippetChanged } = normalizeCommentrayIndex(migrated);
  const index = assertValidIndex(normalized as unknown);
  const changed = schemaChanged || snippetChanged;
  if (changed) {
    await writeIndex(repoRoot, index);
  }
  return { index, changed };
}

export async function readIndex(repoRoot: string): Promise<CommentrayIndex | null> {
  try {
    const { index } = await refreshIndexMigrationsOnDisk(repoRoot);
    return index;
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
