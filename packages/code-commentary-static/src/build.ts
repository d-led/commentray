import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderCodeBrowserHtml } from "@commentary/render";

export type BuildCodeCommentaryStaticOptions = {
  /** Absolute or cwd-relative path to the source file whose contents are shown as code. */
  sourceFile: string;
  /** Absolute or cwd-relative path to commentary Markdown. */
  markdownFile: string;
  /** Output HTML path (directories created as needed). */
  outHtml: string;
  title?: string;
  includeMermaidRuntime?: boolean;
  /** Highlight.js theme base name (e.g. github, github-dark); forwarded to `renderCodeBrowserHtml`. */
  hljsTheme?: string;
};

export async function buildCodeCommentaryStatic(
  opts: BuildCodeCommentaryStaticOptions,
): Promise<void> {
  const sourcePath = path.resolve(opts.sourceFile);
  const mdPath = path.resolve(opts.markdownFile);
  const outPath = path.resolve(opts.outHtml);

  const code = await readFile(sourcePath, "utf8");
  const commentaryMarkdown = await readFile(mdPath, "utf8");
  const ext = path.extname(sourcePath).slice(1) || "txt";
  const language = ext === "ts" ? "ts" : ext === "tsx" ? "tsx" : ext;

  const html = await renderCodeBrowserHtml({
    title: opts.title ?? path.basename(sourcePath),
    code,
    language,
    commentaryMarkdown,
    includeMermaidRuntime: opts.includeMermaidRuntime ?? false,
    hljsTheme: opts.hljsTheme,
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}
