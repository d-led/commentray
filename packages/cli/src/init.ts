import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  defaultMetadataIndexPath,
  emptyIndex,
  loadCommentrayConfig,
  refreshIndexMigrationsOnDisk,
  validateProject,
  writeIndex,
  type ValidationIssue,
} from "@commentray/core";

import { logCliError, logCliValidationIssue, logCliWarning } from "./cli-output.js";
import { mergeCommentrayPreCommitHook } from "./git-hooks.js";

/** VS Code Marketplace id for the published Commentray extension. */
export const COMMENTRAY_VSCODE_EXTENSION_ID = "d-led.commentray-vscode" as const;

type VscodeExtensionsMergeResult = "wrote" | "unchanged" | "skipped";

type ParsedExtensionsDoc = {
  other: Record<string, unknown>;
  recommendations: string[];
  unwantedRecommendations: string[] | undefined;
};

function emptyExtensionsDoc(): ParsedExtensionsDoc {
  return { other: {}, recommendations: [], unwantedRecommendations: undefined };
}

function parseExtensionsObject(obj: unknown): ParsedExtensionsDoc | null {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  const record = obj as Record<string, unknown>;
  const recsRaw = record.recommendations;
  const recommendations = Array.isArray(recsRaw)
    ? recsRaw.filter((x): x is string => typeof x === "string")
    : [];
  const unwantedRaw = record.unwantedRecommendations;
  const unwantedFiltered = Array.isArray(unwantedRaw)
    ? unwantedRaw.filter((x): x is string => typeof x === "string")
    : [];
  const unwantedRecommendations = unwantedFiltered.length > 0 ? unwantedFiltered : undefined;
  const other: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k !== "recommendations" && k !== "unwantedRecommendations") other[k] = v;
  }
  return { other, recommendations, unwantedRecommendations };
}

function readExtensionsDocFromJson(
  repoRoot: string,
  extPath: string,
  raw: string,
): ParsedExtensionsDoc | "skipped" {
  let obj: unknown;
  try {
    obj = JSON.parse(raw) as unknown;
  } catch (e) {
    logCliWarning(
      `${path.relative(repoRoot, extPath)}: invalid JSON (${e instanceof Error ? e.message : String(e)}); left unchanged (Commentray recommendation not merged).`,
    );
    return "skipped";
  }
  const parsed = parseExtensionsObject(obj);
  if (parsed === null) {
    logCliWarning(
      `${path.relative(repoRoot, extPath)}: expected a JSON object; left unchanged (Commentray recommendation not merged).`,
    );
    return "skipped";
  }
  return parsed;
}

/**
 * Ensures `.vscode/extensions.json` recommends the published Commentray extension.
 * Preserves other keys and recommendation ids. Skips with a warning if the file is not mergeable JSON.
 */
export async function mergeCommentrayVscodeExtensionRecommendation(
  repoRoot: string,
): Promise<VscodeExtensionsMergeResult> {
  const vscodeDir = path.join(repoRoot, ".vscode");
  const extPath = path.join(vscodeDir, "extensions.json");
  await fs.mkdir(vscodeDir, { recursive: true });

  let parsed: ParsedExtensionsDoc;
  try {
    const raw = await fs.readFile(extPath, "utf8");
    const doc = readExtensionsDocFromJson(repoRoot, extPath, raw);
    if (doc === "skipped") return "skipped";
    parsed = doc;
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") {
      logCliWarning(
        `${path.relative(repoRoot, extPath)}: ${e instanceof Error ? e.message : String(e)}; Commentray recommendation not merged.`,
      );
      return "skipped";
    }
    parsed = emptyExtensionsDoc();
  }

  const extId = COMMENTRAY_VSCODE_EXTENSION_ID;
  const nextRecs = parsed.recommendations.includes(extId)
    ? parsed.recommendations
    : [...parsed.recommendations, extId];

  const out: Record<string, unknown> = { ...parsed.other, recommendations: nextRecs };
  if (parsed.unwantedRecommendations !== undefined) {
    out.unwantedRecommendations = parsed.unwantedRecommendations;
  }

  const nextStr = `${JSON.stringify(out, null, 2)}\n`;
  try {
    const prior = await fs.readFile(extPath, "utf8");
    if (prior === nextStr) return "unchanged";
  } catch {
    // missing or unreadable — write
  }
  await fs.writeFile(extPath, nextStr, "utf8");
  return "wrote";
}

