import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  type CommentrayIndex,
  type ResolvedCommentrayConfig,
  type ResolvedStaticSite,
  loadCommentrayConfig,
  readIndex,
  resolvePathUnderRepoRoot,
} from "@commentray/core";
import {
  type CodeBrowserMultiAngleBrowsing,
  type CommentrayNavSearchDocument,
  type CommentrayStaticAssetCopy,
  browsePageSlugFromPair,
  buildCommentrayNavSearchDocument,
} from "@commentray/render";

import { type BuildCommentrayStaticOptions, buildCommentrayStatic } from "./build.js";
import {
  flatBlockStretchRows,
  type GithubNavBase,
  loadMultiAngleBrowsingIfEnabled,
  pickCommentrayBody,
  pickDefaultCommentrayRel,
  readFlatCompanionMarkdown,
  resolveGithubNavBase,
  sourceAndCommentrayGithubUrls,
} from "./github-pages-site-prep.js";
import { pathExists } from "./github-pages-site-shared.js";

const DEFAULT_TOOL_HOME = "https://github.com/d-led/commentray";

async function multiAngleBrowsingForBrowsePair(
  repoRoot: string,
  cfg: ResolvedCommentrayConfig,
  ss: ResolvedStaticSite,
  projectIndex: CommentrayIndex | null,
  ghNavBase: GithubNavBase | null,
  pair: { sourcePath: string; commentrayPath: string },
): Promise<CodeBrowserMultiAngleBrowsing | undefined> {
  const multiForSource = await loadMultiAngleBrowsingIfEnabled(
    repoRoot,
    cfg,
    { ...ss, sourceFile: pair.sourcePath },
    projectIndex,
    ghNavBase,
  );
  if (!multiForSource) return undefined;
  const angleForPair = multiForSource.angles.find(
    (a) => a.commentrayPathRel === pair.commentrayPath,
  );
  return {
    ...multiForSource,
    defaultAngleId: angleForPair?.id ?? multiForSource.defaultAngleId,
  };
}

/**
 * Emits one static code browser HTML per documented pair under `_site/browse/*.html` and adds
 * `staticBrowseUrl` on each pair so the hub search can open the same Commentray UI for other files.
 */
async function writePerPairBrowseHtmlPages(input: {
  repoRoot: string;
  outDir: string;
  navDoc: CommentrayNavSearchDocument;
  cfg: ResolvedCommentrayConfig;
  ss: ResolvedStaticSite;
  toolHomeUrl: string;
  builtAt: Date;
  projectIndex: CommentrayIndex | null;
  ghNavBase: GithubNavBase | null;
}): Promise<CommentrayNavSearchDocument> {
  const pairs = input.navDoc.documentedPairs;
  if (!pairs?.length) return input.navDoc;

  const augmented = pairs.map((p) => ({
    ...p,
    staticBrowseUrl: `./browse/${browsePageSlugFromPair(p)}.html`,
  }));
  const navWithUrls: CommentrayNavSearchDocument = { ...input.navDoc, documentedPairs: augmented };
  const emb = documentedPairsEmbeddedB64FromNav(navWithUrls);

  const browseDir = path.join(input.outDir, "browse");
  await mkdir(browseDir, { recursive: true });

  for (const p of augmented) {
    const slug = browsePageSlugFromPair(p);
    const outPath = path.join(browseDir, `${slug}.html`);
    const sourceAbs = resolvePathUnderRepoRoot(input.repoRoot, p.sourcePath);
    const mdAbs = resolvePathUnderRepoRoot(input.repoRoot, p.commentrayPath);
    if (!(await pathExists(mdAbs)) || !(await pathExists(sourceAbs))) continue;

    const markdownUrlBaseDirAbs = path.dirname(mdAbs);
    const commentrayStorageRootAbs = path.resolve(
      input.repoRoot,
      input.cfg.storageDir.replaceAll("\\", "/"),
    );
    const companionStaticAssetCopies: CommentrayStaticAssetCopy[] = [];
    const commentrayOutputUrls = {
      repoRootAbs: input.repoRoot,
      htmlOutputFileAbs: outPath,
      markdownUrlBaseDirAbs,
      commentrayStorageRootAbs,
      staticSiteOutDirAbs: input.outDir,
      companionStaticAssetCopies,
    };

    const multiAngleBrowsing = await multiAngleBrowsingForBrowsePair(
      input.repoRoot,
      input.cfg,
      input.ss,
      input.projectIndex,
      input.ghNavBase,
      p,
    );
    const commentrayPathForSearch = pickDefaultCommentrayRel(multiAngleBrowsing, p.commentrayPath);

    await buildCommentrayStatic({
      sourceFile: sourceAbs,
      markdownFile: mdAbs,
      outHtml: outPath,
      title: p.sourcePath,
      filePath: p.sourcePath,
      includeMermaidRuntime: input.cfg.render.mermaid,
      hljsTheme: input.cfg.render.syntaxTheme,
      siteHubUrl: "../index.html",
      toolHomeUrl: input.toolHomeUrl,
      commentrayOutputUrls,
      relatedGithubNav:
        input.ss.relatedGithubNav.length > 0 ? input.ss.relatedGithubNav : undefined,
      staticSearchScope: "commentray-and-paths",
      commentrayPathForSearch,
      ...(multiAngleBrowsing ? { multiAngleBrowsing } : {}),
      ...(p.sourceOnGithub ? { sourceOnGithubUrl: p.sourceOnGithub } : {}),
      ...(p.commentrayOnGithub ? { commentrayOnGithubUrl: p.commentrayOnGithub } : {}),
      /** Hub-relative; client resolves from `/browse/…` so the Doc icon never stacks `/browse/browse/`. */
      commentrayStaticBrowseUrl: p.staticBrowseUrl,
      documentedNavJsonUrl: "../commentray-nav-search.json",
      builtAt: input.builtAt,
      ...(emb ? { documentedPairsEmbeddedB64: emb } : {}),
    });
  }

  return navWithUrls;
}

