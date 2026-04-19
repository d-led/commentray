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
import { formatCommentrayBuiltAtLocal } from "./build-stamp.js";
import { escapeHtml } from "./html-utils.js";
import { renderHighlightedCodeLineRows } from "./highlighted-code-lines.js";
import { mermaidRuntimeScriptHtml } from "./mermaid-runtime-html.js";
import { type CommentrayOutputUrlOptions, renderMarkdownToHtml } from "./markdown-pipeline.js";
import { commentrayRenderVersion } from "./package-version.js";

/** One angle tab for {@link CodeBrowserPageOptions.multiAngleBrowsing}. */
export type CodeBrowserMultiAngleSpec = {
  id: string;
  title?: string;
  markdown: string;
  commentrayPathRel: string;
  commentrayOnGithubUrl?: string;
  blockStretchRows?: {
    index: CommentrayIndex;
    sourceRelative: string;
    commentrayPathRel: string;
  };
};

export type CodeBrowserMultiAngleBrowsing = {
  defaultAngleId: string;
  angles: CodeBrowserMultiAngleSpec[];
};

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
   * Home URL for the Commentray project (toolbar shows "Rendered with Commentray" plus the
   * package semver, linking here).
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
   * Instant this HTML was produced (footer “generated at” line and default generator meta).
   * Defaults to `new Date()` when omitted.
   */
  builtAt?: Date;
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
  /**
   * GitHub **blob** URL for the primary `filePath` (static hub). Shown in the toolbar when set
   * (`http`/`https` only).
   */
  sourceOnGithubUrl?: string;
  /**
   * GitHub **blob** URL for the companion commentray Markdown (same constraints as `sourceOnGithubUrl`).
   */
  commentrayOnGithubUrl?: string;
  /**
   * Relative URL to a nav JSON document (e.g. `./commentray-nav-search.json`) that includes
   * `documentedPairs` — enables the **Comment-rayed files** tree in the toolbar.
   */
  documentedNavJsonUrl?: string;
  /**
   * Base64 UTF-8 JSON array of documented pairs (same shape as `documentedPairs` in the nav JSON).
   * When set on `#shell`, the tree loads **without** fetching `documentedNavJsonUrl` — works offline
   * and with `file://` where `fetch` to a sidecar JSON is unavailable.
   */
  documentedPairsEmbeddedB64?: string;
  /**
   * When **two or more** angles are listed for the same static browse session, the shell renders
   * an Angle selector, embeds each rendered Markdown body, and disables stretch layout.
   */
  multiAngleBrowsing?: CodeBrowserMultiAngleBrowsing;
};

function renderGeneratorMetaHtml(label: string | undefined): string {
  const t = label?.trim();
  if (!t) return "";
  return `<meta name="generator" content="${escapeHtml(t)}" />\n    `;
}

/** Single capture: marker id (avoid a wrapping group around the whole comment — that shifted indices). */
const BLOCK_MARKER_HTML_LINE = new RegExp(
  `^<!--\\s*commentray:block\\s+id=(${MARKER_ID_BODY})\\s*-->$`,
  "i",
);

function trimEndSpacesTabs(s: string): string {
  return s.replace(/[ \t]+$/, "");
}

function isSetextUnderlineLine(line: string): boolean {
  const t = trimEndSpacesTabs(line);
  return /^\s{0,3}=+\s*$/.test(t) || /^\s{0,3}-+\s*$/.test(t);
}

function isThematicBreakLine(line: string): boolean {
  const t = trimEndSpacesTabs(line);
  return (
    /^\s{0,3}(?:\*[ \t]*){3,}\s*$/.test(t) ||
    /^\s{0,3}(?:-[ \t]*){3,}\s*$/.test(t) ||
    /^\s{0,3}(?:_[ \t]*){3,}\s*$/.test(t)
  );
}

type FenceState = { ch: "`" | "~"; len: number };

