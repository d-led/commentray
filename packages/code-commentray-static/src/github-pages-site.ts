import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
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
  COMMENTRAY_STATIC_COMPANION_ASSETS_SEGMENT,
  type CodeBrowserMultiAngleBrowsing,
  type CommentrayNavSearchDocument,
  type CommentrayStaticAssetCopy,
  browsePageSlugFromPair,
  buildCommentrayNavSearchDocument,
} from "@commentray/render";

import { type BuildCommentrayStaticOptions, buildCommentrayStatic } from "./build.js";
import {
  blockStretchRowsForDocumentedPair,
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
import {
  browsePairStaticBrowseRelUrl,
  commentrayFileStem,
  humanBrowseAliasPathFromPair,
  normPosixPath,
  sourceBrowseAliasPath,
} from "./browse-pair-static-url.js";

const DEFAULT_TOOL_HOME = "https://github.com/d-led/commentray";

async function writeHumanBrowseAliasDirIndex(input: {
  outDir: string;
  aliasRelPath: string;
  slug: string;
}): Promise<void> {
  const aliasDir = path.join(input.outDir, "browse", ...input.aliasRelPath.split("/"));
  await mkdir(aliasDir, { recursive: true });
  const aliasPath = path.join(aliasDir, "index.html");
  const canonicalRelFromAliasPath = path.posix.relative(
    path.posix.join("browse", input.aliasRelPath),
    path.posix.join("browse", `${input.slug}.html`),
  );
  const canonicalHref = canonicalRelFromAliasPath || `../${input.slug}.html`;
  const redirectHtml = `<!doctype html>
<meta charset="utf-8" />
<title>Redirecting…</title>
<meta http-equiv="refresh" content="0;url=${canonicalHref}" />
<script>
  (function () {
    var to = ${JSON.stringify(canonicalHref)};
    var suffix = window.location.search + window.location.hash;
    window.location.replace(to + suffix);
  })();
</script>
<a href="${canonicalHref}">Open documentation pair</a>
`;
  await writeFile(aliasPath, redirectHtml, "utf8");
}

async function writeHumanBrowseAliasHtmlFile(input: {
  outDir: string;
  aliasRelPath: string;
  slug: string;
}): Promise<void> {
  const aliasPath = path.join(input.outDir, "browse", ...input.aliasRelPath.split("/"));
  await mkdir(path.dirname(aliasPath), { recursive: true });
  const canonicalRelFromAliasPath = path.posix.relative(
    path.posix.dirname(path.posix.join("browse", input.aliasRelPath)),
    path.posix.join("browse", `${input.slug}.html`),
  );
  const canonicalHref = canonicalRelFromAliasPath || `./${input.slug}.html`;
  const redirectHtml = `<!doctype html>
<meta charset="utf-8" />
<title>Redirecting…</title>
<meta http-equiv="refresh" content="0;url=${canonicalHref}" />
<script>
  (function () {
    var to = ${JSON.stringify(canonicalHref)};
    var suffix = window.location.search + window.location.hash;
    window.location.replace(to + suffix);
  })();
</script>
<a href="${canonicalHref}">Open documentation pair</a>
`;
  await writeFile(aliasPath, redirectHtml, "utf8");
}

async function writeHumanBrowseSourceAliasPage(input: {
  outDir: string;
  sourcePath: string;
  slug: string;
}): Promise<void> {
  await writeHumanBrowseAliasDirIndex({
    outDir: input.outDir,
    aliasRelPath: sourceBrowseAliasPath(input.sourcePath),
    slug: input.slug,
  });
}

function sourcePathCountsFromPairs(pairs: Array<{ sourcePath: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of pairs) {
    const key = normPosixPath(p.sourcePath);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function preferredSourceAliasAngleId(input: {
  cfg: ResolvedCommentrayConfig;
  ss: ResolvedStaticSite;
}): string {
  return (input.ss.defaultAngleId ?? input.cfg.angles.defaultAngleId ?? "main").trim();
}

function preferredSourceAliasTarget(
  choices: Array<{ slug: string; angleId: string; sourcePath: string }>,
  preferredAngleId: string,
): { slug: string; angleId: string; sourcePath: string } | undefined {
  return (
    choices.find((c) => c.angleId === preferredAngleId) ??
    choices.find((c) => c.angleId === "main") ??
    choices[0]
  );
}

function staticSourceLinkPrefix(
  ss: ResolvedStaticSite,
  ghNavBase: GithubNavBase | null,
  relativeGithubBlobLinks: boolean,
): string | undefined {
  const explicit = ss.sourceLinkPrefix?.trim();
  if (explicit) return explicit;
  if (!relativeGithubBlobLinks) return undefined;
  if (!ghNavBase) return undefined;
  return `https://github.com/${encodeURIComponent(ghNavBase.owner)}/${encodeURIComponent(
    ghNavBase.repo,
  )}/blob/${encodeURIComponent(ghNavBase.branch)}`;
}

async function writePreferredSourceAliasPages(input: {
  outDir: string;
  sourceAliasTargets: Map<string, Array<{ slug: string; angleId: string; sourcePath: string }>>;
  preferredAngleId: string;
}): Promise<void> {
  for (const [, choices] of input.sourceAliasTargets) {
    const preferred = preferredSourceAliasTarget(choices, input.preferredAngleId);
    if (!preferred) continue;
    await writeHumanBrowseSourceAliasPage({
      outDir: input.outDir,
      sourcePath: preferred.sourcePath,
      slug: preferred.slug,
    });
  }
}

function browseCommentrayOutputUrls(input: {
  repoRoot: string;
  outPath: string;
  markdownUrlBaseDirAbs: string;
  cfg: ResolvedCommentrayConfig;
  outDir: string;
  companionStaticAssetCopies: CommentrayStaticAssetCopy[];
  sourceLinkPrefix: string | undefined;
}) {
  return {
    repoRootAbs: input.repoRoot,
    htmlOutputFileAbs: input.outPath,
    markdownUrlBaseDirAbs: input.markdownUrlBaseDirAbs,
    commentrayStorageRootAbs: path.resolve(
      input.repoRoot,
      input.cfg.storageDir.replaceAll("\\", "/"),
    ),
    staticSiteOutDirAbs: input.outDir,
    companionStaticAssetCopies: input.companionStaticAssetCopies,
    sourceLinkPrefix: input.sourceLinkPrefix,
  };
}

function dualBlockStretchBrowseOpts(
  projectIndex: CommentrayIndex | null,
  p: { sourcePath: string; commentrayPath: string },
): Pick<BuildCommentrayStaticOptions, "blockStretchRows" | "codeBrowserLayout"> | undefined {
  const blockStretchRows = blockStretchRowsForDocumentedPair(
    projectIndex,
    p.sourcePath,
    p.commentrayPath,
  );
  if (!blockStretchRows) return undefined;
  return { blockStretchRows, codeBrowserLayout: "dual" };
}

async function writeBrowseAliasesAfterStaticHtml(input: {
  outDir: string;
  pair: { sourcePath: string; commentrayPath: string };
  slug: string;
  sourcePathCounts: Map<string, number>;
  sourceAliasTargets: Map<string, Array<{ slug: string; angleId: string; sourcePath: string }>>;
}): Promise<void> {
  const p = input.pair;
  const sourceKey = normPosixPath(p.sourcePath);
  const duplicateCount = input.sourcePathCounts.get(sourceKey) ?? 1;
  const aliasRelPath = humanBrowseAliasPathFromPair(p, duplicateCount);
  if (duplicateCount > 1) {
    await writeHumanBrowseAliasHtmlFile({
      outDir: input.outDir,
      aliasRelPath: `${aliasRelPath}.html`,
      slug: input.slug,
    });
  } else {
    await writeHumanBrowseAliasDirIndex({
      outDir: input.outDir,
      aliasRelPath,
      slug: input.slug,
    });
  }
  if (duplicateCount <= 1) return;
  const angleId = commentrayFileStem(p.commentrayPath);
  const cur = input.sourceAliasTargets.get(sourceKey) ?? [];
  cur.push({ slug: input.slug, angleId, sourcePath: p.sourcePath });
  input.sourceAliasTargets.set(sourceKey, cur);
}

async function writeBrowsePageForPair(input: {
  repoRoot: string;
  outDir: string;
  browseDir: string;
  pair: {
    sourcePath: string;
    commentrayPath: string;
    sourceOnGithub?: string;
    commentrayOnGithub?: string;
    staticBrowseUrl?: string;
  };
  cfg: ResolvedCommentrayConfig;
  ss: ResolvedStaticSite;
  toolHomeUrl: string;
  builtAt: Date;
  pagesBuildCommitSha: string | undefined;
  projectIndex: CommentrayIndex | null;
  ghNavBase: GithubNavBase | null;
  documentedPairsEmbeddedB64?: string;
  sourcePathCounts: Map<string, number>;
  sourceAliasTargets: Map<string, Array<{ slug: string; angleId: string; sourcePath: string }>>;
}): Promise<void> {
  const p = input.pair;
  const slug = browsePageSlugFromPair(p);
  const outPath = path.join(input.browseDir, `${slug}.html`);
  const sourceAbs = resolvePathUnderRepoRoot(input.repoRoot, p.sourcePath);
  const mdAbs = resolvePathUnderRepoRoot(input.repoRoot, p.commentrayPath);
  if (!(await pathExists(mdAbs)) || !(await pathExists(sourceAbs))) return;

  const markdownUrlBaseDirAbs = path.dirname(mdAbs);
  const companionStaticAssetCopies: CommentrayStaticAssetCopy[] = [];
  const commentrayOutputUrls = browseCommentrayOutputUrls({
    repoRoot: input.repoRoot,
    outPath,
    markdownUrlBaseDirAbs,
    cfg: input.cfg,
    outDir: input.outDir,
    companionStaticAssetCopies,
    sourceLinkPrefix: staticSourceLinkPrefix(
      input.ss,
      input.ghNavBase,
      input.cfg.render.relativeGithubBlobLinks,
    ),
  });
  const multiAngleBrowsing = await multiAngleBrowsingForBrowsePair(
    input.repoRoot,
    input.cfg,
    input.ss,
    input.projectIndex,
    input.ghNavBase,
    p,
  );
  const dualStretchOpts = dualBlockStretchBrowseOpts(input.projectIndex, p);
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
    relatedGithubNav: input.ss.relatedGithubNav.length > 0 ? input.ss.relatedGithubNav : undefined,
    staticSearchScope: "commentray-and-paths",
    commentrayPathForSearch,
    ...(multiAngleBrowsing ? { multiAngleBrowsing } : {}),
    ...(dualStretchOpts ?? {}),
    ...(p.sourceOnGithub ? { sourceOnGithubUrl: p.sourceOnGithub } : {}),
    ...(p.commentrayOnGithub ? { commentrayOnGithubUrl: p.commentrayOnGithub } : {}),
    /** Hub-relative; client resolves from `/browse/…` so the Doc icon never stacks `/browse/browse/`. */
    commentrayStaticBrowseUrl: p.staticBrowseUrl,
    documentedNavJsonUrl: "../commentray-nav-search.json",
    builtAt: input.builtAt,
    ...(input.documentedPairsEmbeddedB64
      ? { documentedPairsEmbeddedB64: input.documentedPairsEmbeddedB64 }
      : {}),
    ...(input.pagesBuildCommitSha ? { pagesBuildCommitSha: input.pagesBuildCommitSha } : {}),
  });
  await writeBrowseAliasesAfterStaticHtml({
    outDir: input.outDir,
    pair: p,
    slug,
    sourcePathCounts: input.sourcePathCounts,
    sourceAliasTargets: input.sourceAliasTargets,
  });
}

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
  pagesBuildCommitSha: string | undefined;
  projectIndex: CommentrayIndex | null;
  ghNavBase: GithubNavBase | null;
}): Promise<CommentrayNavSearchDocument> {
  const pairs = input.navDoc.documentedPairs;
  if (!pairs?.length) return input.navDoc;

  const sourcePathCounts = sourcePathCountsFromPairs(pairs);
  const augmented = pairs.map((p) => ({
    ...p,
    staticBrowseUrl: browsePairStaticBrowseRelUrl(
      p,
      sourcePathCounts.get(normPosixPath(p.sourcePath)) ?? 1,
    ),
  }));
  const navWithUrls: CommentrayNavSearchDocument = { ...input.navDoc, documentedPairs: augmented };
  const emb = documentedPairsEmbeddedB64FromNav(navWithUrls);

  const browseDir = path.join(input.outDir, "browse");
  await mkdir(browseDir, { recursive: true });
  const sourceAliasTargets = new Map<
    string,
    Array<{ slug: string; angleId: string; sourcePath: string }>
  >();
  const preferredSourceAngleId = preferredSourceAliasAngleId({
    cfg: input.cfg,
    ss: input.ss,
  });

  for (const p of augmented) {
    await writeBrowsePageForPair({
      repoRoot: input.repoRoot,
      outDir: input.outDir,
      browseDir,
      pair: p,
      cfg: input.cfg,
      ss: input.ss,
      toolHomeUrl: input.toolHomeUrl,
      builtAt: input.builtAt,
      pagesBuildCommitSha: input.pagesBuildCommitSha,
      projectIndex: input.projectIndex,
      ghNavBase: input.ghNavBase,
      documentedPairsEmbeddedB64: emb,
      sourcePathCounts,
      sourceAliasTargets,
    });
  }

  await writePreferredSourceAliasPages({
    outDir: input.outDir,
    sourceAliasTargets,
    preferredAngleId: preferredSourceAngleId,
  });

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
  pagesBuildCommitSha: string | undefined;
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
    ...(input.pagesBuildCommitSha ? { pagesBuildCommitSha: input.pagesBuildCommitSha } : {}),
  };
}

