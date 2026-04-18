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

import {
  commentrayAnglesLayoutEnabled,
  commentrayMarkdownPathForAngle,
  defaultAngleIdForOpen,
  githubRepoBlobFileUrl,
  loadCommentrayConfig,
  parseGithubRepoWebUrl,
  readIndex,
} from "@commentray/core";
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

const projectIndex = await readIndex(repoRoot);
const ghWeb = ss.githubUrl ? parseGithubRepoWebUrl(ss.githubUrl) : null;
const ghNavBase = ghWeb
  ? { owner: ghWeb.owner, repo: ghWeb.repo, branch: ss.githubBlobBranch || "main" }
  : null;

const anglesOn = commentrayAnglesLayoutEnabled(repoRoot, cfg.storageDir);
const angleDefs = cfg.angles?.definitions ?? [];

/** @type {import("@commentray/render").CodeBrowserMultiAngleBrowsing | undefined} */
let multiAngleBrowsing;
if (anglesOn && angleDefs.length >= 2) {
  const angles = [];
  for (const def of angleDefs) {
    const rel = commentrayMarkdownPathForAngle(ss.sourceFile, def.id, cfg.storageDir);
    const abs = path.join(repoRoot, rel);
    if (!(await pathExists(abs))) continue;
    const rawFile = await readFile(abs, "utf8");
    const composed = composeCommentrayMarkdown(ss.introMarkdown, rawFile);
    let blockStretchRows;
    if (projectIndex) {
      const entry = projectIndex.byCommentrayPath[rel];
      if (entry && entry.blocks.length > 0 && entry.sourcePath === ss.sourceFile) {
        blockStretchRows = {
          index: projectIndex,
          sourceRelative: entry.sourcePath,
          commentrayPathRel: rel,
        };
      }
    }
    const commentrayOnGithubUrl =
      ghNavBase !== null
        ? githubRepoBlobFileUrl(ghNavBase.owner, ghNavBase.repo, ghNavBase.branch, rel)
        : undefined;
    angles.push({
      id: def.id,
      title: def.title,
      markdown: composed,
      commentrayPathRel: rel,
      commentrayOnGithubUrl,
      ...(blockStretchRows ? { blockStretchRows } : {}),
    });
  }
  if (angles.length >= 2) {
    multiAngleBrowsing = { defaultAngleId: defaultAngleIdForOpen(cfg), angles };
  }
}

let fileMarkdown = "";
if (!multiAngleBrowsing && ss.commentrayMarkdownFile) {
  const mdAbs = path.join(repoRoot, ss.commentrayMarkdownFile);
  if (!(await pathExists(mdAbs))) {
    console.error(`static_site.commentray_markdown not found: ${ss.commentrayMarkdownFile}`);
    process.exit(1);
  }
  fileMarkdown = await readFile(mdAbs, "utf8");
}

const commentrayBody = multiAngleBrowsing
  ? ((
      multiAngleBrowsing.angles.find((a) => a.id === multiAngleBrowsing.defaultAngleId) ??
      multiAngleBrowsing.angles[0]
    )?.markdown ?? "_No commentray content configured._\n")
  : composeCommentrayMarkdown(ss.introMarkdown, fileMarkdown);
const tmpMd = path.join(tmpdir(), `commentray-pages-${process.pid}.md`);
await writeFile(tmpMd, commentrayBody, "utf8");

const outDir = path.join(repoRoot, "_site");
const outHtml = path.join(outDir, "index.html");

const defaultCommentrayRel = multiAngleBrowsing
  ? ((
      multiAngleBrowsing.angles.find((a) => a.id === multiAngleBrowsing.defaultAngleId) ??
      multiAngleBrowsing.angles[0]
    )?.commentrayPathRel ?? "")
  : (ss.commentrayMarkdownFile ?? "");

const markdownUrlBaseDirAbs = defaultCommentrayRel
  ? path.join(repoRoot, path.dirname(defaultCommentrayRel))
  : repoRoot;

// Do not pass `githubBlobRepo` here: `[render].relative_github_blob_links` turns matching
// `https://github.com/<this-repo>/blob/…` links into `/path` then `../path` relative to
// `_site/index.html`. GitHub Pages only serves `_site/` under `/commentray/`, so `../README.md`
// wrongly resolves to `https://<user>.github.io/README.md`. Keep blob URLs absolute for Pages.
const commentrayOutputUrls = {
  repoRootAbs: repoRoot,
  htmlOutputFileAbs: outHtml,
  markdownUrlBaseDirAbs,
};

let blockStretchRows;
if (!multiAngleBrowsing && projectIndex && ss.commentrayMarkdownFile) {
  const entry = projectIndex.byCommentrayPath[ss.commentrayMarkdownFile];
  if (entry && entry.blocks.length > 0 && entry.sourcePath === ss.sourceFile) {
    blockStretchRows = {
      index: projectIndex,
      sourceRelative: entry.sourcePath,
      commentrayPathRel: ss.commentrayMarkdownFile,
    };
  }
}

const sourceOnGithubUrl =
  ghNavBase !== null
    ? githubRepoBlobFileUrl(ghNavBase.owner, ghNavBase.repo, ghNavBase.branch, ss.sourceFile)
    : undefined;
const commentrayOnGithubUrl =
  ghNavBase !== null && defaultCommentrayRel
    ? githubRepoBlobFileUrl(ghNavBase.owner, ghNavBase.repo, ghNavBase.branch, defaultCommentrayRel)
    : undefined;
const documentedNavJsonUrl = ghNavBase !== null ? "./commentray-nav-search.json" : undefined;

const navSearchPath = path.join(outDir, "commentray-nav-search.json");
const navDoc = await buildCommentrayNavSearchDocument(
  repoRoot,
  defaultCommentrayRel
    ? {
        sourcePath: ss.sourceFile,
        commentrayPath: defaultCommentrayRel,
        markdownAbs: path.join(repoRoot, defaultCommentrayRel),
      }
    : undefined,
  ghNavBase ?? undefined,
  cfg.storageDir,
);
const documentedPairsEmbeddedB64 =
  ghNavBase !== null && Array.isArray(navDoc.documentedPairs) && navDoc.documentedPairs.length > 0
    ? Buffer.from(JSON.stringify(navDoc.documentedPairs), "utf8").toString("base64")
    : undefined;

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
    commentrayPathForSearch: defaultCommentrayRel,
    ...(blockStretchRows ? { blockStretchRows } : {}),
    ...(multiAngleBrowsing ? { multiAngleBrowsing } : {}),
    ...(sourceOnGithubUrl ? { sourceOnGithubUrl } : {}),
    ...(commentrayOnGithubUrl ? { commentrayOnGithubUrl } : {}),
    ...(documentedNavJsonUrl ? { documentedNavJsonUrl } : {}),
    ...(documentedPairsEmbeddedB64 ? { documentedPairsEmbeddedB64 } : {}),
  });
  await writeFile(navSearchPath, `${JSON.stringify(navDoc, null, 2)}\n`, "utf8");
} finally {
  await unlink(tmpMd).catch(() => {});
}

console.log(`Wrote ${outHtml}`);
console.log(`Wrote ${navSearchPath}`);
