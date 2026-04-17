#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import cliPackage from "../package.json" with { type: "json" };
import {
  commentrayMarkdownPath,
  defaultMetadataIndexPath,
  loadCommentrayConfig,
  migrateIndex,
  normalizeRepoRelativePath,
  parseGithubRepoWebUrl,
  runCommanderMain,
  type ValidationIssue,
  validateProject,
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

async function cmdMigrate(): Promise<number> {
  const repoRoot = await repoRootFromCwd();
  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  let raw: string;
  try {
    raw = await fs.readFile(indexPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`Missing index at ${defaultMetadataIndexPath()}. Run: commentray init`);
      return 1;
    }
    throw err;
  }
  const { index, changed } = migrateIndex(JSON.parse(raw) as unknown);
  if (changed) {
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
    console.log("Migrated metadata index.");
  } else {
    console.log("No metadata migration needed.");
  }
  return 0;
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
  const ghParsed =
    cfg.render.relativeGithubBlobLinks && cfg.staticSite.githubUrl
      ? parseGithubRepoWebUrl(cfg.staticSite.githubUrl)
      : null;
  const githubBlobLinkRewrite = ghParsed
    ? {
        owner: ghParsed.owner,
        repo: ghParsed.repo,
        htmlOutputFileAbs: outPath,
        repoRootAbs: repoRoot,
      }
    : undefined;
  const html = await renderSideBySideHtml({
    title: source,
    code,
    language: ext === "ts" ? "ts" : ext,
    commentrayMarkdown: md,
    includeMermaidRuntime: opts.mermaid,
    githubBlobLinkRewrite,
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
    "Idempotent workspace setup: storage dirs, index.json if missing, .commentray.toml if missing",
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
  await runInitFull(await repoRootFromCwd());
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
