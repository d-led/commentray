import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { defaultMetadataIndexPath, emptyIndex, loadCommentrayConfig } from "@commentray/core";

import { mergeCommentrayPreCommitHook } from "./git-hooks.js";

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

/** Full idempotent init: storage dirs, index.json if missing, .commentray.toml if missing. */
export async function runInitFull(repoRoot: string): Promise<void> {
  const cfg = await loadCommentrayConfig(repoRoot);
  const storage = path.join(repoRoot, cfg.storageDir);
  await fs.mkdir(path.join(storage, "source"), { recursive: true });
  await fs.mkdir(path.join(storage, "metadata"), { recursive: true });

  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    await fs.stat(indexPath);
  } catch {
    await fs.writeFile(indexPath, JSON.stringify(emptyIndex(), null, 2) + "\n", "utf8");
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

  console.log(`Initialized Commentray storage under ${cfg.storageDir}`);
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
    console.warn("Overwriting .commentray.toml (--force).");
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
