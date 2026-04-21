import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./html-utils.js";
import { COMMENTRAY_FAVICON_LINK_HTML } from "./inline-favicon.js";
import { hljsStylesheetThemes } from "./hljs-stylesheet-themes.js";
import {
  type CommentrayOutputUrlOptions,
  renderFencedCode,
  renderMarkdownToHtml,
} from "./markdown-pipeline.js";
import { mermaidRuntimeScriptHtml } from "./mermaid-runtime-html.js";

const sideBySideLayoutCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "side-by-side-layout.css"),
  "utf8",
);

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
  const { hljsLight, hljsDark } = hljsStylesheetThemes(opts.hljsTheme);
  const hljsCdnBase = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${COMMENTRAY_FAVICON_LINK_HTML}
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${hljsCdnBase}/${escapeHtml(hljsLight)}.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" href="${hljsCdnBase}/${escapeHtml(hljsDark)}.min.css" media="(prefers-color-scheme: dark)" />
    <style>
${sideBySideLayoutCss}
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
