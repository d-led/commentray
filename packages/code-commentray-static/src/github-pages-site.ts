import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  type ResolvedCommentrayConfig,
  type ResolvedStaticSite,
  loadCommentrayConfig,
  readIndex,
} from "@commentray/core";
import {
  type CodeBrowserMultiAngleBrowsing,
  type CommentrayNavSearchDocument,
  buildCommentrayNavSearchDocument,
} from "@commentray/render";

import { type BuildCommentrayStaticOptions, buildCommentrayStatic } from "./build.js";
import {
  type GithubNavBase,
  flatBlockStretchRows,
  loadMultiAngleBrowsingIfEnabled,
  pickCommentrayBody,
  pickDefaultCommentrayRel,
  readFlatCompanionMarkdown,
  resolveGithubNavBase,
  sourceAndCommentrayGithubUrls,
} from "./github-pages-site-prep.js";
import { pathExists } from "./github-pages-site-shared.js";

const DEFAULT_TOOL_HOME = "https://github.com/d-led/commentray";

function documentedPairsEmbeddedB64FromNav(
  navDoc: CommentrayNavSearchDocument,
  ghNavBase: GithubNavBase | null,
): string | undefined {
  if (
    ghNavBase === null ||
    !Array.isArray(navDoc.documentedPairs) ||
    navDoc.documentedPairs.length === 0
  ) {
    return undefined;
  }
  return Buffer.from(JSON.stringify(navDoc.documentedPairs), "utf8").toString("base64");
}

function staticRenderOptions(input: {
  sourceAbs: string;
  tmpMd: string;
  outHtml: string;
  ss: ResolvedStaticSite;
  cfg: ResolvedCommentrayConfig;
  toolHomeUrl: string;
  commentrayOutputUrls: NonNullable<BuildCommentrayStaticOptions["commentrayOutputUrls"]>;
  blockStretchRows: BuildCommentrayStaticOptions["blockStretchRows"];
  multiAngleBrowsing: CodeBrowserMultiAngleBrowsing | undefined;
  ghToolbar: ReturnType<typeof sourceAndCommentrayGithubUrls>;
  defaultCommentrayRel: string;
  documentedPairsEmbeddedB64: string | undefined;
}): BuildCommentrayStaticOptions {
  return {
    sourceFile: input.sourceAbs,
    markdownFile: input.tmpMd,
    outHtml: input.outHtml,
    title: input.ss.title,
    filePath: input.ss.sourceFile,
    includeMermaidRuntime: input.cfg.render.mermaid,
    hljsTheme: input.cfg.render.syntaxTheme,
    githubRepoUrl: input.ss.githubUrl ?? undefined,
    toolHomeUrl: input.toolHomeUrl,
    commentrayOutputUrls: input.commentrayOutputUrls,
    relatedGithubNav: input.ss.relatedGithubNav.length > 0 ? input.ss.relatedGithubNav : undefined,
    staticSearchScope: "commentray-and-paths",
    commentrayPathForSearch: input.defaultCommentrayRel,
    ...(input.blockStretchRows ? { blockStretchRows: input.blockStretchRows } : {}),
    ...(input.multiAngleBrowsing ? { multiAngleBrowsing: input.multiAngleBrowsing } : {}),
    ...(input.ghToolbar.sourceOnGithubUrl
      ? { sourceOnGithubUrl: input.ghToolbar.sourceOnGithubUrl }
      : {}),
    ...(input.ghToolbar.commentrayOnGithubUrl
      ? { commentrayOnGithubUrl: input.ghToolbar.commentrayOnGithubUrl }
      : {}),
    ...(input.ghToolbar.documentedNavJsonUrl
      ? { documentedNavJsonUrl: input.ghToolbar.documentedNavJsonUrl }
      : {}),
    ...(input.documentedPairsEmbeddedB64
      ? { documentedPairsEmbeddedB64: input.documentedPairsEmbeddedB64 }
      : {}),
  };
}

export type BuildGithubPagesStaticSiteOptions = {
  repoRoot: string;
  /** Toolbar “Rendered with …” link; defaults to the public Commentray repository. */
  toolHomeUrl?: string;
};

/**
 * Builds `_site/index.html` and `commentray-nav-search.json` from `.commentray.toml` `[static_site]`
 * (same behaviour as `scripts/build-static-pages.mjs`).
 */
export async function buildGithubPagesStaticSite(
  opts: BuildGithubPagesStaticSiteOptions,
): Promise<{ outHtml: string; navSearchPath: string }> {
  const repoRoot = path.resolve(opts.repoRoot);
  const toolHomeUrl = opts.toolHomeUrl?.trim() || DEFAULT_TOOL_HOME;

  const cfg = await loadCommentrayConfig(repoRoot);
  const ss = cfg.staticSite;

  const sourceAbs = path.join(repoRoot, ss.sourceFile);
  if (!(await pathExists(sourceAbs))) {
    throw new Error(`static_site.source_file not found: ${ss.sourceFile}`);
  }

  const projectIndex = await readIndex(repoRoot);
  const ghNavBase = resolveGithubNavBase(ss);
  const multiAngleBrowsing = await loadMultiAngleBrowsingIfEnabled(
    repoRoot,
    cfg,
    ss,
    projectIndex,
    ghNavBase,
  );
  const fileMarkdown = multiAngleBrowsing ? "" : await readFlatCompanionMarkdown(repoRoot, ss);
  const commentrayBody = pickCommentrayBody(multiAngleBrowsing, ss.introMarkdown, fileMarkdown);
  const tmpMd = path.join(tmpdir(), `commentray-pages-${process.pid}.md`);
  await writeFile(tmpMd, commentrayBody, "utf8");

  const outDir = path.join(repoRoot, "_site");
  const outHtml = path.join(outDir, "index.html");
  const defaultCommentrayRel = pickDefaultCommentrayRel(
    multiAngleBrowsing,
    ss.commentrayMarkdownFile,
  );
  const markdownUrlBaseDirAbs = defaultCommentrayRel
    ? path.join(repoRoot, path.dirname(defaultCommentrayRel))
    : repoRoot;

  const commentrayOutputUrls = {
    repoRootAbs: repoRoot,
    htmlOutputFileAbs: outHtml,
    markdownUrlBaseDirAbs,
  };

  const blockStretchRows = flatBlockStretchRows(projectIndex, ss, Boolean(multiAngleBrowsing));
  const ghToolbar = sourceAndCommentrayGithubUrls(ghNavBase, ss, defaultCommentrayRel);

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
  const documentedPairsEmbeddedB64 = documentedPairsEmbeddedB64FromNav(navDoc, ghNavBase);

  const staticOpts = staticRenderOptions({
    sourceAbs,
    tmpMd,
    outHtml,
    ss,
    cfg,
    toolHomeUrl,
    commentrayOutputUrls,
    blockStretchRows,
    multiAngleBrowsing,
    ghToolbar,
    defaultCommentrayRel,
    documentedPairsEmbeddedB64,
  });

  try {
    await mkdir(outDir, { recursive: true });
    await buildCommentrayStatic(staticOpts);
    await writeFile(navSearchPath, `${JSON.stringify(navDoc, null, 2)}\n`, "utf8");
  } finally {
    await unlink(tmpMd).catch(() => {});
  }

  return { outHtml, navSearchPath };
}