function documentedPairsEmbeddedB64FromNav(
  navDoc: CommentrayNavSearchDocument,
): string | undefined {
  if (!Array.isArray(navDoc.documentedPairs) || navDoc.documentedPairs.length === 0) {
    return undefined;
  }
  return Buffer.from(JSON.stringify(navDoc.documentedPairs), "utf8").toString("base64");
}

function staticBrowseUrlForConfiguredPair(
  navDoc: CommentrayNavSearchDocument,
  sourceFile: string,
  commentrayRel: string,
): string | undefined {
  const pairs = navDoc.documentedPairs;
  if (!pairs?.length || commentrayRel.length === 0) return undefined;
  const hit = pairs.find((p) => p.sourcePath === sourceFile && p.commentrayPath === commentrayRel);
  const u = hit?.staticBrowseUrl?.trim();
  return u && u.length > 0 ? u : undefined;
}

function staticRenderOptions(input: {
  sourceAbs: string;
  tmpMd: string;
  outHtml: string;
  ss: ResolvedStaticSite;
  cfg: ResolvedCommentrayConfig;
  toolHomeUrl: string;
  builtAt: Date;
  commentrayOutputUrls: NonNullable<BuildCommentrayStaticOptions["commentrayOutputUrls"]>;
  blockStretchRows: BuildCommentrayStaticOptions["blockStretchRows"];
  multiAngleBrowsing: CodeBrowserMultiAngleBrowsing | undefined;
  ghToolbar: ReturnType<typeof sourceAndCommentrayGithubUrls>;
  defaultCommentrayRel: string;
  documentedPairsEmbeddedB64: string | undefined;
  commentrayStaticBrowseUrl?: string;
}): BuildCommentrayStaticOptions {
  return {
    sourceFile: input.sourceAbs,
    markdownFile: input.tmpMd,
    outHtml: input.outHtml,
    title: input.ss.title,
    filePath: input.ss.sourceFile,
    includeMermaidRuntime: input.cfg.render.mermaid,
    hljsTheme: input.cfg.render.syntaxTheme,
    siteHubUrl: "./",
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
    ...(input.commentrayStaticBrowseUrl
      ? { commentrayStaticBrowseUrl: input.commentrayStaticBrowseUrl }
      : {}),
    builtAt: input.builtAt,
  };
}

export type BuildGithubPagesStaticSiteOptions = {
  repoRoot: string;
  /** Footer “Rendered with …” link; defaults to the public Commentray repository. */
  toolHomeUrl?: string;
};

