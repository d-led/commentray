import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommentrayIndex } from "@commentray/core";
import {
  type CodeBrowserMultiAngleBrowsing,
  type CommentrayOutputUrlOptions,
  commentrayRenderVersion,
  renderCodeBrowserHtml,
} from "@commentray/render";

export type BuildCommentrayStaticOptions = {
  /** Absolute or cwd-relative path to the source file whose contents are shown as code. */
  sourceFile: string;
  /** Absolute or cwd-relative path to commentray Markdown. */
  markdownFile: string;
  /** Output HTML path (directories created as needed). */
  outHtml: string;
  title?: string;
  /**
   * Repo-relative path displayed prominently in the toolbar so viewers can see at a glance
   * which file they are looking at. Falls back to the source file's basename.
   */
  filePath?: string;
  includeMermaidRuntime?: boolean;
  /** Highlight.js theme base name (e.g. github, github-dark); forwarded to `renderCodeBrowserHtml`. */
  hljsTheme?: string;
  /** If set, toolbar shows an Octocat link to this repository (`http`/`https` only). */
  githubRepoUrl?: string;
  /** Toolbar "Rendered with Commentray" link plus semver (`http`/`https` only). */
  toolHomeUrl?: string;
  /** When set, rewrites local and GitHub blob links in commentray for static HTML output. */
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
  /** Optional toolbar links to other files on GitHub (forwarded to `renderCodeBrowserHtml`). */
  relatedGithubNav?: { label: string; href: string }[];
  /**
   * `<meta name="generator">` value. When omitted, a default is built from `@commentray/render` and
   * this package’s versions. Pass an empty string to omit the meta tag.
   */
  generatorLabel?: string;
  /**
   * Single clock for one static build (footer + default generator `builtAt=`). Defaults to
   * `new Date()` when omitted.
   */
  builtAt?: Date;
  /** Forwarded to `renderCodeBrowserHtml` — narrows in-page search away from raw code lines. */
  staticSearchScope?: "full" | "commentray-and-paths";
  /** Repo-relative companion Markdown path (with `staticSearchScope: "commentray-and-paths"`). */
  commentrayPathForSearch?: string;
  /**
   * When markers + index blocks align, `renderCodeBrowserHtml` may emit one scrollable
   * blame-style table (`codeBrowserLayout: "auto"`, default).
   */
  blockStretchRows?: {
    index: CommentrayIndex;
    sourceRelative: string;
    commentrayPathRel: string;
  };
  /** GitHub blob URL for the primary `filePath` (static hub toolbar). */
  sourceOnGithubUrl?: string;
  /** GitHub blob URL for the companion commentray Markdown file. */
  commentrayOnGithubUrl?: string;
  /** Same-site browse URL for the companion (e.g. `./browse/<slug>.html`); overrides GitHub for the Doc icon when set. */
  commentrayStaticBrowseUrl?: string;
  /** Relative URL to `commentray-nav-search.json` for the documented-files tree. */
  documentedNavJsonUrl?: string;
  /** Base64 UTF-8 JSON of `documentedPairs` embedded on `#shell` for offline tree hydration. */
  documentedPairsEmbeddedB64?: string;
  /** When set with two or more angles, renders an Angle switcher (GitHub Pages static hub). */
  multiAngleBrowsing?: CodeBrowserMultiAngleBrowsing;
};

const staticPackageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultGeneratorLabel(builtAt: Date): string {
  const raw = readFileSync(path.join(staticPackageDir, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string; name?: string };
  const name = pkg.name ?? "@commentray/code-commentray-static";
  const sv = pkg.version ?? "0.0.0";
  const iso = builtAt.toISOString();
  return `Commentray @commentray/render@${commentrayRenderVersion()}; ${name}@${sv}; builtAt=${iso}`;
}

function resolveGeneratorLabel(explicit: string | undefined, builtAt: Date): string | undefined {
  if (explicit !== undefined) {
    const t = explicit.trim();
    return t.length > 0 ? t : undefined;
  }
  return defaultGeneratorLabel(builtAt);
}

export async function buildCommentrayStatic(opts: BuildCommentrayStaticOptions): Promise<void> {
  const sourcePath = path.resolve(opts.sourceFile);
  const mdPath = path.resolve(opts.markdownFile);
  const outPath = path.resolve(opts.outHtml);
  const builtAt = opts.builtAt ?? new Date();

  const code = await readFile(sourcePath, "utf8");
  const multi = opts.multiAngleBrowsing;
  const commentrayMarkdown =
    multi && multi.angles.length >= 2
      ? ((multi.angles.find((a) => a.id === multi.defaultAngleId) ?? multi.angles[0])?.markdown ??
        (await readFile(mdPath, "utf8")))
      : await readFile(mdPath, "utf8");
  const ext = path.extname(sourcePath).slice(1) || "txt";
  const language = ext === "ts" ? "ts" : ext === "tsx" ? "tsx" : ext;

  const filePath = opts.filePath ?? path.basename(sourcePath);
  const html = await renderCodeBrowserHtml({
    title: opts.title ?? filePath,
    filePath,
    code,
    language,
    commentrayMarkdown,
    includeMermaidRuntime: opts.includeMermaidRuntime ?? false,
    hljsTheme: opts.hljsTheme,
    githubRepoUrl: opts.githubRepoUrl,
    toolHomeUrl: opts.toolHomeUrl,
    commentrayOutputUrls: opts.commentrayOutputUrls,
    relatedGithubNav: opts.relatedGithubNav,
    generatorLabel: resolveGeneratorLabel(opts.generatorLabel, builtAt),
    builtAt,
    staticSearchScope: opts.staticSearchScope,
    commentrayPathForSearch: opts.commentrayPathForSearch,
    blockStretchRows: opts.blockStretchRows,
    sourceOnGithubUrl: opts.sourceOnGithubUrl,
    commentrayOnGithubUrl: opts.commentrayOnGithubUrl,
    commentrayStaticBrowseUrl: opts.commentrayStaticBrowseUrl,
    documentedNavJsonUrl: opts.documentedNavJsonUrl,
    documentedPairsEmbeddedB64: opts.documentedPairsEmbeddedB64,
    multiAngleBrowsing: opts.multiAngleBrowsing,
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}
