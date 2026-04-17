import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./html-utils.js";
import {
  type GithubBlobLinkRewriteOptions,
  renderFencedCode,
  renderMarkdownToHtml,
} from "./markdown-pipeline.js";

export type CodeBrowserPageOptions = {
  title?: string;
  /** Repo-relative (or otherwise meaningful) path to display prominently in the toolbar. */
  filePath?: string;
  code: string;
  language: string;
  commentrayMarkdown: string;
  includeMermaidRuntime?: boolean;
  /** Highlight.js stylesheet base name (e.g. github, github-dark). */
  hljsTheme?: string;
  /**
   * Public Git (or other) URL for the repository whose source is shown — renders
   * as an Octocat link in the toolbar (top-right cluster on wide viewports).
   * Only `http:` / `https:` URLs are emitted.
   */
  githubRepoUrl?: string;
  /**
   * Home URL for the Commentray project (shown as “Rendered with Commentray”).
   * Only `http:` / `https:` URLs are emitted.
   */
  toolHomeUrl?: string;
  /**
   * When set, GitHub `blob` / `tree` links for this repository are rewritten to paths
   * relative to the generated HTML file (offline-friendly).
   */
  githubBlobLinkRewrite?: GithubBlobLinkRewriteOptions;
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
    const num = i + 1;
    parts.push(
      `<div class="code-line" id="code-line-${i}" data-line="${i}">` +
        `<span class="ln" aria-hidden="true">${num}</span>` +
        `<pre><code class="hljs language-${langAttr}">${inner}</code></pre>` +
        `</div>`,
    );
  }
  return parts.join("\n");
}

/** Split a repo-relative path into its directory prefix (with trailing slash) and basename. */
function splitFilePath(p: string): { dir: string; base: string } {
  const normalized = p.replaceAll("\\", "/").replace(/^\/+/, "");
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return { dir: "", base: normalized };
  return { dir: normalized.slice(0, idx + 1), base: normalized.slice(idx + 1) };
}

function renderFilePathLabel(filePath: string | undefined, fallbackTitle: string): string {
  const shown = (filePath ?? "").trim();
  if (!shown) {
    return `<strong class="file-path file-path--title">${escapeHtml(fallbackTitle)}</strong>`;
  }
  const { dir, base } = splitFilePath(shown);
  const dirHtml = dir
    ? `<span class="file-path__dir">${escapeHtml(dir)}</span>`
    : `<span class="file-path__dir file-path__dir--root" title="Repository root">/ </span>`;
  return (
    `<strong class="file-path" title="${escapeHtml(shown)}">` +
    dirHtml +
    `<span class="file-path__base">${escapeHtml(base)}</span>` +
    `</strong>`
  );
}

/** GitHub “mark” glyph (Octicons-style path), MIT-licensed silhouette. */
const GITHUB_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>' +
  "</svg>";

function safeExternalHttpUrl(url: string | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  return t;
}

function buildToolbarEndHtml(githubRepoUrl: string | undefined, toolHomeUrl: string | undefined): string {
  const gh = safeExternalHttpUrl(githubRepoUrl);
  const tool = safeExternalHttpUrl(toolHomeUrl);
  const bits: string[] = [];
  if (gh) {
    const he = escapeHtml(gh);
    bits.push(
      `<a class="toolbar-github" href="${he}" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub" title="View repository on GitHub">${GITHUB_MARK_SVG}</a>`,
    );
  }
  if (tool) {
    const te = escapeHtml(tool);
    bits.push(
      `<span class="toolbar-attribution" role="note">Rendered with <a href="${te}" target="_blank" rel="noopener noreferrer">Commentray</a></span>`,
    );
  }
  if (bits.length === 0) return "";
  return `<div class="toolbar__end">${bits.join("")}</div>`;
}

