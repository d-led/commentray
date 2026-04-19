import fs from "node:fs/promises";
import path from "node:path";
import { type ResolvedCommentrayConfig, loadCommentrayConfig } from "./config.js";
import { parseGithubRepoWebUrl } from "./github-url.js";
import { normalizeCommentrayIndex } from "./index-normalize.js";
import { assertValidIndex } from "./metadata.js";
import { migrateIndex } from "./migrate.js";
import { coerceIndexSchemaVersion, CURRENT_SCHEMA_VERSION, type CommentrayIndex } from "./model.js";
import { defaultMetadataIndexPath, normalizeRepoRelativePath } from "./paths.js";
import {
  validateIndexMarkerSemantics,
  validateMarkerBoundariesInSource,
} from "./marker-validation.js";
import { loadGitTrackedSourceTextsOutsideIndex } from "./git-relocation-scan.js";
import { relocationHintMessages } from "./relocation-hints.js";
import { GitScmProvider } from "./scm/git-scm-provider.js";

export type ValidationIssue = { level: "error" | "warn"; message: string };

export type ValidationResult = {
  issues: ValidationIssue[];
};

async function collectIssuesForLoadedIndex(
  repoRoot: string,
  index: CommentrayIndex,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const issue of validateIndexMarkerSemantics(index)) {
    issues.push({ level: issue.level, message: issue.message });
  }
  const uniqueSourcesNorm = [
    ...new Set(
      Object.values(index.byCommentrayPath).map((e) => normalizeRepoRelativePath(e.sourcePath)),
    ),
  ];
  const indexedSourceTexts = new Map<string, string>();
  const missingSourcesNorm = new Set<string>();

  for (const norm of uniqueSourcesNorm) {
    const abs = path.join(repoRoot, ...norm.split("/"));
    try {
      const text = await fs.readFile(abs, "utf8");
      indexedSourceTexts.set(norm, text);
    } catch {
      missingSourcesNorm.add(norm);
      const affected = Object.values(index.byCommentrayPath)
        .filter((e) => normalizeRepoRelativePath(e.sourcePath) === norm)
        .map((e) => e.commentrayPath);
      const uniqAffected = [...new Set(affected)].sort((a, b) => a.localeCompare(b));
      issues.push({
        level: "warn",
        message:
          `Primary source "${norm}" is not readable (deleted, moved, or not checked out). ` +
          `Commentray: ${uniqAffected.join(", ")}. ` +
          `If Git renamed it, try: commentray sync-moved-paths --from HEAD~1 --to HEAD`,
      });
    }
  }

  for (const [norm, text] of indexedSourceTexts) {
    for (const issue of validateMarkerBoundariesInSource(text, norm)) {
      issues.push({ level: issue.level, message: issue.message });
    }
  }

  if (missingSourcesNorm.size === 0) return issues;

  let gitRenames: { from: string; to: string }[] | undefined;
  try {
    const scm = new GitScmProvider();
    if (scm.listPathRenamesBetweenTreeishes) {
      gitRenames = await scm.listPathRenamesBetweenTreeishes(repoRoot, "HEAD~1", "HEAD");
    }
  } catch {
    /* no Git or shallow history — hints still run without renames */
  }
  let textsForRelocationHints: Map<string, string> = indexedSourceTexts;
  try {
    const extra = await loadGitTrackedSourceTextsOutsideIndex(
      repoRoot,
      new Set(indexedSourceTexts.keys()),
    );
    if (extra.size > 0) {
      textsForRelocationHints = new Map([...extra, ...indexedSourceTexts]);
    }
  } catch {
    /* not a git checkout or ls-files failed — use indexed primaries only */
  }
  for (const hint of relocationHintMessages({
    index,
    missingSourcePathsNorm: missingSourcesNorm,
    gitRenames,
    indexedSourceTextsByPath: textsForRelocationHints,
  })) {
    issues.push({ level: "warn", message: hint });
  }
  return issues;
}

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
    issues.push(...(await collectIssuesForLoadedIndex(repoRoot, index)));
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
  const priorSchema =
    typeof parsed === "object" && parsed !== null
      ? coerceIndexSchemaVersion((parsed as Record<string, unknown>).schemaVersion)
      : null;
  if (typeof priorSchema === "number" && priorSchema > CURRENT_SCHEMA_VERSION) {
    const metaDir = path.dirname(indexPath);
    const backupName = `index.schema-${String(priorSchema)}-backup-${String(Date.now())}.json`;
    await fs.writeFile(path.join(metaDir, backupName), raw, "utf8");
  }
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