function parseFenceDelimiter(line: string): { ch: "`" | "~"; runLen: number; rest: string } | null {
  const t = trimEndSpacesTabs(line);
  const m = /^(\s{0,3})(`{3,}|~{3,})(.*)$/.exec(t);
  if (!m) return null;
  const run = m[2];
  const head = run[0];
  if (head !== "`" && head !== "~") return null;
  const ch: "`" | "~" = head === "`" ? "`" : "~";
  return { ch, runLen: run.length, rest: m[3] ?? "" };
}

function isClosingFenceLine(
  info: NonNullable<ReturnType<typeof parseFenceDelimiter>>,
  open: FenceState,
): boolean {
  if (info.ch !== open.ch || info.runLen < open.len) return false;
  return info.rest.trim() === "";
}

function lineAnchorHtml(mdLine0: number): string {
  const mdLine = String(mdLine0);
  return `<span class="commentray-line-anchor" data-commentray-md-line="${mdLine}" id="commentray-md-line-${mdLine}" aria-hidden="true"></span>`;
}

function appendMdLineAnchorWhenAllowed(line: string, mdLine0: number): string {
  if (isSetextUnderlineLine(line) || isThematicBreakLine(line)) return line;
  /** Blank lines must stay blank: a line that is only `<span …>` breaks CommonMark HTML / paragraph starts after block markers. */
  if (line === "") return "";
  return `${line}${lineAnchorHtml(mdLine0)}`;
}

/**
 * Inserts per-line anchors for search / hash jumps and block separator anchors after each
 * `<!-- commentray:block … -->` line (optional index attrs).
 *
 * Anchors are appended to the line when safe. A **leading** `<span>` breaks CommonMark block
 * recognition (`#` headings, lists, thematic breaks, fences). Fenced code lines must not get a
 * trailing anchor either (would corrupt fence delimiters or appear inside code).
 */
function injectCommentrayDocAnchors(markdown: string, links?: BlockScrollLink[]): string {
  const byId = links ? new Map(links.map((l) => [l.id, l])) : undefined;
  const lines = markdown.split("\n");
  let fence: FenceState | null = null;
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const delim = parseFenceDelimiter(line);
    if (fence) {
      if (delim && isClosingFenceLine(delim, fence)) {
        fence = null;
        out.push(line);
        continue;
      }
      out.push(line);
      continue;
    }

    if (delim) {
      fence = { ch: delim.ch, len: delim.runLen };
      out.push(line);
      continue;
    }

    const m = BLOCK_MARKER_HTML_LINE.exec(line);
    if (m?.[1]) {
      const id = m[1];
      const link = byId?.get(id);
      const attrs =
        link !== undefined
          ? ` data-source-start="${String(link.sourceStart)}" data-commentray-line="${String(link.commentrayLine)}"`
          : "";
      /** One `push` with embedded `\n\n` merged poorly with `join("\\n")`; keep real blank lines around raw `<div>`. */
      out.push(`${line}${lineAnchorHtml(i)}`);
      out.push("");
      out.push(
        `<div id="commentray-block-${escapeHtml(id)}" class="commentray-block-anchor" aria-hidden="true"${attrs}></div>`,
      );
      out.push("");
      continue;
    }

    out.push(appendMdLineAnchorWhenAllowed(line, i));
  }

  return out.join("\n");
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
  commentrayRenderSemver: string,
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
    const ver = escapeHtml(commentrayRenderSemver);
    bits.push(
      `<span class="toolbar-attribution" role="note">Rendered with <a href="${te}" target="_blank" rel="noopener noreferrer">Commentray</a> <span class="toolbar-attribution__version" translate="no">v${ver}</span></span>`,
    );
  }
  if (bits.length === 0) return "";
  return `<div class="toolbar__end">${bits.join("")}</div>`;
}

