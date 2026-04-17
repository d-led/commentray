#!/usr/bin/env node
/**
 * Build `_site/index.html` for GitHub Pages from `.commentray.toml` `[static_site]` and
 * `code-commentray-static` / `renderCodeBrowserHtml`.
 */
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadCommentrayConfig } from "@commentray/core";
import { buildCommentrayStatic } from "code-commentray-static";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function composeCommentrayMarkdown(intro, githubUrl, fileMarkdown) {
  const parts = [];
  if (intro.trim()) parts.push(intro.trim());
  if (githubUrl) parts.push(`[View repository on GitHub](${githubUrl})`);
  if (fileMarkdown.trim()) parts.push(fileMarkdown.trim());
  if (parts.length === 0) return "_No commentray content configured._\n";
  return `${parts.join("\n\n")}\n`;
}

const cfg = await loadCommentrayConfig(repoRoot);
const ss = cfg.staticSite;

const sourceAbs = path.join(repoRoot, ss.sourceFile);
if (!(await pathExists(sourceAbs))) {
  console.error(`static_site.source_file not found: ${ss.sourceFile}`);
  process.exit(1);
}

let fileMarkdown = "";
if (ss.commentrayMarkdownFile) {
  const mdAbs = path.join(repoRoot, ss.commentrayMarkdownFile);
  if (!(await pathExists(mdAbs))) {
    console.error(`static_site.commentray_markdown not found: ${ss.commentrayMarkdownFile}`);
    process.exit(1);
  }
  fileMarkdown = await readFile(mdAbs, "utf8");
}

const commentrayBody = composeCommentrayMarkdown(ss.introMarkdown, ss.githubUrl, fileMarkdown);
const tmpMd = path.join(tmpdir(), `commentray-pages-${process.pid}.md`);
await writeFile(tmpMd, commentrayBody, "utf8");

const outDir = path.join(repoRoot, "_site");
const outHtml = path.join(outDir, "index.html");

try {
  await mkdir(outDir, { recursive: true });
  await buildCommentrayStatic({
    sourceFile: sourceAbs,
    markdownFile: tmpMd,
    outHtml,
    title: ss.title,
    filePath: ss.sourceFile,
    includeMermaidRuntime: cfg.render.mermaid,
    hljsTheme: cfg.render.syntaxTheme,
  });
} finally {
  await unlink(tmpMd).catch(() => {});
}

console.log(`Wrote ${outHtml}`);