export const DEFAULT_COMMENTRAY_TOML = [
  "# Commentray configuration (defaults are commented)",
  "",
  "[storage]",
  "# Repo-relative. Must not live inside .git/ (Git treats that directory as",
  "# opaque metadata and routine operations can wipe it).",
  '# dir = ".commentray"',
  "",
  "[scm]",
  '# provider = "git"',
  "",
  "[render]",
  "# mermaid = true",
  '# syntaxTheme = "github-dark"',
  "# When true, GitHub blob/tree links for static_site.github_url rewrite to paths",
  "# relative to generated HTML (Pages, `commentray render`). Needs a repo home URL.",
  "# relative_github_blob_links = false",
  "# Local images: `/repo/path` = repo root; `./x` or `sub/x` = next to the commentray `.md`",
  "# (see docs/spec/storage.md — Images; vocabulary — Commentray vs commentray).",
  "",
  "[anchors]",
  "# defaultStrategy = [",
  '#   "symbol",',
  '#   "lines",',
  "# ]",
  "",
  "# Named **Angles** — multiple commentrays per source (Introduction, Architecture, …).",
  "# Optional UI list + default selection. On disk, multi-angle layout is enabled only when",
  "# `{storage.dir}/source/.default` exists (file or dir); see docs/spec/storage.md.",
  "# [angles]",
  '# default_angle = "introduction"',
  "# [[angles.definitions]]",
  '# id = "introduction"',
  '# title = "Introduction"',
  "# [[angles.definitions]]",
  '# id = "architecture"',
  '# title = "Architecture"',
  "",
  "# GitHub Pages static browser (optional). `related_github_files` adds toolbar links",
  "# to other repo paths on github.com (single index.html cannot serve every file).",
  "# [static_site]",
  '# title = "My project"',
  '# github_url = "https://github.com/you/repo"',
  '# github_blob_branch = "main"',
  '# source_file = "README.md"',
  '# commentray_markdown = ".commentray/source/README.md.md"',
  "# [[static_site.related_github_files]]",
  '# path = "CONTRIBUTING.md"',
  "",
].join("\n");

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function initVscodeExtensionRecommendation(repoRoot: string): Promise<void> {
  try {
    if ((await mergeCommentrayVscodeExtensionRecommendation(repoRoot)) === "wrote") {
      console.log(
        `Updated .vscode/extensions.json (recommendation: ${COMMENTRAY_VSCODE_EXTENSION_ID}).`,
      );
    }
  } catch (e) {
    logCliWarning(
      `Could not update .vscode/extensions.json: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Full idempotent init: storage dirs, `index.json` if missing, `.commentray.toml` if missing;
 * merges the published Commentray VS Code extension into `.vscode/extensions.json` when the file
 * is valid JSON; always runs index migrations and `validateProject` (non-zero exit on validation errors).
 */
export async function runInitFull(repoRoot: string): Promise<number> {
  const cfg = await loadCommentrayConfig(repoRoot);
  const storage = path.join(repoRoot, cfg.storageDir);
  await fs.mkdir(path.join(storage, "source"), { recursive: true });
  await fs.mkdir(path.join(storage, "metadata"), { recursive: true });

  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  if (!(await pathExists(indexPath))) {
    await writeIndex(repoRoot, emptyIndex());
    console.log(`Created ${defaultMetadataIndexPath()}.`);
  }

  try {
    const { changed } = await refreshIndexMigrationsOnDisk(repoRoot);
    if (changed) {
      console.log(
        `Updated ${defaultMetadataIndexPath()} (schema migration and/or snippet normalization).`,
      );
    }
  } catch (e) {
    logCliError(
      `Could not load or migrate ${defaultMetadataIndexPath()}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return 1;
  }

  const tomlPath = path.join(repoRoot, ".commentray.toml");
  let createdToml = false;
  try {
    await fs.stat(tomlPath);
  } catch {
    await fs.writeFile(tomlPath, DEFAULT_COMMENTRAY_TOML, "utf8");
    createdToml = true;
  }
  if (createdToml) {
    console.log("Created .commentray.toml with commented defaults.");
  }

  await initVscodeExtensionRecommendation(repoRoot);

  const validation = await validateProject(repoRoot);
  for (const issue of validation.issues) {
    logCliValidationIssue(issue);
  }
  const hasError = validation.issues.some((i: ValidationIssue) => i.level === "error");

  console.log(`Initialized Commentray storage under ${cfg.storageDir}`);
  return hasError ? 1 : 0;
}

/**
 * Ensure `.commentray.toml` exists (or overwrite with `--force`).
 * @returns exit code (0 or 1)
 */
export async function runInitConfig(repoRoot: string, opts: { force: boolean }): Promise<number> {
  const tomlPath = path.join(repoRoot, ".commentray.toml");
  const exists = await pathExists(tomlPath);
  if (exists && !opts.force) {
    console.log(
      ".commentray.toml already exists (use `commentray init config --force` to replace).",
    );
    return 0;
  }
  if (exists && opts.force) {
    logCliWarning("Overwriting .commentray.toml (--force).");
  }
  await fs.writeFile(tomlPath, DEFAULT_COMMENTRAY_TOML, "utf8");
  console.log(`Wrote ${tomlPath}`);
  return 0;
}

/**
 * Install or refresh the Commentray-managed `pre-commit` hook block.
 * @returns exit code (0 or 1)
 */
export async function runInitScm(repoRoot: string): Promise<number> {
  const gitDir = path.join(repoRoot, ".git");
  if (!(await pathExists(gitDir))) {
    console.error("No .git directory at repository root; run `git init` first.");
    return 1;
  }
  const hookPath = path.join(gitDir, "hooks", "pre-commit");
  let prior: string;
  try {
    prior = await fs.readFile(hookPath, "utf8");
  } catch {
    prior = "";
  }
  const next = mergeCommentrayPreCommitHook(prior);
  await fs.mkdir(path.dirname(hookPath), { recursive: true });
  await fs.writeFile(hookPath, next, "utf8");
  if (process.platform !== "win32") {
    await fs.chmod(hookPath, 0o755);
  }
  console.log(`Updated ${path.relative(repoRoot, hookPath)} (Commentray validate block).`);
  return 0;
}