function renderPageFooterHtml(builtAt: Date): string {
  const iso = builtAt.toISOString();
  const human = formatCommentrayBuiltAtLocal(builtAt);
  return (
    `<footer class="app__footer" role="contentinfo">` +
    `<p class="app__footer-line">HTML generated <time datetime="${escapeHtml(iso)}">${escapeHtml(human)}</time></p>` +
    `</footer>`
  );
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

function renderToolbarDocHubHtml(opts: {
  documentedNavJsonUrl?: string;
  documentedPairsEmbeddedB64?: string;
}): { toolbarDocHubHtml: string; navRailDocumentedHtml: string } {
  const nav = opts.documentedNavJsonUrl?.trim();
  const hasEmbed = (opts.documentedPairsEmbeddedB64?.trim() ?? "").length > 0;
  const showDocumentedTree = Boolean(nav) || hasEmbed;
  const toolbarDocHubHtml = "";
  const navAttr = escapeHtml(nav ?? "");
  const navRailDocumentedHtml = showDocumentedTree
    ? `<details class="nav-rail__doc-hub" id="documented-files-hub" data-nav-json-url="${navAttr}">
        <summary class="nav-rail__doc-hub-summary">Comment-rayed files</summary>
        <div class="nav-rail__doc-hub-inner">
          <div class="nav-rail__doc-hub-filter-row">
            <label class="nav-rail__doc-hub-filter-label" for="documented-files-filter">Filter</label>
            <input type="search" id="documented-files-filter" class="nav-rail__doc-hub-filter" placeholder="Filter by path…" autocomplete="off" spellcheck="false" />
          </div>
          <div id="documented-files-tree" class="documented-files-tree" role="tree"></div>
        </div>
      </details>`
    : "";
  return { toolbarDocHubHtml, navRailDocumentedHtml };
}

function renderNavRailContextHtml(
  filePath: string | undefined,
  commentrayPath: string | undefined,
  opts?: { sourceOnGithubUrl?: string; commentrayOnGithubUrl?: string },
): string {
  const fpRaw = (filePath ?? "").trim();
  const crRaw = (commentrayPath ?? "").trim();
  const srcUrl = safeExternalHttpUrl(opts?.sourceOnGithubUrl);
  const crUrl = safeExternalHttpUrl(opts?.commentrayOnGithubUrl);
  if (fpRaw.length === 0 && crRaw.length === 0 && srcUrl === null && crUrl === null) {
    return "";
  }
  const fp = escapeHtml(fpRaw);
  const cr = escapeHtml(crRaw);
  const fpDisp = fpRaw.length > 0 ? fp : "—";
  const crDisp = crRaw.length > 0 ? cr : "—";
  const srcGh =
    srcUrl !== null
      ? `<a class="nav-rail__pair-gh" id="toolbar-source-github" href="${escapeHtml(srcUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Source file on GitHub" title="Open source on GitHub">${GITHUB_MARK_SVG}</a>`
      : "";
  const crGh =
    crUrl !== null
      ? `<a class="nav-rail__pair-gh" id="toolbar-commentray-github" href="${escapeHtml(crUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Companion commentray on GitHub" title="Open companion Markdown on GitHub">${GITHUB_MARK_SVG}</a>`
      : "";
  return `<div class="nav-rail__context nav-rail__context--compact" aria-label="Current documentation pair">
    <span class="nav-rail__pair">
      <span class="nav-rail__pair-lab">Src</span>
      <span class="nav-rail__pair-path" title="${fp}">${fpDisp}</span>${srcGh}
    </span>
    <span class="nav-rail__pair-sep" aria-hidden="true">·</span>
    <span class="nav-rail__pair">
      <span class="nav-rail__pair-lab">Doc</span>
      <span class="nav-rail__pair-path nav-rail__pair-path--secondary" id="nav-rail-doc-path" title="${cr}">${crDisp}</span>${crGh}
    </span>
  </div>`;
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
      .app {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        height: 100vh;
        width: 100%;
        overflow: hidden;
      }
      .app__chrome {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 12px 10px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 15%, Canvas);
        background: color-mix(in oklab, CanvasText 4%, Canvas);
        max-height: min(40vh, 420px);
        min-height: 0;
        overflow: auto;
      }
      .chrome__search-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        flex-wrap: nowrap;
      }
      .chrome__search-row input[type="search"] {
        flex: 1 1 auto;
        min-width: 140px;
        padding: 8px 10px;
        font: inherit;
        font-size: 14px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: Canvas;
        color: CanvasText;
      }
      .chrome__search-row #search-clear {
        flex: 0 0 auto;
        font: inherit;
        padding: 6px 14px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
      }
      .chrome__search-label {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .nav-rail__context--compact {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
        padding: 5px 10px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 14%, Canvas);
        background: Canvas;
        font-size: 12px;
        line-height: 1.3;
      }
      .nav-rail__pair {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        min-width: 0;
        flex: 1 1 140px;
        max-width: min(48%, 100%);
      }
      .nav-rail__pair-lab {
        flex: 0 0 auto;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .nav-rail__pair-path {
        flex: 1 1 auto;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: 11px;
        color: CanvasText;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nav-rail__pair-path--secondary { opacity: 0.88; }
      .nav-rail__pair-sep {
        flex: 0 0 auto;
        opacity: 0.45;
        user-select: none;
        padding: 0 2px;
      }
      .nav-rail__pair-gh {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 1px solid color-mix(in oklab, CanvasText 20%, Canvas);
        background: color-mix(in oklab, CanvasText 5%, Canvas);
        color: CanvasText;
      }
      .nav-rail__pair-gh:hover {
        background: color-mix(in oklab, CanvasText 10%, Canvas);
      }
      .nav-rail__pair-gh:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .nav-rail__pair-gh svg {
        width: 14px;
        height: 14px;
        display: block;
      }
      .toolbar .nav-rail__context--compact {
        border: 0;
        background: transparent;
        padding: 0;
        flex: 1 1 200px;
        min-width: 0;
        max-width: none;
        gap: 6px 10px;
      }
      .toolbar .nav-rail__pair {
        flex: 1 1 auto;
        min-width: 0;
        max-width: min(44vw, 420px);
      }
      .nav-rail__search-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        opacity: 0.8;
      }
      .nav-rail__search-hint {
        margin: 0;
        font-size: 11px;
        line-height: 1.35;
        opacity: 0.78;
      }
      .nav-rail__code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: 10px;
      }
      .nav-rail__doc-hub {
        position: relative;
        flex: 0 0 auto;
        align-self: center;
        display: block;
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        border-radius: 6px;
        background: Canvas;
        overflow: visible;
      }
      .nav-rail__doc-hub-summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 10px;
        list-style: none;
        user-select: none;
        line-height: 1.35;
      }
      .nav-rail__doc-hub-summary::-webkit-details-marker { display: none; }
      .nav-rail__doc-hub-inner {
        position: absolute;
        left: 0;
        top: calc(100% + 4px);
        z-index: 60;
        min-width: min(280px, 78vw);
        max-width: min(440px, 94vw);
        max-height: min(52vh, 400px);
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: hidden;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        border-radius: 8px;
        background: Canvas;
        box-shadow: 0 8px 28px color-mix(in oklab, CanvasText 12%, transparent);
      }
      .nav-rail__doc-hub-filter-row {
        flex: 0 0 auto;
      }
      .nav-rail__doc-hub-filter-label {
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        opacity: 0.78;
        margin-bottom: 4px;
      }
      .nav-rail__doc-hub-filter {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        background: color-mix(in oklab, CanvasText 4%, Canvas);
        color: CanvasText;
      }
      .nav-rail__doc-hub-filter:focus {
        outline: 2px solid color-mix(in oklab, CanvasText 40%, Canvas);
        outline-offset: 1px;
      }
      .nav-rail__doc-hub-hint {
        margin: 0 0 8px;
        opacity: 0.78;
        line-height: 1.4;
        font-size: 12px;
      }
      .app__main {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .app__footer {
        flex: 0 0 auto;
        padding: 6px 12px 10px;
        border-top: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        background: color-mix(in oklab, CanvasText 3%, Canvas);
        font-size: 11px;
        line-height: 1.4;
        color: color-mix(in oklab, CanvasText 72%, Canvas);
      }
      .app__footer-line { margin: 0; }
      .app__footer time { font-variant-numeric: tabular-nums; }
      .toolbar {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 8px 12px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 18%, Canvas);
        font-size: 13px; flex: 0 0 auto;
      }
      .toolbar__main {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
        flex: 0 1 auto;
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
      #documented-files-tree {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }
      .documented-files-tree ul { list-style: none; margin: 0; padding-left: 12px; }
      .documented-files-tree > ul { padding-left: 0; }
      .documented-files-tree li { margin: 2px 0; line-height: 1.35; }
      .documented-files-tree .tree-dir { font-weight: 600; margin-top: 4px; font-size: 12px; }
      .documented-files-tree .tree-file {
        margin: 3px 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: 11px;
      }
      .documented-files-tree .tree-file-link {
        color: inherit;
        font-weight: 500;
        text-decoration: underline;
        text-underline-offset: 2px;
        word-break: break-word;
      }
      .documented-files-tree .tree-file-link:hover {
        opacity: 0.92;
      }
      .toolbar button {
        font: inherit; padding: 4px 10px; border-radius: 6px; cursor: pointer;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas); background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
      }
      .search-results {
        flex: 0 1 auto;
        min-height: 0;
        max-height: min(320px, 38vh);
        overflow: auto;
        padding: 8px 8px 10px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        background: Canvas;
        font-size: 13px;
      }
      .search-results[hidden] { display: none !important; }
      .search-results .hint { opacity: 0.75; margin-bottom: 8px; line-height: 1.45; }
      .search-results button.hit {
        display: block; width: 100%; text-align: left; margin: 4px 0; padding: 8px 10px;
        border-radius: 6px; border: 1px solid color-mix(in oklab, CanvasText 14%, Canvas);
        background: color-mix(in oklab, CanvasText 5%, Canvas); color: CanvasText; cursor: pointer;
        font: inherit;
      }
      .search-results button.hit:hover { background: color-mix(in oklab, CanvasText 10%, Canvas); }
      .search-results button.hit .meta { opacity: 0.8; font-size: 12px; }
      .search-results button.hit .src-tag { opacity: 0.75; font-weight: 500; font-size: 11px; }
      .search-results button.hit .snippet {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 13px;
        line-height: 1.45; white-space: pre-wrap; word-break: break-word; margin-top: 4px;
      }
      .search-results mark.search-hit {
        padding: 0 2px; border-radius: 3px; font: inherit;
        background: color-mix(in oklab, #f5a623 70%, Canvas);
        color: CanvasText;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }
      @media (prefers-color-scheme: dark) {
        .search-results mark.search-hit {
          background: color-mix(in oklab, #c9a227 55%, Canvas);
        }
      }
      .shell { display: flex; flex-direction: row; flex: 1; min-height: 0; }
      .app__main .shell { flex: 1 1 auto; }
      .pane--code {
        flex: 0 0 50%;
        min-width: 120px; overflow: auto; padding: 12px 16px;
        border-right: 1px solid color-mix(in oklab, CanvasText 15%, Canvas);
        --code-line-font-size: 13px;
        --code-line-height: 1.5;
      }
      .pane--code .code-line-stack { --code-ln-min-ch: 3; }
      .pane--code .code-line {
        display: grid;
        grid-template-columns: max-content 1fr;
        column-gap: 10px;
        align-items: start;
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
        min-width: calc(var(--code-ln-min-ch, 3) * 1ch + 0.6ch);
        box-sizing: content-box;
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
        flex: 0 0 14px; cursor: col-resize; background: color-mix(in oklab, CanvasText 12%, Canvas);
        position: relative;
        --commentray-ray-accent: #3b7dd8;
      }
      @media (prefers-color-scheme: dark) {
        .gutter { --commentray-ray-accent: #6eb0ff; }
      }
      .gutter__rays {
        position: absolute; inset: 0; pointer-events: none; z-index: 1;
      }
      .gutter__rays svg { width: 100%; height: 100%; display: block; overflow: visible; }
      .gutter__rays-path {
        fill: none; stroke-linecap: round; vector-effect: non-scaling-stroke;
        stroke: color-mix(in oklab, var(--commentray-ray-accent) 72%, CanvasText);
        stroke-width: 1.35px; opacity: 0.26;
      }
      .gutter__rays-path--active {
        stroke-width: 2.4px; opacity: 0.88;
      }
      .gutter__rays-path--trail {
        stroke-dasharray: 3 4; opacity: 0.42;
      }
      .gutter__rays-path--active.gutter__rays-path--trail {
        opacity: 0.72;
      }
      .gutter:hover { background: color-mix(in oklab, CanvasText 22%, Canvas); }
      .gutter::after {
        content: ""; position: absolute; top: 0; bottom: 0; left: -4px; right: -4px;
      }
      .pane--doc {
        flex: 1 1 auto; min-width: 0; min-height: 0;
        display: flex; flex-direction: column; overflow: hidden; padding: 12px 16px;
      }
      .doc-pane-body {
        flex: 1 1 auto; min-height: 0; overflow: auto;
      }
      .toolbar-angle-picker {
        display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
        font-size: 12px; color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .toolbar-angle-picker select {
        font: inherit; font-size: 12px; padding: 3px 8px; border-radius: 6px;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas); background: Canvas; color: CanvasText;
      }
      .pane--doc { font-size: 15px; line-height: 1.45; }
      .pane--doc img { max-width: 100%; height: auto; }
      .pane--doc .commentray-line-anchor {
        display: inline;
        vertical-align: baseline;
        scroll-margin-top: 10px;
      }
      .pane--doc .commentray-block-anchor {
        display: block;
        height: 0;
        margin: 14px 0 0;
        border: 0;
        border-top: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        pointer-events: none;
      }
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
        align-items: start;
      }
      .block-stretch .code-line pre { margin: 0; min-width: 0; padding: 0; border: 0; background: transparent; }
      .block-stretch .code-line pre code.hljs {
        display: block;
        margin: 0;
        padding: 0;
        font-size: var(--code-line-font-size, 13px);
        line-height: var(--code-line-height, 1.5);
      }
      .block-stretch .code-line-stack { --code-ln-min-ch: 3; }
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
        min-width: calc(var(--code-ln-min-ch, 3) * 1ch + 0.6ch);
        box-sizing: content-box;
      }
      .block-stretch.wrap .code-line pre,
      .block-stretch.wrap .code-line pre code { white-space: pre-wrap; word-break: break-word; }
      .block-stretch:not(.wrap) .code-line pre,
      .block-stretch:not(.wrap) .code-line pre code { white-space: pre; }
`;

/** Native tooltip on #search-q (short hint is visible under the search row). */
const CODE_BROWSER_SEARCH_INPUT_TITLE =
  "Filename, path, or words. Matches this pair (source + commentray lines) first; merges commentray-nav-search.json when the export includes it (indexed paths + commentray lines).";

type CodeBrowserPageParts = {
  title: string;
  generatorMetaHtml: string;
  navRailContextHtml: string;
  angleSelectHtml: string;
  toolbarDocHubHtml: string;
  navRailDocumentedHtml: string;
  relatedNavHtml: string;
  toolbarEndHtml: string;
  pageFooterHtml: string;
  /** `dual`: resizable panes; `stretch`: rowspan table aligned to index blocks. */
  layout: "dual" | "stretch";
  shellInner: string;
  rawCodeB64: string;
  rawMdB64: string;
  /** Base64 JSON of `BlockScrollLink[]` when dual pane uses index-backed scroll sync; empty otherwise. */
  scrollBlockLinksB64: string;
  /** When non-empty, ` data-documented-pairs-b64="…"` on `#shell` for offline tree hydration. */
  shellDocumentedPairsAttr: string;
  hljs: string;
  hljsDark: string;
  mermaidScript: string;
  searchPlaceholder: string;
  shellSearchAttrs: string;
  /** Base64 JSON payload for multi-angle static browsing (see `code-browser-client.ts`). */
  multiAngleScriptBlock: string;
};

