import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  type CommentrayIndex,
  type ResolvedCommentrayConfig,
  type ResolvedStaticSite,
  commentrayAnglesLayoutEnabled,
  commentrayMarkdownPathForAngle,
  defaultAngleIdForOpen,
  githubRepoBlobFileUrl,
  parseGithubRepoWebUrl,
  resolveCommentrayMarkdownPath,
} from "@commentray/core";
import {
  type CodeBrowserMultiAngleBrowsing,
  type CodeBrowserMultiAngleSpec,
} from "@commentray/render";

import { browsePairStaticBrowseRelUrl } from "./browse-pair-static-url.js";
import type { BuildCommentrayStaticOptions } from "./build.js";
import {
  composeCommentrayMarkdown,
  emptyCommentrayMarkdown,
  pathExists,
} from "./github-pages-site-shared.js";

export type GithubNavBase = { owner: string; repo: string; branch: string };

export function resolveGithubNavBase(ss: ResolvedStaticSite): GithubNavBase | null {
  const ghWeb = ss.githubUrl ? parseGithubRepoWebUrl(ss.githubUrl) : null;
  if (!ghWeb) return null;
  return { owner: ghWeb.owner, repo: ghWeb.repo, branch: ss.githubBlobBranch || "main" };
}

async function multiAngleSpecForDefinition(
  repoRoot: string,
  cfg: ResolvedCommentrayConfig,
  ss: ResolvedStaticSite,
  projectIndex: CommentrayIndex | null,
  ghNavBase: GithubNavBase | null,
  def: NonNullable<ResolvedCommentrayConfig["angles"]>["definitions"][number],
): Promise<CodeBrowserMultiAngleSpec | undefined> {
  const rel = commentrayMarkdownPathForAngle(ss.sourceFile, def.id, cfg.storageDir);
  const abs = path.join(repoRoot, rel);
  if (!(await pathExists(abs))) return undefined;
  const rawFile = await readFile(abs, "utf8");
  const composed = composeCommentrayMarkdown(ss.introMarkdown, rawFile);
  let angleBlockStretch: CodeBrowserMultiAngleSpec["blockStretchRows"];
  if (projectIndex) {
    const entry = projectIndex.byCommentrayPath[rel];
    if (
      (entry && entry.blocks.length > 0 && entry.sourcePath === ss.sourceFile) ||
      entry === undefined
    ) {
      angleBlockStretch = {
        index: projectIndex,
        sourceRelative: ss.sourceFile,
        commentrayPathRel: rel,
      };
    }
  }
  const commentrayOnGithubUrl =
    ghNavBase !== null
      ? githubRepoBlobFileUrl(ghNavBase.owner, ghNavBase.repo, ghNavBase.branch, rel)
      : undefined;
  return {
    id: def.id,
    title: def.title,
    markdown: composed,
    commentrayPathRel: rel,
    commentrayOnGithubUrl,
    ...(angleBlockStretch ? { blockStretchRows: angleBlockStretch } : {}),
  };
}

export async function loadMultiAngleBrowsingIfEnabled(
  repoRoot: string,
  cfg: ResolvedCommentrayConfig,
  ss: ResolvedStaticSite,
  projectIndex: CommentrayIndex | null,
  ghNavBase: GithubNavBase | null,
): Promise<CodeBrowserMultiAngleBrowsing | undefined> {
  const anglesOn = commentrayAnglesLayoutEnabled(repoRoot, cfg.storageDir);
  const angleDefs = cfg.angles?.definitions ?? [];
  if (!anglesOn || angleDefs.length < 2) return undefined;

  const angles: CodeBrowserMultiAngleSpec[] = [];
  for (const def of angleDefs) {
    const spec = await multiAngleSpecForDefinition(repoRoot, cfg, ss, projectIndex, ghNavBase, def);
    if (spec !== undefined) angles.push(spec);
  }
  if (angles.length < 2) return undefined;
  for (const a of angles) {
    a.staticBrowseUrl = browsePairStaticBrowseRelUrl(
      { sourcePath: ss.sourceFile, commentrayPath: a.commentrayPathRel },
      cfg.storageDir,
    );
  }
  return { defaultAngleId: defaultAngleIdForOpen(cfg), angles };
}

