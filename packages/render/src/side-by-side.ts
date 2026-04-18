import { escapeHtml } from "./html-utils.js";
import {
  type CommentrayOutputUrlOptions,
  renderFencedCode,
  renderMarkdownToHtml,
} from "./markdown-pipeline.js";
import { mermaidRuntimeScriptHtml } from "./mermaid-runtime-html.js";

export type SideBySideOptions = {
  title?: string;
  /** Source code text (not yet fenced). */
  code: string;
  /** Highlight.js / common language id, e.g. ts, go, json */
  language: string;
  /** Commentray markdown body. */
  commentrayMarkdown: string;
  /** Highlight.js theme base name (e.g. `github`, `github-dark`); matches static code browser. */
  hljsTheme?: string;
  /** When true, include Mermaid runtime from CDN in the footer. */
  includeMermaidRuntime?: boolean;
  /** Optional static URL rewriting for the commentray pane (images, local links, GitHub blob). */
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
};

export async function renderSideBySideHtml(opts: SideBySideOptions): Promise<string> {
  const fence = "```" + opts.language + "\n" + opts.code + "\n```\n";
  const [codeHtml, commentrayHtml] = await Promise.all([
    renderFencedCode(fence),
    renderMarkdownToHtml(opts.commentrayMarkdown, {
      commentrayOutputUrls: opts.commentrayOutputUrls,
    }),
  ]);

  const mermaidScript = mermaidRuntimeScriptHtml(opts.includeMermaidRuntime);

  const title = opts.title ?? "Commentray";
  const hljs = opts.hljsTheme ?? "github";
  const hljsDark = opts.hljsTheme?.includes("dark") ? opts.hljsTheme : "github-dark";
  const hljsCdnBase = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${hljsCdnBase}/${escapeHtml(hljs)}.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" href="${hljsCdnBase}/${escapeHtml(hljsDark)}.min.css" media="(prefers-color-scheme: dark)" />
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100vh; }
      .pane { overflow: auto; padding: 16px; border-right: 1px solid color-mix(in oklab, CanvasText 20%, Canvas); }
      .pane:last-child { border-right: none; }
      .pane h2 { margin-top: 0; font-size: 14px; letter-spacing: 0.02em; text-transform: uppercase; opacity: 0.8; }
      pre { margin: 0; }
      .commentray { font-size: 15px; line-height: 1.45; }
      .commentray img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="pane" aria-label="Source">
        <h2>Code</h2>
        ${codeHtml}
      </section>
      <section class="pane commentray" aria-label="Commentray">
        <h2>Commentray</h2>
        ${commentrayHtml}
      </section>
    </div>
    ${mermaidScript}
  </body>
</html>`;
}