function buildCodeBrowserPageHtml(p: CodeBrowserPageParts): string {
  const shellClass = p.layout === "stretch" ? "shell shell--stretch-rows" : "shell";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${p.generatorMetaHtml}<title>${escapeHtml(p.title)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      p.hljs,
    )}.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      p.hljsDark,
    )}.min.css" media="(prefers-color-scheme: dark)" />
    <style>
${CODE_BROWSER_STYLES}
    </style>
  </head>
  <body>
    <div class="app">
      <header class="toolbar" aria-label="View options">
        <div class="toolbar__main">
          ${p.navRailContextHtml}
          ${p.navRailDocumentedHtml}
          ${p.angleSelectHtml}
          ${p.toolbarDocHubHtml}
          ${p.relatedNavHtml}
          <label><input type="checkbox" id="wrap-lines" /> Wrap code lines</label>
        </div>
        ${p.toolbarEndHtml}
      </header>
      <header class="app__chrome" role="region" aria-label="Search">
        <div class="chrome__search-row">
          <label class="chrome__search-label nav-rail__search-label" for="search-q">Search</label>
          <input type="search" id="search-q" placeholder="${escapeHtml(p.searchPlaceholder)}" title="${escapeHtml(CODE_BROWSER_SEARCH_INPUT_TITLE)}" autocomplete="off" spellcheck="false" />
          <button type="button" id="search-clear" title="Clear search">Clear</button>
        </div>
        <div class="search-results" id="search-results" hidden aria-live="polite"></div>
        <p class="nav-rail__search-hint chrome__search-hint">This pair + merged <code class="nav-rail__code">commentray-nav-search.json</code> when the export ships it.</p>
      </header>
      <div class="app__main">
        <div class="${shellClass}" id="shell" data-layout="${p.layout}" data-raw-code-b64="${escapeHtml(p.rawCodeB64)}" data-raw-md-b64="${escapeHtml(p.rawMdB64)}" data-scroll-block-links-b64="${escapeHtml(p.scrollBlockLinksB64)}"${p.shellDocumentedPairsAttr}${p.shellSearchAttrs}>