export async function readFlatCompanionMarkdown(
  repoRoot: string,
  cfg: ResolvedCommentrayConfig,
  ss: ResolvedStaticSite,
): Promise<string> {
  const configuredRel = ss.commentrayMarkdownFile?.trim();
  const fallbackRel = resolveCommentrayMarkdownPath(repoRoot, ss.sourceFile, cfg).commentrayPath;
  const candidates =
    configuredRel && configuredRel.length > 0
      ? [configuredRel]
      : [fallbackRel].filter((p): p is string => typeof p === "string" && p.length > 0);

  for (const rel of candidates) {
    const mdAbs = path.join(repoRoot, rel);
    try {
      const st = await stat(mdAbs);
      if (!st.isFile()) continue;
      return await readFile(mdAbs, "utf8");
    } catch {
      continue;
    }
  }

  // Missing companion markdown is a valid state for onboarding; caller will render empty-state UI.
  return "";
}

export function pickCommentrayBody(
  multi: CodeBrowserMultiAngleBrowsing | undefined,
  intro: string,
  fileMarkdown: string,
): string {
  if (multi) {
    return (
      (multi.angles.find((a) => a.id === multi.defaultAngleId) ?? multi.angles[0])?.markdown ??
      emptyCommentrayMarkdown()
    );
  }
  return composeCommentrayMarkdown(intro, fileMarkdown);
}

export function pickDefaultCommentrayRel(
  multi: CodeBrowserMultiAngleBrowsing | undefined,
  commentrayMarkdownFile: string,
): string {
  if (multi) {
    return (
      (multi.angles.find((a) => a.id === multi.defaultAngleId) ?? multi.angles[0])
        ?.commentrayPathRel ?? ""
    );
  }
  return commentrayMarkdownFile ?? "";
}

/**
 * Resolves index-backed block scroll wiring for one documented source ↔ commentray path.
 * Used for static per-pair browse pages (and the flat hub when multi-angle is off).
 */
export function blockStretchRowsForDocumentedPair(
  projectIndex: CommentrayIndex | null,
  sourcePath: string,
  commentrayPathRel: string,
): BuildCommentrayStaticOptions["blockStretchRows"] {
  const rel = commentrayPathRel.trim();
  if (!projectIndex || rel.length === 0) return undefined;
  const entry = projectIndex.byCommentrayPath[rel];
  if (!entry || entry.blocks.length === 0 || entry.sourcePath !== sourcePath) return undefined;
  return {
    index: projectIndex,
    sourceRelative: entry.sourcePath,
    commentrayPathRel: rel,
  };
}

export function flatBlockStretchRows(
  projectIndex: CommentrayIndex | null,
  ss: ResolvedStaticSite,
  hasMultiAngle: boolean,
): BuildCommentrayStaticOptions["blockStretchRows"] {
  const sourceLower = ss.sourceFile.trim().toLowerCase();
  const sourceIsMarkdown =
    sourceLower.endsWith(".md") ||
    sourceLower.endsWith(".mdx") ||
    sourceLower.endsWith(".markdown");
  if (hasMultiAngle || !ss.commentrayMarkdownFile || sourceIsMarkdown) return undefined;
  return blockStretchRowsForDocumentedPair(projectIndex, ss.sourceFile, ss.commentrayMarkdownFile);
}

export function sourceAndCommentrayGithubUrls(
  ghNavBase: GithubNavBase | null,
  ss: ResolvedStaticSite,
  defaultCommentrayRel: string,
): { sourceOnGithubUrl?: string; commentrayOnGithubUrl?: string; documentedNavJsonUrl?: string } {
  const nav: {
    sourceOnGithubUrl?: string;
    commentrayOnGithubUrl?: string;
    documentedNavJsonUrl?: string;
  } = {
    documentedNavJsonUrl: "./commentray-nav-search.json",
  };
  if (ghNavBase === null) {
    return nav;
  }
  const sourceOnGithubUrl = githubRepoBlobFileUrl(
    ghNavBase.owner,
    ghNavBase.repo,
    ghNavBase.branch,
    ss.sourceFile,
  );
  const commentrayOnGithubUrl = defaultCommentrayRel
    ? githubRepoBlobFileUrl(ghNavBase.owner, ghNavBase.repo, ghNavBase.branch, defaultCommentrayRel)
    : undefined;
  return {
    ...nav,
    sourceOnGithubUrl,
    ...(commentrayOnGithubUrl ? { commentrayOnGithubUrl } : {}),
  };
}
