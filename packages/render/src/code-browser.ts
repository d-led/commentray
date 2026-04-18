import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MARKER_ID_BODY,
  buildBlockScrollLinks,
  type BlockScrollLink,
  type CommentrayIndex,
} from "@commentray/core";

import { tryBuildBlockStretchTableHtml } from "./block-stretch-layout.js";
import { escapeHtml } from "./html-utils.js";
import {
  type CommentrayOutputUrlOptions,
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
   * When set, local `img`/`a` URLs and optional GitHub blob/tree rewrites resolve to paths
   * relative to the generated HTML file.
   */
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
  /**
   * Optional “Also on GitHub …” toolbar links (other repo files). Used when only a single
   * `index.html` is published so in-repo Markdown links cannot target sibling paths on Pages.
   */
  relatedGithubNav?: { label: string; href: string }[];
  /**
   * Free-form label for `<meta name="generator">` (e.g. package versions). Omitted when unset.
   */
  generatorLabel?: string;
  /**
   * When set and index blocks align with `<!-- commentray:block id=… -->` markers,
   * emits a two-column **blame-style** table: **one row per block** (plus gap rows for
   * unmapped lines). Code and commentary cells share the **same row height** (the taller
   * side wins; the shorter side is top-aligned with natural padding below). One shell
   * scroll keeps both columns aligned.
   */
  blockStretchRows?: {
    index: CommentrayIndex;
    sourceRelative: string;
    commentrayPathRel: string;
  };
  /**
   * `auto` (default): when `blockStretchRows` is set and a block-stretch table can be built,
   * use the stretch layout; otherwise dual panes.
   * `dual`: always use side-by-side panes (skips stretch), so block markers + index can drive
   * **block-aware** scroll sync and separator lines in the commentray pane.
   */
  codeBrowserLayout?: "auto" | "dual";
  /**
   * `full` (default): in-page search indexes every source line and every commentray line.
   * `commentray-and-paths`: search only **toolbar path labels** plus commentray Markdown (no code-body line corpus).
   */
  staticSearchScope?: "full" | "commentray-and-paths";
  /** Repo-relative companion Markdown path; used with `staticSearchScope: "commentray-and-paths"` for path labels. */
  commentrayPathForSearch?: string;
};

function renderGeneratorMetaHtml(label: string | undefined): string {
  const t = label?.trim();
  if (!t) return "";
  return `<meta name="generator" content="${escapeHtml(t)}" />\n    `;
}

function extractPreCodeInner(html: string): string {
  const m = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(html.trim());
  return m ? m[1] : escapeHtml(html);
}

/** Single capture: marker id (avoid a wrapping group around the whole comment — that shifted indices). */
const BLOCK_MARKER_HTML_LINE = new RegExp(
  `^<!--\\s*commentray:block\\s+id=(${MARKER_ID_BODY})\\s*-->$`,
  "i",
);

/** Inserts thin separator anchors after each `<!-- commentray:block … -->` line (optional index attrs for scroll sync). */
function injectCommentrayBlockAnchors(markdown: string, links?: BlockScrollLink[]): string {
  const byId = links ? new Map(links.map((l) => [l.id, l])) : undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const m = BLOCK_MARKER_HTML_LINE.exec(line);
      if (!m?.[1]) return line;
      const id = m[1];
      const link = byId?.get(id);
      const attrs =
        link !== undefined
          ? ` data-source-start="${String(link.sourceStart)}" data-commentray-line="${String(link.commentrayLine)}"`
          : "";
      return `${line}\n\n<div id="commentray-block-${escapeHtml(id)}" class="commentray-block-anchor" aria-hidden="true"${attrs}></div>`;
    })
    .join("\n");
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

