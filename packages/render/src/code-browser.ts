import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./html-utils.js";
import { renderFencedCode, renderMarkdownToHtml } from "./markdown-pipeline.js";

export type CodeBrowserPageOptions = {
  title?: string;
  code: string;
  language: string;
  commentaryMarkdown: string;
  includeMermaidRuntime?: boolean;
  /** Highlight.js stylesheet base name (e.g. github, github-dark). */
  hljsTheme?: string;
};

function extractPreCodeInner(html: string): string {
  const m = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(html.trim());
  return m ? m[1] : escapeHtml(html);
}

/** One highlighted row per source line so in-page search can scroll to a line. */
async function renderCodeLineBlocks(code: string, language: string): Promise<string> {
  const lines = code.split("\n");
  const langAttr = escapeHtml(language);
  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] === "" ? " " : lines[i];
    const fence = "```" + language + "\n" + line + "\n```\n";
    const block = await renderFencedCode(fence);
    const inner = extractPreCodeInner(block);
    parts.push(
      `<div class="code-line" id="code-line-${i}" data-line="${i}"><pre><code class="hljs language-${langAttr}">${inner}</code></pre></div>`,
    );
  }
  return parts.join("\n");
}

/** IIFE produced by `npm run build -w @commentary/render` (esbuild of `code-browser-client.ts`). */
function loadCodeBrowserClientBundle(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const inDist = join(here, "code-browser-client.bundle.js");
  const fromSrc = join(here, "..", "dist", "code-browser-client.bundle.js");
  for (const p of [inDist, fromSrc]) {
    if (existsSync(p)) {
      return readFileSync(p, "utf8");
    }
  }
  throw new Error(
    "Missing code-browser-client.bundle.js. Run `npm run build -w @commentary/render` to bundle the browser client.",
  );
}

const CODE_BROWSER_STYLES = `
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .toolbar {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 8px 12px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 18%, Canvas);
        font-size: 13px; flex: 0 0 auto;
      }
      .toolbar label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
      .toolbar .search-field {
        display: inline-flex; align-items: center; gap: 6px; flex: 1 1 220px; min-width: 160px;
      }
      .toolbar .search-field input[type="search"] {
        flex: 1; min-width: 0; padding: 4px 8px; font: inherit; border-radius: 6px;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas); background: Canvas;
        color: CanvasText;
      }
      .toolbar button {
        font: inherit; padding: 4px 10px; border-radius: 6px; cursor: pointer;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas); background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
      }
      .search-results {
        flex: 0 0 auto; max-height: 160px; overflow: auto; padding: 6px 12px 8px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        font-size: 12px;
      }
      .search-results[hidden] { display: none !important; }
      .search-results .hint { opacity: 0.75; margin-bottom: 6px; }
      .search-results button.hit {
        display: block; width: 100%; text-align: left; margin: 2px 0; padding: 6px 8px;
        border-radius: 6px; border: 1px solid color-mix(in oklab, CanvasText 14%, Canvas);
        background: color-mix(in oklab, CanvasText 5%, Canvas); color: CanvasText; cursor: pointer;
        font: inherit;
      }
      .search-results button.hit:hover { background: color-mix(in oklab, CanvasText 10%, Canvas); }
      .search-results button.hit .meta { opacity: 0.8; font-size: 11px; }
      .search-results button.hit .src-tag { opacity: 0.75; font-weight: 500; font-size: 10px; }
      .search-results button.hit .snippet { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; margin-top: 2px; }
      .shell { display: flex; flex-direction: row; flex: 1; min-height: 0; }
      .pane--code {
        flex: 0 0 50%;
        min-width: 120px; overflow: auto; padding: 12px 16px;
        border-right: 1px solid color-mix(in oklab, CanvasText 15%, Canvas);
      }
      .pane--code .code-line pre { margin: 0; }
      .pane--code.wrap .code-line pre, .pane--code.wrap .code-line pre code {
        white-space: pre-wrap; word-break: break-word;
      }
      .pane--code:not(.wrap) .code-line pre, .pane--code:not(.wrap) .code-line pre code {
        white-space: pre;
      }
      .gutter {
        flex: 0 0 8px; cursor: col-resize; background: color-mix(in oklab, CanvasText 12%, Canvas);
        position: relative;
      }
      .gutter:hover { background: color-mix(in oklab, CanvasText 22%, Canvas); }
      .gutter::after {
        content: ""; position: absolute; top: 0; bottom: 0; left: -4px; right: -4px;
      }
      .pane--doc {
        flex: 1 1 auto; min-width: 120px; overflow: auto; padding: 12px 16px;
      }
      .pane--doc { font-size: 15px; line-height: 1.45; }
      .pane--doc img { max-width: 100%; height: auto; }
      .pane h2.pane-title { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.75; }
      .app { display: flex; flex-direction: column; height: 100vh; }
`;

