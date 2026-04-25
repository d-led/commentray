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

function normPosixPath(s: string): string {
  return s.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function commentrayFileStem(commentrayPath: string): string {
  const norm = normPosixPath(commentrayPath);
  const last = norm.split("/").filter(Boolean).at(-1) ?? "commentray";
  return last.replace(/\.md$/i, "");
}

function sourceBrowseAliasPath(sourcePath: string): string {
  const sourceSegments = normPosixPath(sourcePath)
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg));
  return sourceSegments.length > 0 ? sourceSegments.join("/") : "pair";
}

function humanBrowseAliasPathFromPair(
  pair: { sourcePath: string; commentrayPath: string },
  sourcePathDuplicateCount: number,
): string {
  const sourceAlias = sourceBrowseAliasPath(pair.sourcePath);
  if (sourceAlias === "pair") {
    return sourcePathDuplicateCount > 1
      ? `pair@${encodeURIComponent(commentrayFileStem(pair.commentrayPath))}`
      : "pair";
  }
  if (sourcePathDuplicateCount <= 1) return sourceAlias;
  return `${sourceAlias}@${encodeURIComponent(commentrayFileStem(pair.commentrayPath))}`;
}

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
    relatedGithubNav: input.ss.relatedGithubNav.length > 0 ? input.ss.relatedGithubNav : undefined,
    staticSearchScope: "commentray-and-paths",
    commentrayPathForSearch,
    ...(multiAngleBrowsing ? { multiAngleBrowsing } : {}),
    ...(p.sourceOnGithub ? { sourceOnGithubUrl: p.sourceOnGithub } : {}),
    ...(p.commentrayOnGithub ? { commentrayOnGithubUrl: p.commentrayOnGithub } : {}),
    /** Hub-relative; client resolves from `/browse/…` so the Doc icon never stacks `/browse/browse/`. */
    commentrayStaticBrowseUrl: p.staticBrowseUrl,
    documentedNavJsonUrl: "../commentray-nav-search.json",
    builtAt: input.builtAt,
    ...(input.documentedPairsEmbeddedB64
      ? { documentedPairsEmbeddedB64: input.documentedPairsEmbeddedB64 }
      : {}),
  });
  const sourceKey = normPosixPath(p.sourcePath);
  const duplicateCount = input.sourcePathCounts.get(sourceKey) ?? 1;
  const aliasRelPath = humanBrowseAliasPathFromPair(p, duplicateCount);
  if (duplicateCount > 1) {
    await writeHumanBrowseAliasHtmlFile({
      outDir: input.outDir,
      aliasRelPath: `${aliasRelPath}.html`,
      slug,
    });
  } else {
    await writeHumanBrowseAliasDirIndex({
      outDir: input.outDir,
      aliasRelPath,
      slug,
    });
  }
  if (duplicateCount <= 1) return;
  const angleId = commentrayFileStem(p.commentrayPath);
  const cur = input.sourceAliasTargets.get(sourceKey) ?? [];
  cur.push({ slug, angleId, sourcePath: p.sourcePath });
  input.sourceAliasTargets.set(sourceKey, cur);
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
  const sourceAliasTargets = new Map<
    string,
    Array<{ slug: string; angleId: string; sourcePath: string }>
  >();
  const sourcePathCounts = sourcePathCountsFromPairs(augmented);
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