${p.shellInner}
        </div>
      </div>
      ${p.pageFooterHtml}
    </div>
    <script type="text/plain" id="commentray-multi-angle-b64">${p.multiAngleScriptBlock}</script>
    <script>
${loadCodeBrowserClientBundle()}
    </script>
    ${p.mermaidScript}
  </body>
</html>`;
}

type CodeBrowserShell = {
  layout: "dual" | "stretch";
  shellInner: string;
  scrollBlockLinksB64: string;
  angleSelectHtml: string;
  multiAnglePayloadB64: string;
  /** When multi-angle browsing is active, overrides shell `data-raw-md-b64` / search path / GitHub link. */
  multiShell?: {
    rawMdB64: string;
    scrollBlockLinksB64: string;
    commentrayPathForSearch: string;
    commentrayOnGithubUrl?: string;
  };
};

type MultiAngleJsonRow = {
  id: string;
  title: string;
  docInnerHtmlB64: string;
  rawMdB64: string;
  scrollBlockLinksB64: string;
  commentrayPathForSearch: string;
  commentrayOnGithubUrl?: string;
};

async function buildMultiAngleDualPaneShell(
  opts: CodeBrowserPageOptions,
  multi: CodeBrowserMultiAngleBrowsing,
): Promise<{
  shellInner: string;
  multiShell: NonNullable<CodeBrowserShell["multiShell"]>;
  angleSelectHtml: string;
  multiAnglePayloadB64: string;
}> {
  const defaultId = multi.angles.some((a) => a.id === multi.defaultAngleId)
    ? multi.defaultAngleId
    : (multi.angles[0]?.id ?? "main");
  const jsonAngles: MultiAngleJsonRow[] = [];
  let defaultMarkdown = opts.commentrayMarkdown;
  let defaultScrollB64 = "";
  let defaultPathSearch = (opts.commentrayPathForSearch ?? "").trim();
  let defaultGh = opts.commentrayOnGithubUrl;
  let defaultPaneHtml = "";

  const codeHtml = await renderHighlightedCodeLineRows(opts.code, opts.language);

  for (const spec of multi.angles) {
    const rows = spec.blockStretchRows;
    const links =
      rows !== undefined
        ? buildBlockScrollLinks(
            rows.index,
            rows.sourceRelative,
            rows.commentrayPathRel,
            spec.markdown,
            opts.code,
          )
        : [];
    const mdForDoc = injectCommentrayDocAnchors(
      spec.markdown,
      links.length > 0 ? links : undefined,
    );
    const scrollB64 =
      links.length > 0 ? Buffer.from(JSON.stringify(links), "utf8").toString("base64") : "";
    const commentrayHtml = await renderMarkdownToHtml(mdForDoc, {
      commentrayOutputUrls: opts.commentrayOutputUrls,
    });
    if (spec.id === defaultId) {
      defaultMarkdown = spec.markdown;
      defaultScrollB64 = scrollB64;
      defaultPathSearch = spec.commentrayPathRel.trim();
      defaultGh = spec.commentrayOnGithubUrl;
      defaultPaneHtml = commentrayHtml;
    }
    jsonAngles.push({
      id: spec.id,
      title: spec.title?.trim() || spec.id,
      docInnerHtmlB64: Buffer.from(commentrayHtml, "utf8").toString("base64"),
      rawMdB64: Buffer.from(spec.markdown, "utf8").toString("base64"),
      scrollBlockLinksB64: scrollB64,
      commentrayPathForSearch: spec.commentrayPathRel.trim(),
      commentrayOnGithubUrl: spec.commentrayOnGithubUrl,
    });
  }

  const selOpts = multi.angles
    .map((a) => {
      const lab = escapeHtml(a.title?.trim() || a.id);
      return `<option value="${escapeHtml(a.id)}"${a.id === defaultId ? " selected" : ""}>${lab}</option>`;
    })
    .join("");
  const angleSelectHtml = `<span class="toolbar-angle-picker"><label for="angle-select">Angle</label><select id="angle-select" aria-label="Commentray angle">${selOpts}</select></span>`;

  const shellInner =
    `        <section class="pane--code" id="code-pane" aria-label="Source code">` +
    `          ${codeHtml}\n` +
    `        </section>\n` +
    `        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>\n` +
    `        <section class="pane--doc commentray" id="doc-pane" aria-label="Commentray">\n` +
    `          <div id="doc-pane-body" class="doc-pane-body">\n` +
    `          ${defaultPaneHtml}\n` +
    `          </div>\n` +
    `        </section>\n`;

  const payloadObj = { defaultAngleId: defaultId, angles: jsonAngles };
  const multiAnglePayloadB64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64");

  return {
    shellInner,
    multiShell: {
      rawMdB64: Buffer.from(defaultMarkdown, "utf8").toString("base64"),
      scrollBlockLinksB64: defaultScrollB64,
      commentrayPathForSearch: defaultPathSearch,
      commentrayOnGithubUrl: defaultGh,
    },
    angleSelectHtml,
    multiAnglePayloadB64,
  };
}

async function buildCodeBrowserShell(
  opts: CodeBrowserPageOptions,
  layoutPref: "auto" | "dual",
): Promise<CodeBrowserShell> {
  let layout: "dual" | "stretch" = "dual";
  let shellInner = "";
  let scrollBlockLinksB64 = "";

  const multi = opts.multiAngleBrowsing;
  const multiActive = Boolean(multi && multi.angles.length >= 2);

  if (multiActive && multi) {
    const built = await buildMultiAngleDualPaneShell(opts, multi);
    const ms = built.multiShell;
    return {
      layout: "dual",
      shellInner: built.shellInner,
      scrollBlockLinksB64: ms.scrollBlockLinksB64,
      angleSelectHtml: built.angleSelectHtml,
      multiAnglePayloadB64: built.multiAnglePayloadB64,
      multiShell: ms,
    };
  }

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
      shellInner = `        ${stretched.preambleHtml}\n` + `        ${stretched.tableInnerHtml}\n`;
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
    const mdForDoc = injectCommentrayDocAnchors(
      opts.commentrayMarkdown,
      links.length > 0 ? links : undefined,
    );
    if (links.length > 0) {
      scrollBlockLinksB64 = Buffer.from(JSON.stringify(links), "utf8").toString("base64");
    }
    const [codeHtml, commentrayHtml] = await Promise.all([
      renderHighlightedCodeLineRows(opts.code, opts.language),
      renderMarkdownToHtml(mdForDoc, {
        commentrayOutputUrls: opts.commentrayOutputUrls,
      }),
    ]);
    shellInner =
      `        <section class="pane--code" id="code-pane" aria-label="Source code">` +
      `          ${codeHtml}\n` +
      `        </section>\n` +
      `        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>\n` +
      `        <section class="pane--doc commentray" id="doc-pane" aria-label="Commentray">\n` +
      `          <div id="doc-pane-body" class="doc-pane-body">\n` +
      `          ${commentrayHtml}\n` +
      `          </div>\n` +
      `        </section>\n`;
  }

  return {
    layout,
    shellInner,
    scrollBlockLinksB64,
    angleSelectHtml: "",
    multiAnglePayloadB64: "",
  };
}

function searchChromeFromOptions(
  opts: CodeBrowserPageOptions,
  commentrayPathOverride?: string,
): {
  searchPlaceholder: string;
  shellSearchAttrs: string;
} {
  const crPath = (commentrayPathOverride ?? opts.commentrayPathForSearch ?? "").trim();
  if (opts.staticSearchScope === "commentray-and-paths") {
    return {
      searchPlaceholder: "Filename, path, or keywords…",
      shellSearchAttrs: ` data-search-scope="commentray-and-paths" data-search-file-path="${escapeHtml(
        opts.filePath ?? "",
      )}" data-search-commentray-path="${escapeHtml(crPath)}"`,
    };
  }
  return {
    searchPlaceholder: "Filename, path, or keywords…",
    shellSearchAttrs: "",
  };
}

