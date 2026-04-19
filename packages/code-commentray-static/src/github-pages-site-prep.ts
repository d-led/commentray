import { readFile } from "node:fs/promises";
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
} from "@commentray/core";
import {
  browsePageSlugFromPair,
  type CodeBrowserMultiAngleBrowsing,
  type CodeBrowserMultiAngleSpec,
} from "@commentray/render";

import type { BuildCommentrayStaticOptions } from "./build.js";
import { composeCommentrayMarkdown, pathExists } from "./github-pages-site-shared.js";

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
    if (entry && entry.blocks.length > 0 && entry.sourcePath === ss.sourceFile) {
      angleBlockStretch = {
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
  const staticBrowseUrl = `./browse/${browsePageSlugFromPair({ sourcePath: ss.sourceFile, commentrayPath: rel })}.html`;
  return {
    id: def.id,
    title: def.title,
    markdown: composed,
    commentrayPathRel: rel,
    commentrayOnGithubUrl,
    staticBrowseUrl,
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
  return { defaultAngleId: defaultAngleIdForOpen(cfg), angles };
}

export async function readFlatCompanionMarkdown(
  repoRoot: string,
  ss: ResolvedStaticSite,
): Promise<string> {
  if (!ss.commentrayMarkdownFile) return "";
  const mdAbs = path.join(repoRoot, ss.commentrayMarkdownFile);
  if (!(await pathExists(mdAbs))) {
    throw new Error(`static_site.commentray_markdown not found: ${ss.commentrayMarkdownFile}`);
  }
  return readFile(mdAbs, "utf8");
}

export function pickCommentrayBody(
  multi: CodeBrowserMultiAngleBrowsing | undefined,
  intro: string,
  fileMarkdown: string,
): string {
  if (multi) {
    return (
      (multi.angles.find((a) => a.id === multi.defaultAngleId) ?? multi.angles[0])?.markdown ??
      "_No commentray content configured._\n"
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

export function flatBlockStretchRows(
  projectIndex: CommentrayIndex | null,
  ss: ResolvedStaticSite,
  hasMultiAngle: boolean,
): BuildCommentrayStaticOptions["blockStretchRows"] {
  if (hasMultiAngle || !projectIndex || !ss.commentrayMarkdownFile) return undefined;
  const entry = projectIndex.byCommentrayPath[ss.commentrayMarkdownFile];
  if (!entry || entry.blocks.length === 0 || entry.sourcePath !== ss.sourceFile) return undefined;
  return {
    index: projectIndex,
    sourceRelative: entry.sourcePath,
    commentrayPathRel: ss.commentrayMarkdownFile,
  };
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
