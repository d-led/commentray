import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { defaultMetadataIndexPath, emptyIndex, loadCommentaryConfig } from "@commentary/core";

import { mergeCommentaryPreCommitHook } from "./git-hooks.js";

export const DEFAULT_COMMENTARY_TOML = [
  "# Commentary configuration (defaults are commented)",
  "",
  "[storage]",
  '# dir = ".commentary"',
  "",
  "[scm]",
  '# provider = "git"',
  "",
  "[render]",
  "# mermaid = true",
  '# syntaxTheme = "github-dark"',
  "",
  "[anchors]",
  '# defaultStrategy = ["symbol", "lines"]',
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

/** Full idempotent init: storage dirs, index.json if missing, .commentary.toml if missing. */
export async function runInitFull(repoRoot: string): Promise<void> {
  const cfg = await loadCommentaryConfig(repoRoot);
  const storage = path.join(repoRoot, cfg.storageDir);
  await fs.mkdir(path.join(storage, "source"), { recursive: true });
  await fs.mkdir(path.join(storage, "metadata"), { recursive: true });

  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    await fs.stat(indexPath);
  } catch {
    await fs.writeFile(indexPath, JSON.stringify(emptyIndex(), null, 2) + "\n", "utf8");
  }

  const tomlPath = path.join(repoRoot, ".commentary.toml");
  let createdToml = false;
  try {
    await fs.stat(tomlPath);
  } catch {
    await fs.writeFile(tomlPath, DEFAULT_COMMENTARY_TOML, "utf8");
    createdToml = true;
  }
  if (createdToml) {
    console.log("Created .commentary.toml with commented defaults.");
  }

  console.log(`Initialized Commentary storage under ${cfg.storageDir}`);
}

/**
 * Ensure `.commentary.toml` exists (or overwrite with `--force`).
 * @returns exit code (0 or 1)
 */
export async function runInitConfig(repoRoot: string, opts: { force: boolean }): Promise<number> {
  const tomlPath = path.join(repoRoot, ".commentary.toml");
  const exists = await pathExists(tomlPath);
  if (exists && !opts.force) {
    console.log(
      ".commentary.toml already exists (use `commentary init config --force` to replace).",
    );
    return 0;
  }
  if (exists && opts.force) {
    console.warn("Overwriting .commentary.toml (--force).");
  }
  await fs.writeFile(tomlPath, DEFAULT_COMMENTARY_TOML, "utf8");
  console.log(`Wrote ${tomlPath}`);
  return 0;
}

/**
 * Install or refresh the Commentary-managed `pre-commit` hook block.
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
  const next = mergeCommentaryPreCommitHook(prior);
  await fs.mkdir(path.dirname(hookPath), { recursive: true });
  await fs.writeFile(hookPath, next, "utf8");
  if (process.platform !== "win32") {
    await fs.chmod(hookPath, 0o755);
  }
  console.log(`Updated ${path.relative(repoRoot, hookPath)} (Commentary validate block).`);
  return 0;
}