export type BuildGithubPagesStaticSiteOptions = {
  repoRoot: string;
  /** Footer “Rendered with …” link; defaults to the public Commentray repository. */
  toolHomeUrl?: string;
  /**
   * Git commit SHA for this build (7–40 hex), shown in the footer on every static page.
   * Omit for local builds; CI sets this via `COMMENTRAY_PAGES_BUILD_SHA` / workflow env.
   */
  pagesBuildCommitSha?: string;
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
  pagesBuildCommitSha: string | undefined;
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
  await rm(path.join(input.outDir, COMMENTRAY_STATIC_COMPANION_ASSETS_SEGMENT), {
    recursive: true,
    force: true,
  });
  await rm(path.join(input.outDir, "browse"), {
    recursive: true,
    force: true,
  });
  if (Array.isArray(navDoc.documentedPairs) && navDoc.documentedPairs.length > 0) {
    navDoc = await writePerPairBrowseHtmlPages({
      repoRoot: input.repoRoot,
      outDir: input.outDir,
      navDoc,
      cfg: input.cfg,
      ss: input.ss,
      toolHomeUrl: input.toolHomeUrl,
      builtAt: input.builtAt,
      pagesBuildCommitSha: input.pagesBuildCommitSha,
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
    pagesBuildCommitSha: input.pagesBuildCommitSha,
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
  const pagesBuildCommitSha = opts.pagesBuildCommitSha?.trim();
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
    sourceLinkPrefix: staticSourceLinkPrefix(ss, ghNavBase, cfg.render.relativeGithubBlobLinks),
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
      pagesBuildCommitSha: pagesBuildCommitSha || undefined,
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
