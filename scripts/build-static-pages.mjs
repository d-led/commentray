#!/usr/bin/env node
/**
 * Build `_site/index.html` for GitHub Pages from `.commentray.toml` `[static_site]` and
 * `@commentray/code-commentray-static` / `renderCodeBrowserHtml`.
 */
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadCommentrayConfig, parseGithubRepoWebUrl, readIndex } from "@commentray/core";
import { buildCommentrayStatic } from "@commentray/code-commentray-static";
import { buildCommentrayNavSearchDocument } from "@commentray/render";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Canonical Commentray monorepo (toolbar “Rendered with …” attribution on Pages). */
const COMMENTRAY_TOOL_HOME = "https://github.com/d-led/commentray";

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Intro + commentray body. Repository link is shown in the page toolbar (Octocat), not duplicated here. */
function composeCommentrayMarkdown(intro, fileMarkdown) {
  const parts = [];
  if (intro.trim()) parts.push(intro.trim());
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

const commentrayBody = composeCommentrayMarkdown(ss.introMarkdown, fileMarkdown);
const tmpMd = path.join(tmpdir(), `commentray-pages-${process.pid}.md`);
await writeFile(tmpMd, commentrayBody, "utf8");

const outDir = path.join(repoRoot, "_site");
const outHtml = path.join(outDir, "index.html");

const ghParsed =
  cfg.render.relativeGithubBlobLinks && ss.githubUrl ? parseGithubRepoWebUrl(ss.githubUrl) : null;
const markdownUrlBaseDirAbs = ss.commentrayMarkdownFile
  ? path.join(repoRoot, path.dirname(ss.commentrayMarkdownFile))
  : repoRoot;

const commentrayOutputUrls = {
  repoRootAbs: repoRoot,
  htmlOutputFileAbs: outHtml,
  markdownUrlBaseDirAbs,
  ...(ghParsed ? { githubBlobRepo: { owner: ghParsed.owner, repo: ghParsed.repo } } : {}),
};

let blockStretchRows;
const projectIndex = await readIndex(repoRoot);
if (projectIndex && ss.commentrayMarkdownFile) {
  const entry = projectIndex.byCommentrayPath[ss.commentrayMarkdownFile];
  if (entry && entry.blocks.length > 0 && entry.sourcePath === ss.sourceFile) {
    blockStretchRows = {
      index: projectIndex,
      sourceRelative: entry.sourcePath,
      commentrayPathRel: ss.commentrayMarkdownFile,
    };
  }
}

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
    githubRepoUrl: ss.githubUrl ?? undefined,
    toolHomeUrl: COMMENTRAY_TOOL_HOME,
    commentrayOutputUrls,
    relatedGithubNav: ss.relatedGithubNav.length > 0 ? ss.relatedGithubNav : undefined,
    staticSearchScope: "commentray-and-paths",
    commentrayPathForSearch: ss.commentrayMarkdownFile ?? "",
    ...(blockStretchRows ? { blockStretchRows } : {}),
  });
} finally {
  await unlink(tmpMd).catch(() => {});
}

const navSearchPath = path.join(outDir, "commentray-nav-search.json");
const navDoc = await buildCommentrayNavSearchDocument(
  repoRoot,
  ss.commentrayMarkdownFile
    ? {
        sourcePath: ss.sourceFile,
        commentrayPath: ss.commentrayMarkdownFile,
        markdownAbs: path.join(repoRoot, ss.commentrayMarkdownFile),
      }
    : undefined,
);
await writeFile(navSearchPath, `${JSON.stringify(navDoc, null, 2)}\n`, "utf8");

console.log(`Wrote ${outHtml}`);
console.log(`Wrote ${navSearchPath}`);