function buildToolbarEndHtml(
  githubRepoUrl: string | undefined,
  toolHomeUrl: string | undefined,
): string {
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

function renderRelatedGithubNavHtml(links: { label: string; href: string }[]): string {
  if (links.length === 0) return "";
  const parts = links.map(
    (l) =>
      `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`,
  );
  return (
    `<nav class="toolbar-related" aria-label="Open other repository files on GitHub">` +
    `<span class="toolbar-related__prefix">Also on GitHub</span>` +
    `<span class="toolbar-related__links">${parts.join('<span class="toolbar-related__sep" aria-hidden="true"> · </span>')}</span>` +
    `</nav>`
  );
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
      .toolbar-related {
        display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px;
        max-width: min(520px, 90vw); font-size: 12px; line-height: 1.35;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .toolbar-related__prefix { font-weight: 600; opacity: 0.85; white-space: nowrap; }
      .toolbar-related__links { min-width: 0; }
      .toolbar-related a {
        color: inherit; text-decoration: underline; text-underline-offset: 2px; font-weight: 500;
        word-break: break-word;
      }
      .toolbar-related__sep { opacity: 0.55; user-select: none; }
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
        --code-line-font-size: 13px;
        --code-line-height: 1.5;
      }
      .pane--code .code-line {
        display: grid;
        /* max-content: column wide enough for the longest line number (avoids 100+ bleeding into code). */
        grid-template-columns: max-content 1fr;
        column-gap: 12px;
        align-items: baseline;
      }
      .pane--code .code-line pre {
        margin: 0;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
      }
      .pane--code .code-line pre code.hljs {
        display: block;
        margin: 0;
        padding: 0;
        font-size: var(--code-line-font-size);
        line-height: var(--code-line-height);
      }
      .pane--code .code-line .ln {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-variant-numeric: tabular-nums;
        text-align: right; user-select: none; -webkit-user-select: none;
        color: color-mix(in oklab, CanvasText 45%, Canvas);
        padding-right: 8px;
        border-right: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        white-space: nowrap;
        font-size: var(--code-line-font-size);
        line-height: var(--code-line-height);
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
      .pane--doc .commentray-block-anchor {
        display: block;
        height: 0;
        margin: 14px 0 0;
        border: 0;
        border-top: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        pointer-events: none;
      }
      .pane h2.pane-title { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.75; }
      .app { display: flex; flex-direction: column; height: 100vh; }
      .shell--stretch-rows {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: block;
        padding: 0 12px 20px;
      }
      .shell--stretch-rows .stretch-preamble {
        padding: 8px 4px 16px;
        margin-bottom: 8px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        font-size: 15px;
        line-height: 1.45;
      }
      .shell--stretch-rows .stretch-preamble img { max-width: 100%; height: auto; }
      .block-stretch {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .stretch-col-code { width: 50%; }
      .stretch-col-doc { width: 50%; }
      .block-stretch td.stretch-code {
        vertical-align: top;
        padding: 0 12px 0 0;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 8%, Canvas);
      }
      .block-stretch td.stretch-doc {
        vertical-align: top;
        padding: 0 0 0 12px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 8%, Canvas);
      }
      .block-stretch td.stretch-doc .stretch-doc-inner {
        font-size: 15px;
        line-height: 1.45;
      }
      .block-stretch td.stretch-doc .stretch-doc-inner img { max-width: 100%; height: auto; }
      .block-stretch td.stretch-doc--gap {
        color: color-mix(in oklab, CanvasText 38%, Canvas);
        font-size: 13px;
        vertical-align: top;
      }
      .block-stretch .stretch-gap-mark { display: inline-block; padding-top: 2px; }
      .block-stretch .stretch-code-stack {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        min-width: 0;
      }
      .block-stretch .code-line {
        display: grid;
        grid-template-columns: max-content 1fr;
        column-gap: 12px;
        align-items: baseline;
      }
      .block-stretch .code-line pre { margin: 0; min-width: 0; padding: 0; border: 0; background: transparent; }
      .block-stretch .code-line pre code.hljs {
        display: block;
        margin: 0;
        padding: 0;
        font-size: var(--code-line-font-size, 13px);
        line-height: var(--code-line-height, 1.5);
      }
      .block-stretch .code-line .ln {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-variant-numeric: tabular-nums;
        text-align: right;
        user-select: none;
        -webkit-user-select: none;
        color: color-mix(in oklab, CanvasText 45%, Canvas);
        padding-right: 8px;
        border-right: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        white-space: nowrap;
        font-size: var(--code-line-font-size, 13px);
        line-height: var(--code-line-height, 1.5);
      }
      .block-stretch.wrap .code-line pre,
      .block-stretch.wrap .code-line pre code { white-space: pre-wrap; word-break: break-word; }
      .block-stretch:not(.wrap) .code-line pre,
      .block-stretch:not(.wrap) .code-line pre code { white-space: pre; }
      .block-stretch-headings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 16px;
        padding: 4px 12px 8px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 10%, Canvas);
      }
      .block-stretch-headings .pane-title { margin: 0; }
