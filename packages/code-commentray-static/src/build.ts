import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type GithubBlobLinkRewriteOptions, renderCodeBrowserHtml } from "@commentray/render";

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
  /** When set, rewrites matching GitHub links in companion Markdown to repo-relative URLs. */
  githubBlobLinkRewrite?: GithubBlobLinkRewriteOptions;
};

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
    githubBlobLinkRewrite: opts.githubBlobLinkRewrite,
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}
