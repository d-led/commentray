import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommentrayIndex } from "@commentray/core";
import {
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
  /** Shown as “Rendered with Commentray” in the toolbar (`http`/`https` only). */
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
};

const staticPackageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultGeneratorLabel(): string {
  const raw = readFileSync(path.join(staticPackageDir, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string; name?: string };
  const name = pkg.name ?? "@commentray/code-commentray-static";
  const sv = pkg.version ?? "0.0.0";
  return `Commentray @commentray/render@${commentrayRenderVersion()}; ${name}@${sv}`;
}

function resolveGeneratorLabel(explicit: string | undefined): string | undefined {
  if (explicit !== undefined) {
    const t = explicit.trim();
    return t.length > 0 ? t : undefined;
  }
  return defaultGeneratorLabel();
}

export async function buildCommentrayStatic(opts: BuildCommentrayStaticOptions): Promise<void> {
  const sourcePath = path.resolve(opts.sourceFile);
  const mdPath = path.resolve(opts.markdownFile);
  const outPath = path.resolve(opts.outHtml);

  const code = await readFile(sourcePath, "utf8");
  const commentrayMarkdown = await readFile(mdPath, "utf8");
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
    generatorLabel: resolveGeneratorLabel(opts.generatorLabel),
    staticSearchScope: opts.staticSearchScope,
    commentrayPathForSearch: opts.commentrayPathForSearch,
    blockStretchRows: opts.blockStretchRows,
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}