`;

type CodeBrowserPageParts = {
  title: string;
  generatorMetaHtml: string;
  filePathHtml: string;
  relatedNavHtml: string;
  toolbarEndHtml: string;
  /** `dual`: resizable panes; `stretch`: rowspan table aligned to index blocks. */
  layout: "dual" | "stretch";
  shellInner: string;
  rawCodeB64: string;
  rawMdB64: string;
  /** Base64 JSON of `BlockScrollLink[]` when dual pane uses index-backed scroll sync; empty otherwise. */
  scrollBlockLinksB64: string;
  hljs: string;
  hljsDark: string;
  mermaidScript: string;
  searchPlaceholder: string;
  shellSearchAttrs: string;
};

function buildCodeBrowserPageHtml(p: CodeBrowserPageParts): string {
  const {
    title,
    generatorMetaHtml,
    filePathHtml,
    relatedNavHtml,
    toolbarEndHtml,
    layout,
    shellInner,
    rawCodeB64,
    rawMdB64,
    scrollBlockLinksB64,
    hljs,
    hljsDark,
    mermaidScript,
    searchPlaceholder,
    shellSearchAttrs,
  } = p;
  const shellClass = layout === "stretch" ? "shell shell--stretch-rows" : "shell";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${generatorMetaHtml}<title>${escapeHtml(title)}</title>
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
            <input type="search" id="search-q" placeholder="${escapeHtml(searchPlaceholder)}" autocomplete="off" spellcheck="false" />
            <button type="button" id="search-clear" title="Clear search">Clear</button>
          </span>
          ${relatedNavHtml}
          <label><input type="checkbox" id="wrap-lines" /> Wrap code lines</label>
        </div>
        ${toolbarEndHtml}
      </header>
      <div class="search-results" id="search-results" hidden aria-live="polite"></div>
      <div class="${shellClass}" id="shell" data-layout="${layout}" data-raw-code-b64="${escapeHtml(rawCodeB64)}" data-raw-md-b64="${escapeHtml(rawMdB64)}" data-scroll-block-links-b64="${escapeHtml(scrollBlockLinksB64)}"${shellSearchAttrs}>
${shellInner}
      </div>
    </div>
    <script>
${loadCodeBrowserClientBundle()}
    </script>
    ${mermaidScript}
  </body>
</html>`;
}

type CodeBrowserShell = {
  layout: "dual" | "stretch";
  shellInner: string;
  scrollBlockLinksB64: string;
};