function shellDocumentedPairsAttrFromOptions(opts: CodeBrowserPageOptions): string {
  const emb = opts.documentedPairsEmbeddedB64?.trim() ?? "";
  if (emb.length === 0) return "";
  return ` data-documented-pairs-b64="${escapeHtml(emb)}"`;
}

function codeBrowserPageTitle(opts: CodeBrowserPageOptions): string {
  return opts.title ?? opts.filePath ?? "Commentray";
}

function codeBrowserHljsThemes(opts: CodeBrowserPageOptions): { hljs: string; hljsDark: string } {
  const hljs = opts.hljsTheme ?? "github";
  const hljsDark = opts.hljsTheme?.includes("dark") ? opts.hljsTheme : "github-dark";
  return { hljs, hljsDark };
}

function toolbarCommentrayGithubFromShell(
  shell: CodeBrowserShell,
  opts: CodeBrowserPageOptions,
): string | undefined {
  return shell.multiShell?.commentrayOnGithubUrl ?? opts.commentrayOnGithubUrl;
}

function rawMdB64FromShell(shell: CodeBrowserShell, opts: CodeBrowserPageOptions): string {
  return (
    shell.multiShell?.rawMdB64 ?? Buffer.from(opts.commentrayMarkdown, "utf8").toString("base64")
  );
}

