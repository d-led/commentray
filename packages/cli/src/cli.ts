#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  commentaryMarkdownPath,
  defaultMetadataIndexPath,
  emptyIndex,
  loadCommentaryConfig,
  migrateIndex,
  normalizeRepoRelativePath,
  runCommanderMain,
  type ValidationIssue,
  validateProject,
} from "@commentary/core";
import { renderSideBySideHtml } from "@commentary/render";
import { Command } from "commander";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function commentaryRepoRootFrom(startDir: string): Promise<string> {
  let dir = startDir;
  for (;;) {
    const pkgPath = path.join(dir, "package.json");
    if (await pathExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { name?: string };
        if (pkg.name === "commentary") return dir;
      } catch {
        // ignore invalid package.json
      }
    }
    if (await pathExists(path.join(dir, ".commentary.toml"))) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Unable to locate Commentary repository root (expected a root package.json named "commentary" or a .commentary.toml file).',
      );
    }
    dir = parent;
  }
}

async function repoRootFromCwd(): Promise<string> {
  return commentaryRepoRootFrom(process.cwd());
}

async function writeDefaultToml(repoRoot: string) {
  const p = path.join(repoRoot, ".commentary.toml");
  const body = [
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
  await fs.writeFile(p, body, "utf8");
}

async function cmdInit() {
  const repoRoot = await repoRootFromCwd();
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
  try {
    await fs.stat(path.join(repoRoot, ".commentary.toml"));
  } catch {
    await writeDefaultToml(repoRoot);
  }
  console.log(`Initialized Commentary storage under ${cfg.storageDir}`);
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
      console.error(`Missing index at ${defaultMetadataIndexPath()}. Run: commentary init`);
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
  const html = await renderSideBySideHtml({
    title: source,
    code,
    language: ext === "ts" ? "ts" : ext,
    commentaryMarkdown: md,
    includeMermaidRuntime: opts.mermaid,
  });
  const outPath = path.resolve(repoRoot, opts.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, html, "utf8");
  console.log(`Wrote ${outPath}`);
}

const program = new Command();
program.name("commentary").description("Commentary CLI").version("0.0.1");

program
  .command("init")
  .description("Create storage directories and seed config")
  .action(async () => {
    await cmdInit();
  });

program
  .command("validate")
  .description("Validate Commentary metadata and configuration")
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
  .description("Print the commentary Markdown path for a source file")
  .action(async (file: string) => {
    const normalized = normalizeRepoRelativePath(file);
    console.log(commentaryMarkdownPath(normalized));
  });

program
  .command("render")
  .requiredOption("--source <path>", "Repo-relative source file")
  .requiredOption("--markdown <path>", "Path to commentary markdown file")
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