async function buildCodeBrowserShell(
  opts: CodeBrowserPageOptions,
  layoutPref: "auto" | "dual",
): Promise<CodeBrowserShell> {
  let layout: "dual" | "stretch" = "dual";
  let shellInner = "";
  let scrollBlockLinksB64 = "";

  if (opts.blockStretchRows && layoutPref !== "dual") {
    const stretched = await tryBuildBlockStretchTableHtml({
      code: opts.code,
      language: opts.language,
      commentrayMarkdown: opts.commentrayMarkdown,
      index: opts.blockStretchRows.index,
      sourceRelative: opts.blockStretchRows.sourceRelative,
      commentrayPathRel: opts.blockStretchRows.commentrayPathRel,
      commentrayOutputUrls: opts.commentrayOutputUrls,
    });
    if (stretched) {
      layout = "stretch";
      shellInner =
        `        <div class="block-stretch-headings">` +
        `<h2 class="pane-title">Code</h2>` +
        `<h2 class="pane-title">Commentray</h2>` +
        `</div>\n` +
        `        ${stretched.preambleHtml}\n` +
        `        ${stretched.tableInnerHtml}\n`;
    }
  }

  if (layout === "dual") {
    const links: BlockScrollLink[] =
      opts.blockStretchRows !== undefined
        ? buildBlockScrollLinks(
            opts.blockStretchRows.index,
            opts.blockStretchRows.sourceRelative,
            opts.blockStretchRows.commentrayPathRel,
            opts.commentrayMarkdown,
            opts.code,
          )
        : [];
    const mdForDoc = injectCommentrayBlockAnchors(
      opts.commentrayMarkdown,
      links.length > 0 ? links : undefined,
    );
    if (links.length > 0) {
      scrollBlockLinksB64 = Buffer.from(JSON.stringify(links), "utf8").toString("base64");
    }
    const [codeHtml, commentrayHtml] = await Promise.all([
      renderCodeLineBlocks(opts.code, opts.language),
      renderMarkdownToHtml(mdForDoc, {
        commentrayOutputUrls: opts.commentrayOutputUrls,
      }),
    ]);
    shellInner =
      `        <section class="pane--code" id="code-pane" aria-label="Source code">` +
      `<h2 class="pane-title">Code</h2>\n` +
      `          ${codeHtml}\n` +
      `        </section>\n` +
      `        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>\n` +
      `        <section class="pane--doc commentray" id="doc-pane" aria-label="Commentray">\n` +
      `          <h2 class="pane-title">Commentray</h2>\n` +
      `          ${commentrayHtml}\n` +
      `        </section>\n`;
  }

  return { layout, shellInner, scrollBlockLinksB64 };
}

/**
 * Static HTML shell for a minimal “code browser”: code + rendered commentray,
 * draggable vertical splitter, togglable line wrap for the code pane, and
 * token-in-line quick search (all non-whitespace tokens must appear on the same line).
 */
export async function renderCodeBrowserHtml(opts: CodeBrowserPageOptions): Promise<string> {
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

  const relatedNavHtml = renderRelatedGithubNavHtml(opts.relatedGithubNav ?? []);
  const generatorMetaHtml = renderGeneratorMetaHtml(opts.generatorLabel);

  const layoutPref = opts.codeBrowserLayout ?? "auto";
  const { layout, shellInner, scrollBlockLinksB64 } = await buildCodeBrowserShell(opts, layoutPref);

  const searchPlaceholder =
    opts.staticSearchScope === "commentray-and-paths"
      ? "Commentray + file paths (ordered tokens + fuzzy lines)…"
      : "Whole source (ordered tokens + fuzzy lines)…";
  const shellSearchAttrs =
    opts.staticSearchScope === "commentray-and-paths"
      ? ` data-search-scope="commentray-and-paths" data-search-file-path="${escapeHtml(
          opts.filePath ?? "",
        )}" data-search-commentray-path="${escapeHtml((opts.commentrayPathForSearch ?? "").trim())}"`
      : "";

  return buildCodeBrowserPageHtml({
    title,
    generatorMetaHtml,
    filePathHtml,
    relatedNavHtml,
    toolbarEndHtml,
    layout,
    shellInner,
    rawCodeB64,
    rawMdB64,
    scrollBlockLinksB64,
    hljs,
    hljsDark,
    mermaidScript,
    searchPlaceholder,
    shellSearchAttrs,
  });
}
