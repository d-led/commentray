#!/usr/bin/env node
/**
 * Build `_site/index.html` for GitHub Pages from `.commentary.toml` `[static_site]` and
 * `code-commentary-static` / `renderCodeBrowserHtml`.
 */
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadCommentaryConfig } from "@commentary/core";
import { buildCodeCommentaryStatic } from "code-commentary-static";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function composeCommentaryMarkdown(intro, githubUrl, fileMarkdown) {
  const parts = [];
  if (intro.trim()) parts.push(intro.trim());
  if (githubUrl) parts.push(`[View repository on GitHub](${githubUrl})`);
  if (fileMarkdown.trim()) parts.push(fileMarkdown.trim());
  if (parts.length === 0) return "_No commentary content configured._\n";
  return `${parts.join("\n\n")}\n`;
}

const cfg = await loadCommentaryConfig(repoRoot);
const ss = cfg.staticSite;

const sourceAbs = path.join(repoRoot, ss.sourceFile);
if (!(await pathExists(sourceAbs))) {
  console.error(`static_site.source_file not found: ${ss.sourceFile}`);
  process.exit(1);
}

let fileMarkdown = "";
if (ss.commentaryMarkdownFile) {
  const mdAbs = path.join(repoRoot, ss.commentaryMarkdownFile);
  if (!(await pathExists(mdAbs))) {
    console.error(`static_site.commentary_markdown not found: ${ss.commentaryMarkdownFile}`);
    process.exit(1);
  }
  fileMarkdown = await readFile(mdAbs, "utf8");
}

const commentaryBody = composeCommentaryMarkdown(ss.introMarkdown, ss.githubUrl, fileMarkdown);
const tmpMd = path.join(tmpdir(), `commentary-pages-${process.pid}.md`);
await writeFile(tmpMd, commentaryBody, "utf8");

const outDir = path.join(repoRoot, "_site");
const outHtml = path.join(outDir, "index.html");

try {
  await mkdir(outDir, { recursive: true });
  await buildCodeCommentaryStatic({
    sourceFile: sourceAbs,
    markdownFile: tmpMd,
    outHtml,
    title: ss.title,
    includeMermaidRuntime: cfg.render.mermaid,
    hljsTheme: cfg.render.syntaxTheme,
  });
} finally {
  await unlink(tmpMd).catch(() => {});
}

console.log(`Wrote ${outHtml}`);