async function emitGithubPagesSiteArtifacts(input: {
  repoRoot: string;
  outDir: string;
  tmpMd: string;
  navDoc: CommentrayNavSearchDocument;
  cfg: ResolvedCommentrayConfig;
  ss: ResolvedStaticSite;
  toolHomeUrl: string;
  builtAt: Date;
  projectIndex: CommentrayIndex | null;
  ghNavBase: GithubNavBase | null;
  commentrayOutputUrls: NonNullable<BuildCommentrayStaticOptions["commentrayOutputUrls"]>;
  blockStretchRows: BuildCommentrayStaticOptions["blockStretchRows"];
  multiAngleBrowsing: CodeBrowserMultiAngleBrowsing | undefined;
  ghToolbar: ReturnType<typeof sourceAndCommentrayGithubUrls>;
  defaultCommentrayRel: string;
  sourceAbs: string;
  outHtml: string;
  navSearchPath: string;
}): Promise<CommentrayNavSearchDocument> {
  let { navDoc } = input;
  await mkdir(input.outDir, { recursive: true });
  if (Array.isArray(navDoc.documentedPairs) && navDoc.documentedPairs.length > 0) {
    navDoc = await writePerPairBrowseHtmlPages({
      repoRoot: input.repoRoot,
      outDir: input.outDir,
      navDoc,
      cfg: input.cfg,
      ss: input.ss,
      toolHomeUrl: input.toolHomeUrl,
      builtAt: input.builtAt,
      projectIndex: input.projectIndex,
      ghNavBase: input.ghNavBase,
    });
  }
  const documentedPairsEmbeddedB64 = documentedPairsEmbeddedB64FromNav(navDoc);
  const hubStaticBrowseUrl =
    input.defaultCommentrayRel.length > 0
      ? staticBrowseUrlForConfiguredPair(navDoc, input.ss.sourceFile, input.defaultCommentrayRel)
      : undefined;

  const staticOpts = staticRenderOptions({
    sourceAbs: input.sourceAbs,
    tmpMd: input.tmpMd,
    outHtml: input.outHtml,
    ss: input.ss,
    cfg: input.cfg,
    toolHomeUrl: input.toolHomeUrl,
    builtAt: input.builtAt,
    commentrayOutputUrls: input.commentrayOutputUrls,
    blockStretchRows: input.blockStretchRows,
    multiAngleBrowsing: input.multiAngleBrowsing,
    ghToolbar: input.ghToolbar,
    defaultCommentrayRel: input.defaultCommentrayRel,
    documentedPairsEmbeddedB64,
    commentrayStaticBrowseUrl: hubStaticBrowseUrl,
  });

  await buildCommentrayStatic(staticOpts);
  await writeFile(input.navSearchPath, `${JSON.stringify(navDoc, null, 2)}\n`, "utf8");
  return navDoc;
}

/**
 * Builds `_site/index.html` and `commentray-nav-search.json` from `.commentray.toml` `[static_site]`
 * (same behaviour as `scripts/build-static-pages.mjs`).
 */
export async function buildGithubPagesStaticSite(
  opts: BuildGithubPagesStaticSiteOptions,
): Promise<{ outHtml: string; navSearchPath: string }> {
  const repoRoot = path.resolve(opts.repoRoot);
  const toolHomeUrl = opts.toolHomeUrl?.trim() || DEFAULT_TOOL_HOME;
  const builtAt = new Date();

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

  const commentrayStorageRootAbs = path.resolve(repoRoot, cfg.storageDir.replaceAll("\\", "/"));
  const companionStaticAssetCopies: CommentrayStaticAssetCopy[] = [];
  const commentrayOutputUrls = {
    repoRootAbs: repoRoot,
    htmlOutputFileAbs: outHtml,
    markdownUrlBaseDirAbs,
    commentrayStorageRootAbs,
    staticSiteOutDirAbs: outDir,
    companionStaticAssetCopies,
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

  try {
    await emitGithubPagesSiteArtifacts({
      repoRoot,
      outDir,
      tmpMd,
      navDoc,
      cfg,
      ss,
      toolHomeUrl,
      builtAt,
      projectIndex,
      ghNavBase,
      commentrayOutputUrls,
      blockStretchRows,
      multiAngleBrowsing,
      ghToolbar,
      defaultCommentrayRel,
      sourceAbs,
      outHtml,
      navSearchPath,
    });
  } finally {
    await unlink(tmpMd).catch(() => {});
  }

  return { outHtml, navSearchPath };
}
