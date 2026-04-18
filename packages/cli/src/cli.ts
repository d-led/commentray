#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import cliPackage from "../package.json" with { type: "json" };
import {
  applyPathRenamesToCommentrayIndex,
  commentrayMarkdownPath,
  convertCommentraySourceMarkersToLanguage,
  defaultMetadataIndexPath,
  GitScmProvider,
  loadCommentrayConfig,
  refreshIndexMigrationsOnDisk,
  normalizeRepoRelativePath,
  parseGithubRepoWebUrl,
  readIndex,
  runCommanderMain,
  type ValidationIssue,
  validateProject,
  writeIndex,
} from "@commentray/core";
import { renderSideBySideHtml } from "@commentray/render";
import { Command } from "commander";

import { runInitConfig, runInitFull, runInitScm } from "./init.js";
import { findProjectRoot } from "./project-root.js";

async function repoRootFromCwd(): Promise<string> {
  const root = await findProjectRoot(process.cwd());
  return root.dir;
}

async function cmdValidate(): Promise<number> {
  const repoRoot = await repoRootFromCwd();
  const result = await validateProject(repoRoot);
  for (const issue of result.issues) {
    console.error(`[${issue.level}] ${issue.message}`);
  }
  const hasError = result.issues.some((i: ValidationIssue) => i.level === "error");
  return hasError ? 1 : 0;
}

async function cmdDoctor(): Promise<number> {
  const code = await cmdValidate();
  try {
    await fs.access(path.join(process.cwd(), ".git"));
  } catch {
    console.warn("[warn] No .git directory detected in cwd; SCM features require a Git checkout.");
  }
  return code;
}

async function cmdConvertSourceMarkers(opts: {
  file: string;
  language: string;
  dryRun: boolean;
}): Promise<number> {
  const repoRoot = await repoRootFromCwd();
  const rel = normalizeRepoRelativePath(opts.file);
  const abs = path.join(repoRoot, ...rel.split("/"));
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`File not found: ${rel}`);
      return 1;
    }
    throw err;
  }
  const { sourceText, changed, convertedPairs } = convertCommentraySourceMarkersToLanguage(
    raw,
    opts.language,
  );
  if (!changed) {
    console.log(
      "No changes (no marker pairs, already target style, or only line-ending normalisation).",
    );
    return 0;
  }
  if (opts.dryRun) {
    console.log(`Would rewrite ${convertedPairs} marker pair(s) in ${rel}.`);
    return 0;
  }
  await fs.writeFile(abs, sourceText, "utf8");
  console.log(`Rewrote ${convertedPairs} marker pair(s) in ${rel}.`);
  return 0;
}