/** IIFE produced by `npm run build -w @commentray/render` (esbuild of `code-browser-client.ts`). */
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
    "Missing code-browser-client.bundle.js. Run `npm run build -w @commentray/render` to bundle the browser client.",
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
      .toolbar__main {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
        flex: 1 1 280px;
        min-width: 0;
      }
      .toolbar__end {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
        margin-left: auto;
        justify-content: flex-end;
      }
      .toolbar-github {
        display: inline-flex; align-items: center; justify-content: center;
        width: 34px; height: 34px; border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
      }
      .toolbar-github:hover { background: color-mix(in oklab, CanvasText 11%, Canvas); }
      .toolbar-github:focus-visible { outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas); outline-offset: 2px; }
      .toolbar-attribution {
        font-size: 11px; line-height: 1.35; opacity: 0.82; max-width: min(360px, 42vw);
        text-align: right; color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .toolbar-attribution a { color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
      .toolbar label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
      .toolbar .file-path {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: 13px; font-weight: 500;
        display: inline-flex; align-items: baseline; gap: 0; margin-right: 4px;
        max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .toolbar .file-path__dir {
        color: color-mix(in oklab, CanvasText 55%, Canvas);
      }
      .toolbar .file-path__dir--root { letter-spacing: 0; }
      .toolbar .file-path__base {
        color: CanvasText; font-weight: 600;
      }
      .toolbar .file-path--title { font-weight: 600; }
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
      .pane--code .code-line {
        display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: start;
      }
      .pane--code .code-line pre { margin: 0; min-width: 0; }
      .pane--code .code-line .ln {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-variant-numeric: tabular-nums;
        text-align: right; user-select: none; -webkit-user-select: none;
        color: color-mix(in oklab, CanvasText 45%, Canvas);
        padding-right: 8px;
        border-right: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        min-width: 3ch;
      }
      .pane--code .code-line:target .ln,
      .pane--code .code-line:hover .ln {
        color: color-mix(in oklab, CanvasText 75%, Canvas);
      }
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
  filePathHtml: string;
  toolbarEndHtml: string;
  codeHtml: string;
  commentrayHtml: string;
  rawCodeB64: string;
  rawMdB64: string;
  hljs: string;
  hljsDark: string;
  mermaidScript: string;
};

function buildCodeBrowserPageHtml(p: CodeBrowserPageParts): string {
  const {
    title,
    filePathHtml,
    toolbarEndHtml,
    codeHtml,
    commentrayHtml,
    rawCodeB64,
    rawMdB64,
    hljs,
    hljsDark,
    mermaidScript,
  } = p;
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
        <div class="toolbar__main">
          ${filePathHtml}
          <span class="search-field">
            <label for="search-q">Search</label>
            <input type="search" id="search-q" placeholder="Whole source (ordered tokens + fuzzy lines)…" autocomplete="off" spellcheck="false" />
            <button type="button" id="search-clear" title="Clear search">Clear</button>
          </span>
          <label><input type="checkbox" id="wrap-lines" /> Wrap code lines</label>
        </div>
        ${toolbarEndHtml}
      </header>
      <div class="search-results" id="search-results" hidden aria-live="polite"></div>
      <div class="shell" id="shell">
        <section class="pane--code" id="code-pane" aria-label="Source code" data-raw-code-b64="${escapeHtml(rawCodeB64)}" data-raw-md-b64="${escapeHtml(rawMdB64)}">
          <h2 class="pane-title">Code</h2>
          ${codeHtml}
        </section>
        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>
        <section class="pane--doc commentray" id="doc-pane" aria-label="Commentray">
          <h2 class="pane-title">Commentray</h2>
          ${commentrayHtml}
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
 * Static HTML shell for a minimal “code browser”: code + rendered commentray,
 * draggable vertical splitter, togglable line wrap for the code pane, and
 * token-in-line quick search (all non-whitespace tokens must appear on the same line).
 */
export async function renderCodeBrowserHtml(opts: CodeBrowserPageOptions): Promise<string> {
  const [codeHtml, commentrayHtml] = await Promise.all([
    renderCodeLineBlocks(opts.code, opts.language),
    renderMarkdownToHtml(opts.commentrayMarkdown, {
      githubBlobLinkRewrite: opts.githubBlobLinkRewrite,
    }),
  ]);

  const rawCodeB64 = Buffer.from(opts.code, "utf8").toString("base64");
  const rawMdB64 = Buffer.from(opts.commentrayMarkdown, "utf8").toString("base64");

  const title = opts.title ?? opts.filePath ?? "Commentray";
  const filePathHtml = renderFilePathLabel(opts.filePath, title);
  const toolbarEndHtml = buildToolbarEndHtml(opts.githubRepoUrl, opts.toolHomeUrl);
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
    filePathHtml,
    toolbarEndHtml,
    codeHtml,
    commentrayHtml,
    rawCodeB64,
    rawMdB64,
    hljs,
    hljsDark,
    mermaidScript,
  });
}