type CodeBrowserPageParts = {
  title: string;
  codeHtml: string;
  commentaryHtml: string;
  rawCodeB64: string;
  rawMdB64: string;
  hljs: string;
  hljsDark: string;
  mermaidScript: string;
};

function buildCodeBrowserPageHtml(p: CodeBrowserPageParts): string {
  const { title, codeHtml, commentaryHtml, rawCodeB64, rawMdB64, hljs, hljsDark, mermaidScript } =
    p;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      hljs,
    )}.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      hljsDark,
    )}.min.css" media="(prefers-color-scheme: dark)" />
    <style>
${CODE_BROWSER_STYLES}
    </style>
  </head>
  <body>
    <div class="app">
      <header class="toolbar" aria-label="View options">
        <strong style="margin-right:4px">${escapeHtml(title)}</strong>
        <span class="search-field">
          <label for="search-q">Search</label>
          <input type="search" id="search-q" placeholder="Whole source (ordered tokens + fuzzy lines)…" autocomplete="off" spellcheck="false" />
          <button type="button" id="search-clear" title="Clear search">Clear</button>
        </span>
        <label><input type="checkbox" id="wrap-lines" /> Wrap code lines</label>
      </header>
      <div class="search-results" id="search-results" hidden aria-live="polite"></div>
      <div class="shell" id="shell">
        <section class="pane--code" id="code-pane" aria-label="Source code" data-raw-code-b64="${escapeHtml(rawCodeB64)}" data-raw-md-b64="${escapeHtml(rawMdB64)}">
          <h2 class="pane-title">Code</h2>
          ${codeHtml}
        </section>
        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>
        <section class="pane--doc commentary" id="doc-pane" aria-label="Commentary">
          <h2 class="pane-title">Commentary</h2>
          ${commentaryHtml}
        </section>
      </div>
    </div>
    <script>
${loadCodeBrowserClientBundle()}
    </script>
    ${mermaidScript}
  </body>
</html>`;
}

/**
 * Static HTML shell for a minimal “code browser”: code + rendered commentary,
 * draggable vertical splitter, togglable line wrap for the code pane, and
 * token-in-line quick search (all non-whitespace tokens must appear on the same line).
 */
export async function renderCodeBrowserHtml(opts: CodeBrowserPageOptions): Promise<string> {
  const [codeHtml, commentaryHtml] = await Promise.all([
    renderCodeLineBlocks(opts.code, opts.language),
    renderMarkdownToHtml(opts.commentaryMarkdown),
  ]);

  const rawCodeB64 = Buffer.from(opts.code, "utf8").toString("base64");
  const rawMdB64 = Buffer.from(opts.commentaryMarkdown, "utf8").toString("base64");

  const title = opts.title ?? "Commentary";
  const hljs = opts.hljsTheme ?? "github";
  const hljsDark = opts.hljsTheme?.includes("dark") ? opts.hljsTheme : "github-dark";

  const mermaidScript = opts.includeMermaidRuntime
    ? `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, securityLevel: "strict" });
mermaid.run({ querySelector: ".mermaid" });
</script>`
    : "";

  return buildCodeBrowserPageHtml({
    title,
    codeHtml,
    commentaryHtml,
    rawCodeB64,
    rawMdB64,
    hljs,
    hljsDark,
    mermaidScript,
  });
}