async function cmdSyncMovedPaths(opts: {
  fromRef: string;
  toRef: string;
  dryRun: boolean;
}): Promise<number> {
  const repoRoot = await repoRootFromCwd();
  const scm = new GitScmProvider();
  if (!scm.listPathRenamesBetweenTreeishes) {
    console.error("SCM provider does not support rename listing.");
    return 1;
  }
  let renames;
  try {
    renames = await scm.listPathRenamesBetweenTreeishes(repoRoot, opts.fromRef, opts.toRef);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Could not list renames (${opts.fromRef} → ${opts.toRef}): ${msg}`);
    console.error("Try explicit refs, e.g. --from abc123 --to def456 or --from HEAD~1 --to HEAD.");
    return 1;
  }
  if (renames.length === 0) {
    console.log("No Git-detected renames in that range.");
    return 0;
  }
  const cfg = await loadCommentrayConfig(repoRoot);
  const index = await readIndex(repoRoot);
  if (index === null) {
    console.error(`No index at ${defaultMetadataIndexPath()}. Run: commentray init`);
    return 1;
  }
  let next;
  try {
    next = applyPathRenamesToCommentrayIndex(index, renames, repoRoot, cfg);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  if (!next.changed) {
    console.log("Index paths already match those renames (nothing to update).");
    return 0;
  }
  if (opts.dryRun) {
    console.log(`Would apply ${renames.length} rename(s) to index.json (dry run).`);
    for (const r of renames) {
      console.log(`  ${r.from} -> ${r.to}`);
    }
    return 0;
  }
  await writeIndex(repoRoot, next.index);
  console.log(`Updated index.json for ${renames.length} path rename(s).`);
  for (const r of renames) {
    console.log(`  ${r.from} -> ${r.to}`);
  }
  return 0;
}

async function cmdMigrate(): Promise<number> {
  const repoRoot = await repoRootFromCwd();
  try {
    const { changed } = await refreshIndexMigrationsOnDisk(repoRoot);
    if (changed) {
      console.log("Migrated metadata index (schema and/or snippet normalization).");
    } else {
      console.log("No metadata migration needed.");
    }
    return 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`Missing index at ${defaultMetadataIndexPath()}. Run: commentray init`);
      return 1;
    }
    throw err;
  }
}

async function cmdRender(opts: {
  source: string;
  markdown: string;
  out: string;
  mermaid: boolean;
}) {
  const repoRoot = await repoRootFromCwd();
  const source = normalizeRepoRelativePath(opts.source);
  const md = await fs.readFile(path.resolve(repoRoot, opts.markdown), "utf8");
  const code = await fs.readFile(path.resolve(repoRoot, source), "utf8");
  const ext = path.extname(source).slice(1) || "txt";
  const outPath = path.resolve(repoRoot, opts.out);
  const cfg = await loadCommentrayConfig(repoRoot);
  const mdAbs = path.resolve(repoRoot, opts.markdown);
  const ghParsed =
    cfg.render.relativeGithubBlobLinks && cfg.staticSite.githubUrl
      ? parseGithubRepoWebUrl(cfg.staticSite.githubUrl)
      : null;
  const commentrayOutputUrls = {
    repoRootAbs: repoRoot,
    htmlOutputFileAbs: outPath,
    markdownUrlBaseDirAbs: path.dirname(mdAbs),
    ...(ghParsed ? { githubBlobRepo: { owner: ghParsed.owner, repo: ghParsed.repo } } : {}),
  };
  const html = await renderSideBySideHtml({
    title: source,
    code,
    language: ext === "ts" ? "ts" : ext,
    commentrayMarkdown: md,
    includeMermaidRuntime: opts.mermaid,
    commentrayOutputUrls,
  });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, html, "utf8");
  console.log(`Wrote ${outPath}`);
}

const program = new Command();
program.name("commentray").description("Commentray CLI").version(cliPackage.version);

const initCmd = program
  .command("init")
  .description(
    "Idempotent workspace setup: storage dirs, index.json if missing, .commentray.toml if missing; " +
      "merges d-led.commentray-vscode into .vscode/extensions.json when mergeable; " +
      "always refreshes index migrations and runs validate (exit 1 on validation errors)",
  );

initCmd
  .command("config")
  .description("Ensure .commentray.toml exists with commented defaults (use --force to overwrite)")
  .option("--force", "Replace an existing .commentray.toml", false)
  .action(async (opts: { force?: boolean }) => {
    process.exitCode = await runInitConfig(await repoRootFromCwd(), { force: Boolean(opts.force) });
  });

initCmd
  .command("scm")
  .description(
    "Install or refresh Commentray's block in .git/hooks/pre-commit (runs validate when CLI is present)",
  )
  .action(async () => {
    process.exitCode = await runInitScm(await repoRootFromCwd());
  });

initCmd.action(async () => {
  process.exitCode = await runInitFull(await repoRootFromCwd());
});

program
  .command("validate")
  .description("Validate Commentray metadata and configuration")
  .action(async () => {
    process.exitCode = await cmdValidate();
  });

program
  .command("doctor")
  .description("Validate plus environment checks")
  .action(async () => {
    process.exitCode = await cmdDoctor();
  });

program
  .command("migrate")
  .description("Migrate metadata JSON to the current schema")
  .action(async () => {
    process.exitCode = await cmdMigrate();
  });

program
  .command("sync-moved-paths")
  .description(
    "Rewrite index.json paths using Git rename detection between two tree-ish refs (default HEAD~1 → HEAD)",
  )
  .option("--from <ref>", "Older tree-ish", "HEAD~1")
  .option("--to <ref>", "Newer tree-ish", "HEAD")
  .option("--dry-run", "List renames that would be applied without writing index.json", false)
  .action(async (opts: { from?: string; to?: string; dryRun?: boolean }) => {
    process.exitCode = await cmdSyncMovedPaths({
      fromRef: (opts.from as string) || "HEAD~1",
      toRef: (opts.to as string) || "HEAD",
      dryRun: Boolean(opts.dryRun),
    });
  });

program
  .command("convert-source-markers")
  .description(
    "Rewrite Commentray marker pairs in a source file to the delimiter style for a VS Code language id",
  )
  .requiredOption("--file <path>", "Repo-relative path to the source file")
  .requiredOption("--language <id>", "VS Code language id (e.g. typescript, rust, yaml, css)")
  .option("--dry-run", "Report how many pairs would change without writing the file", false)
  .action(async (opts: { file?: string; language?: string; dryRun?: boolean }) => {
    process.exitCode = await cmdConvertSourceMarkers({
      file: opts.file as string,
      language: opts.language as string,
      dryRun: Boolean(opts.dryRun),
    });
  });

program
  .command("paths")
  .argument("<file>", "Repo-relative source file path")
  .description("Print the commentray Markdown path for a source file")
  .action(async (file: string) => {
    const normalized = normalizeRepoRelativePath(file);
    console.log(commentrayMarkdownPath(normalized));
  });

program
  .command("render")
  .requiredOption("--source <path>", "Repo-relative source file")
  .requiredOption("--markdown <path>", "Path to commentray markdown file")
  .requiredOption("--out <path>", "Output HTML path")
  .option("--mermaid", "Include Mermaid runtime in HTML output", false)
  .action(async (opts) => {
    await cmdRender({
      source: opts.source as string,
      markdown: opts.markdown as string,
      out: opts.out as string,
      mermaid: Boolean(opts.mermaid),
    });
  });

void runCommanderMain(() => program.parseAsync(process.argv));