function navRailCommentrayPathFromShell(
  shell: CodeBrowserShell,
  opts: CodeBrowserPageOptions,
): string | undefined {
  const trimmed = (
    shell.multiShell?.commentrayPathForSearch ??
    opts.commentrayPathForSearch ??
    ""
  ).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function shellSearchAttrsWithNavJson(
  shellSearchAttrsBase: string,
  documentedNavJsonUrl?: string,
): string {
  const navJson = documentedNavJsonUrl?.trim() ?? "";
  if (navJson.length === 0) return shellSearchAttrsBase;
  return `${shellSearchAttrsBase} data-nav-search-json-url="${escapeHtml(navJson)}"`;
}

/**
 * Static HTML shell for a minimal “code browser”: code + rendered commentray,
 * draggable vertical splitter, togglable line wrap for the code pane, and
 * token-in-line quick search (all non-whitespace tokens must appear on the same line).
 */
export async function renderCodeBrowserHtml(opts: CodeBrowserPageOptions): Promise<string> {
  const rawCodeB64 = Buffer.from(opts.code, "utf8").toString("base64");

  const title = codeBrowserPageTitle(opts);
  const builtAt = opts.builtAt ?? new Date();
  const renderSemver = commentrayRenderVersion();
  const toolbarEndHtml = buildToolbarEndHtml(opts.githubRepoUrl, opts.toolHomeUrl, renderSemver);
  const pageFooterHtml = renderPageFooterHtml(builtAt);
  const { hljs, hljsDark } = codeBrowserHljsThemes(opts);

  const mermaidScript = mermaidRuntimeScriptHtml(opts.includeMermaidRuntime);

  const relatedNavHtml = renderRelatedGithubNavHtml(opts.relatedGithubNav ?? []);
  const generatorMetaHtml = renderGeneratorMetaHtml(opts.generatorLabel);

  const layoutPref = opts.codeBrowserLayout ?? "auto";
  const shell = await buildCodeBrowserShell(opts, layoutPref);

  const { toolbarDocHubHtml, navRailDocumentedHtml } = renderToolbarDocHubHtml({
    documentedNavJsonUrl: opts.documentedNavJsonUrl,
    documentedPairsEmbeddedB64: opts.documentedPairsEmbeddedB64,
  });

  const rawMdB64 = rawMdB64FromShell(shell, opts);
  const scrollBlockLinksB64 = shell.scrollBlockLinksB64;

  const { searchPlaceholder, shellSearchAttrs: shellSearchAttrsBase } = searchChromeFromOptions(
    opts,
    shell.multiShell?.commentrayPathForSearch,
  );
  const shellDocumentedPairsAttr = shellDocumentedPairsAttrFromOptions(opts);
  const shellSearchAttrs = shellSearchAttrsWithNavJson(
    shellSearchAttrsBase,
    opts.documentedNavJsonUrl,
  );
  const navRailContextHtml = renderNavRailContextHtml(
    opts.filePath,
    navRailCommentrayPathFromShell(shell, opts),
    {
      sourceOnGithubUrl: opts.sourceOnGithubUrl,
      commentrayOnGithubUrl: toolbarCommentrayGithubFromShell(shell, opts),
    },
  );

  return buildCodeBrowserPageHtml({
    title,
    generatorMetaHtml,
    navRailContextHtml,
    angleSelectHtml: shell.angleSelectHtml,
    toolbarDocHubHtml,
    navRailDocumentedHtml,
    relatedNavHtml,
    toolbarEndHtml,
    pageFooterHtml,
    layout: shell.layout,
    shellInner: shell.shellInner,
    rawCodeB64,
    rawMdB64,
    scrollBlockLinksB64,
    shellDocumentedPairsAttr,
    hljs,
    hljsDark,
    mermaidScript,
    searchPlaceholder,
    shellSearchAttrs,
    multiAngleScriptBlock: shell.multiAnglePayloadB64,
  });
}
