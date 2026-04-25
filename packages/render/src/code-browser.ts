import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MARKER_ID_BODY,
  buildBlockScrollLinks,
  type BlockScrollLink,
  type CommentrayIndex,
  findMonorepoPackagesDir,
  monorepoLayoutStartDir,
} from "@commentray/core";

import { tryBuildBlockStretchTableHtml } from "./block-stretch-layout.js";
import { formatCommentrayBuiltAtLocal } from "./build-stamp.js";
import { escapeHtml } from "./html-utils.js";
import { commentrayColorThemeHeadBoot } from "./code-browser-color-theme.js";
import { hljsStylesheetThemes } from "./hljs-stylesheet-themes.js";
import { renderHighlightedCodeLineRows } from "./highlighted-code-lines.js";
import { COMMENTRAY_FAVICON_LINK_HTML } from "./inline-favicon.js";
import { mermaidRuntimeScriptHtml } from "./mermaid-runtime-html.js";
import { type CommentrayOutputUrlOptions, renderMarkdownToHtml } from "./markdown-pipeline.js";
import { commentrayRenderVersion } from "./package-version.js";
import { normPosixPath } from "./code-browser-pair-nav.js";

/** One angle tab for {@link CodeBrowserPageOptions.multiAngleBrowsing}. */
export type CodeBrowserMultiAngleSpec = {
  id: string;
  title?: string;
  markdown: string;
  commentrayPathRel: string;
  commentrayOnGithubUrl?: string;
  /**
   * When the static site emits `_site/browse/<slug>.html` per pair, same-tab navigation for the
   * Doc toolbar control (preferred over {@link commentrayOnGithubUrl} on the hub).
   */
  staticBrowseUrl?: string;
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
   * When {@link siteHubUrl} is set (static hub export), that link takes this slot instead.
   */
  githubRepoUrl?: string;
  /**
   * Same-site URL for the static documentation hub (e.g. `./` on `index.html`, `../index.html`
   * under `browse/`). When set, the first toolbar control is a **home** link here instead of
   * {@link githubRepoUrl}. Uses the same path safety rules as {@link commentrayStaticBrowseUrl}.
   */
  siteHubUrl?: string;
  /**
   * Home URL for the Commentray project (footer shows "Rendered with Commentray" plus semver
   * and build date/time, linking here).
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
   * `<meta name="description">` content. When omitted, a short string is derived from the page title.
   */
  metaDescription?: string;
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
   * When set (e.g. `./browse/<slug>.html` from the static Pages build), the Doc toolbar icon
   * opens this URL on the **same origin** instead of GitHub.
   */
  commentrayStaticBrowseUrl?: string;
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

const META_DESCRIPTION_MAX_LEN = 320;

function codeBrowserMetaDescription(opts: CodeBrowserPageOptions, title: string): string {
  const custom = opts.metaDescription?.trim();
  if (custom) return custom.slice(0, META_DESCRIPTION_MAX_LEN);
  const fallback = `${title} — Side-by-side source and commentray documentation.`;
  return fallback.slice(0, META_DESCRIPTION_MAX_LEN);
}

function renderMetaDescriptionHtml(opts: CodeBrowserPageOptions, title: string): string {
  const content = codeBrowserMetaDescription(opts, title);
  return `<meta name="description" content="${escapeHtml(content)}" />\n    `;
}

/** Single capture: marker id (avoid a wrapping group around the whole comment — that shifted indices). */
const BLOCK_MARKER_HTML_LINE = new RegExp(
  `^<!--\\s*commentray:block\\s+id=(${MARKER_ID_BODY})\\s*-->$`,
  "i",
);
const PAGE_BREAK_MARKER_HTML_LINE = /^<!--\s*commentray:page-break\s*-->$/i;

function trimEndSpacesTabs(s: string): string {
  let end = s.length;
  while (end > 0) {
    const c = s[end - 1];
    if (c !== " " && c !== "\t") break;
    end--;
  }
  return s.slice(0, end);
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

/**
 * GFM delimiter row: cells between pipes contain only colons, hyphens, and spaces; each cell has
 * at least three hyphens (same rule remark-gfm uses). Used so we do not append raw HTML to table
 * lines — trailing `<span>` breaks GFM table recognition in the Markdown parser.
 */
function isGfmTableDelimiterRow(line: string): boolean {
  const t = trimEndSpacesTabs(line);
  if (!t.includes("|")) return false;
  const cells = t
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (cells.length === 0) return false;
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return false;
  }
  return true;
}

/**
 * 0-based line indices that must not receive a trailing line-anchor span: they belong to a GFM
 * table (header + delimiter + following rows until a blank line). Scans full `lines` so indices
 * align with {@link injectCommentrayDocAnchors}; lines inside fenced code are harmless to mark
 * because that pass never appends anchors there anyway.
 */
function gfmTableLineIndicesWithoutAnchors(lines: string[]): Set<number> {
  const skip = new Set<number>();
  const n = lines.length;
  for (let i = 0; i < n - 1; i++) {
    const header = lines[i] ?? "";
    const delim = lines[i + 1] ?? "";
    if (header === "") continue;
    if (!trimEndSpacesTabs(header).includes("|")) continue;
    if (isSetextUnderlineLine(header) || isThematicBreakLine(header)) continue;
    if (!isGfmTableDelimiterRow(delim)) continue;
    skip.add(i);
    skip.add(i + 1);
    let j = i + 2;
    while (j < n) {
      const row = lines[j] ?? "";
      if (row === "") break;
      if (isSetextUnderlineLine(row) || isThematicBreakLine(row)) break;
      if (isGfmTableDelimiterRow(row)) break;
      skip.add(j);
      j++;
    }
  }
  return skip;
}

function lineAnchorHtml(mdLine0: number): string {
  const mdLine = String(mdLine0);
  return `<span class="commentray-line-anchor" data-commentray-md-line="${mdLine}" id="commentray-md-line-${mdLine}" aria-hidden="true"></span>`;
}

function sourceLineAnchorHtml(line0: number): string {
  const s = String(line0);
  return `<span class="commentray-line-anchor commentray-line-anchor--source" data-source-md-line="${s}" id="code-md-line-${s}" aria-hidden="true"></span>`;
}

function appendMdLineAnchorWhenAllowed(line: string, mdLine0: number): string {
  if (isSetextUnderlineLine(line) || isThematicBreakLine(line)) return line;
  /** Blank lines must stay blank: a line that is only `<span …>` breaks CommonMark HTML / paragraph starts after block markers. */
  if (line === "") return "";
  return `${line}${lineAnchorHtml(mdLine0)}`;
}

function appendSourceMdLineAnchorWhenAllowed(line: string, line0: number): string {
  if (isSetextUnderlineLine(line) || isThematicBreakLine(line)) return line;
  if (line === "") return "";
  return `${line}${sourceLineAnchorHtml(line0)}`;
}

type PageBreakNextBlockMeta = {
  commentrayLine: number;
  sourceStart?: number;
};

function pageBreakNextBlockMetaByLine(
  lines: string[],
  byId?: Map<string, BlockScrollLink>,
): Map<number, PageBreakNextBlockMeta> {
  const out = new Map<number, PageBreakNextBlockMeta>();
  let nextMeta: PageBreakNextBlockMeta | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    const blockMatch = BLOCK_MARKER_HTML_LINE.exec(line);
    if (blockMatch?.[1]) {
      const id = blockMatch[1];
      const sourceStart = byId?.get(id)?.sourceStart;
      nextMeta =
        sourceStart !== undefined ? { commentrayLine: i, sourceStart } : { commentrayLine: i };
      continue;
    }
    if (!PAGE_BREAK_MARKER_HTML_LINE.test(line) || nextMeta === null) continue;
    out.set(i, nextMeta);
  }
  return out;
}

/**
 * Inserts per-line anchors for search / hash jumps and block separator anchors after each
 * `<!-- commentray:block … -->` line (optional index attrs).
 *
 * Anchors are appended to the line when safe. A **leading** `<span>` breaks CommonMark block
 * recognition (`#` headings, lists, thematic breaks, fences). Fenced code lines must not get a
 * trailing anchor either (would corrupt fence delimiters or appear inside code). **GFM pipe
 * tables** must not get a trailing anchor: extra HTML after the row breaks `remark-gfm` table
 * detection, so tables would render as plain text.
 */
function injectCommentrayDocAnchors(markdown: string, links?: BlockScrollLink[]): string {
  const byId = links ? new Map(links.map((l) => [l.id, l])) : undefined;
  const lines = markdown.split("\n");
  const pageBreakNextByLine = pageBreakNextBlockMetaByLine(lines, byId);
  const skipLineAnchor = gfmTableLineIndicesWithoutAnchors(lines);
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

    if (PAGE_BREAK_MARKER_HTML_LINE.test(line)) {
      const next = pageBreakNextByLine.get(i);
      const nextCommentrayAttr =
        next !== undefined ? ` data-next-commentray-line="${String(next.commentrayLine)}"` : "";
      const nextSourceAttr =
        next?.sourceStart !== undefined
          ? ` data-next-source-start="${String(next.sourceStart)}"`
          : "";
      out.push(`${line}${lineAnchorHtml(i)}`);
      out.push("");
      out.push(
        `<div class="commentray-page-break" data-commentray-page-break="true"${nextCommentrayAttr}${nextSourceAttr} aria-hidden="true"><div class="commentray-page-break__rule"></div></div>`,
      );
      out.push("");
      continue;
    }

    if (skipLineAnchor.has(i)) {
      out.push(line);
      continue;
    }

    out.push(appendMdLineAnchorWhenAllowed(line, i));
  }

  return out.join("\n");
}

/**
 * Adds stable source-line anchors (`id="code-line-N"`) to Markdown so rendered-source mode can
 * preserve block-aware scroll sync and block ray geometry.
 */
function injectSourceMarkdownAnchors(markdown: string): string {
  const lines = markdown.split("\n");
  const skipLineAnchor = gfmTableLineIndicesWithoutAnchors(lines);
  let fence: FenceState | null = null;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
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
    if (skipLineAnchor.has(i)) {
      out.push(line);
      continue;
    }
    out.push(appendSourceMdLineAnchorWhenAllowed(line, i));
  }
  return out.join("\n");
}

/** GitHub “mark” glyph (Octicons-style path), MIT-licensed silhouette. */
const GITHUB_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>' +
  "</svg>";

/** Simple home glyph for same-site hub link (matches Octocat control size). */
const SITE_HOME_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
  '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' +
  "</svg>";

/** Folder-with-list glyph (file tree / documented pairs hub). */
const TOOLBAR_ICON_TREE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 20h16a1 1 0 0 0 1-1V9a2 2 0 0 0-2-2h-5.5a2 2 0 0 1-1.6-.8L10.5 4.5a2 2 0 0 0-1.6-.8H5a2 2 0 0 0-2 2v14a1 1 0 0 0 1 1Z"/>' +
  '<path d="M8 12h8M8 16h6M8 20h4"/>' +
  "</svg>";

/**
 * Line wrap — Material "wrap_text" glyph (Apache-2.0), same visual family as
 * https://www.svgrepo.com/svg/376703/text-wrap-line (filled 24dp path scaled to 18px).
 */
const TOOLBAR_ICON_WRAP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
  '<path d="M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3 3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"/>' +
  "</svg>";

const CHROME_ICON_SEARCH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="11" cy="11" r="7"/>' +
  '<path d="m21 21-4.3-4.3"/>' +
  "</svg>";

/** Swap / flip: circle split by a diameter, one arrow per half (narrow viewports). */
const TOOLBAR_ICON_FLIP_PANES_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M12 4v16"/>' +
  '<path d="M10.5 12H6l2.5-2.5M6 12l2.5 2.5"/>' +
  '<path d="M13.5 12H18l-2.5-2.5M18 12l-2.5 2.5"/>' +
  "</svg>";

/** Source markdown mode flip: rendered page <-> plain markdown rows. */
const TOOLBAR_ICON_FLIP_SOURCE_MARKDOWN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="4" width="8" height="16" rx="1.5"/>' +
  '<path d="M6 8h2M6 11h2M6 14h2"/>' +
  '<rect x="13" y="4" width="8" height="16" rx="1.5"/>' +
  '<path d="m15.5 12 2-2 2 2"/>' +
  '<path d="m19.5 12-2 2-2-2"/>' +
  "</svg>";

/** Link/share glyph for copying a permalink to the current documentation pair. */
const TOOLBAR_ICON_SHARE_LINK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 6"/>' +
  '<path d="M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07L14 17"/>' +
  "</svg>";

/** Help glyph for re-running the onboarding walkthrough. */
const TOOLBAR_ICON_HELP_TOUR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M9.1 9a3 3 0 1 1 4.92 2.3c-.8.6-1.52 1.08-1.52 2.2"/>' +
  '<circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/>' +
  "</svg>";

function safeExternalHttpUrl(url: string | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  return t;
}

/** Allows relative static browse links (`./browse/…`) and `http(s):` URLs; rejects `javascript:` / `data:`. */
function safeToolbarNavigationHref(url: string | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (/^(javascript|data):/i.test(t)) return null;
  return t;
}

function buildToolbarSiteHubHtml(siteHubUrl: string | undefined): string {
  const site = safeToolbarNavigationHref(siteHubUrl);
  if (!site) return "";
  const se = escapeHtml(site);
  return `<a class="toolbar-github" href="${se}" aria-label="Documentation home" title="Back to this site (hub)">${SITE_HOME_SVG}</a>`;
}

/** GitHub Octocat in the toolbar when a repo URL is set and the hub link does not replace it. */
function buildToolbarEndHtml(
  githubRepoUrl: string | undefined,
  siteHubUrl: string | undefined,
): string {
  const site = safeToolbarNavigationHref(siteHubUrl);
  const gh = safeExternalHttpUrl(githubRepoUrl);
  if (!site && gh) {
    const he = escapeHtml(gh);
    return `<div class="toolbar__end"><a class="toolbar-github" href="${he}" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub" title="View repository on GitHub">${GITHUB_MARK_SVG}</a></div>`;
  }
  return "";
}

function renderPageFooterHtml(input: {
  builtAt: Date;
  toolHomeUrl: string | undefined;
  commentrayRenderSemver: string;
}): string {
  const { builtAt, toolHomeUrl, commentrayRenderSemver } = input;
  const iso = builtAt.toISOString();
  const human = formatCommentrayBuiltAtLocal(builtAt);
  const tool = safeExternalHttpUrl(toolHomeUrl);
  if (tool) {
    const te = escapeHtml(tool);
    const ver = escapeHtml(commentrayRenderSemver);
    return (
      `<footer class="app__footer" role="contentinfo">` +
      `<p class="app__footer-line app__footer-attribution" role="note">` +
      `Rendered with <a href="${te}" target="_blank" rel="noopener noreferrer">Commentray</a> ` +
      `<span class="app__footer-attribution__version" translate="no">v${ver}</span>: ` +
      `<time datetime="${escapeHtml(iso)}">${escapeHtml(human)}</time>` +
      `</p>` +
      `</footer>`
    );
  }
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
        <summary class="nav-rail__doc-hub-summary" title="Comment-rayed files" aria-label="Comment-rayed files"><span class="nav-rail__doc-hub-summary__caption">Comment-rayed files</span><span class="nav-rail__doc-hub-summary__glyph" aria-hidden="true">${TOOLBAR_ICON_TREE_SVG}</span></summary>
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

function dualPanePanesInnerHtml(
  codeHtml: string,
  commentrayHtml: string,
  sourceMarkdownRenderedHtml?: string,
): string {
  const sourceRenderedPaneHtml =
    typeof sourceMarkdownRenderedHtml === "string" && sourceMarkdownRenderedHtml.trim().length > 0
      ? `          <div class="source-pane source-pane--rendered-md" id="code-pane-markdown-body">${sourceMarkdownRenderedHtml}</div>\n`
      : "";
  return (
    `        <section class="pane--code" id="code-pane" aria-label="Source code">` +
    `          <div class="source-pane source-pane--code" id="code-pane-code-body">${codeHtml}</div>\n` +
    sourceRenderedPaneHtml +
    `        </section>\n` +
    `        <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>\n` +
    `        <section class="pane--doc commentray" id="doc-pane" aria-label="Commentray">\n` +
    `          <div id="doc-pane-body" class="doc-pane-body">\n` +
    `          ${commentrayHtml}\n` +
    `          </div>\n` +
    `        </section>\n`
  );
}

function sourceMarkdownToggleControlsHtml(enabled: boolean): {
  sourceMarkdownToggleHtml: string;
  sourceMarkdownFlipScrollAffordanceHtml: string;
} {
  if (!enabled) {
    return { sourceMarkdownToggleHtml: "", sourceMarkdownFlipScrollAffordanceHtml: "" };
  }
  const label = "Switch source pane between rendered markdown and markdown source";
  const title = "Switch source pane between rendered markdown and markdown source";
  const btn = `<button type="button" id="source-markdown-pane-flip" class="toolbar-source-render-toggle" aria-controls="code-pane" aria-pressed="false" aria-label="${label}" title="${title}"><span class="toolbar-source-render-toggle__box" aria-hidden="true"></span><span class="toolbar-source-render-toggle__face" aria-hidden="true">${TOOLBAR_ICON_FLIP_SOURCE_MARKDOWN_SVG}</span><span class="toolbar-source-render-toggle__caption">Render</span></button>`;
  const floating = `<button type="button" id="source-markdown-pane-flip-scroll" class="toolbar-icon-btn toolbar-icon-btn--source-markdown-scroll-narrow" hidden aria-controls="code-pane" aria-pressed="false" aria-label="${label}" title="${title}">${TOOLBAR_ICON_FLIP_SOURCE_MARKDOWN_SVG}</button>`;
  return {
    sourceMarkdownToggleHtml: btn,
    sourceMarkdownFlipScrollAffordanceHtml: floating,
  };
}

function isMarkdownLikeSource(opts: CodeBrowserPageOptions): boolean {
  const lang = opts.language.trim().toLowerCase();
  if (lang === "md" || lang === "markdown" || lang === "mdx") return true;
  const path = (opts.filePath ?? "").trim().toLowerCase();
  return path.endsWith(".md") || path.endsWith(".mdx") || path.endsWith(".markdown");
}

/** Plain-text Src/Doc labels above the panes; column widths track the resizable split via `--split-pct`. */
function renderShellPairContextHtml(
  filePath: string | undefined,
  commentrayPath: string | undefined,
): string {
  const fpRaw = (filePath ?? "").trim();
  const crRaw = (commentrayPath ?? "").trim();
  if (fpRaw.length === 0 && crRaw.length === 0) return "";
  const fp = escapeHtml(fpRaw);
  const cr = escapeHtml(crRaw);
  const fpDisp = fpRaw.length > 0 ? fp : "—";
  const crDisp = crRaw.length > 0 ? cr : "—";
  return `<div class="shell__pair-context" aria-label="Current documentation pair">
    <div class="shell__pair-cell shell__pair-cell--src">
      <span class="shell__pair-lab">Src</span>
      <span class="shell__pair-path" title="${fp}">${fpDisp}</span>
    </div>
    <div class="shell__pair-gutter-spacer" aria-hidden="true"></div>
    <div class="shell__pair-cell shell__pair-cell--doc">
      <span class="shell__pair-lab">Doc</span>
      <span class="shell__pair-path shell__pair-path--secondary" id="nav-rail-doc-path" title="${cr}">${crDisp}</span>
    </div>
  </div>`;
}

function wrapDualShellInner(pairContextHtml: string, panesHtml: string): string {
  const row = pairContextHtml.trim().length > 0 ? `        ${pairContextHtml.trim()}\n` : "";
  return `${row}        <div class="shell__panes">\n${panesHtml}        </div>\n`;
}

/** IIFE produced by `npm run build -w @commentray/render` (esbuild of `code-browser-client.ts`). */
function loadCodeBrowserClientBundle(): string {
  const packagesDir = findMonorepoPackagesDir(monorepoLayoutStartDir(import.meta.url));
  const renderDistDir = join(packagesDir, "render", "dist");
  const inDist = join(renderDistDir, "code-browser-client.bundle.js");
  const fromSrc = join(packagesDir, "render", "code-browser-client.bundle.js");
  for (const p of [inDist, fromSrc]) {
    if (existsSync(p)) {
      return readFileSync(p, "utf8");
    }
  }
  throw new Error(
    "Missing code-browser-client.bundle.js. Run `npm run build -w @commentray/render` to bundle the browser client.",
  );
}

/** Intro-tour specific stylesheet; kept in a dedicated CSS file for easier tweaking. */
function loadCodeBrowserIntroStyles(): string {
  const packagesDir = findMonorepoPackagesDir(monorepoLayoutStartDir(import.meta.url));
  const renderDistDir = join(packagesDir, "render", "dist");
  const inDist = join(renderDistDir, "code-browser-intro.css");
  const fromSrc = join(packagesDir, "render", "src", "code-browser-intro.css");
  for (const p of [inDist, fromSrc]) {
    if (existsSync(p)) {
      return readFileSync(p, "utf8");
    }
  }
  throw new Error(
    "Missing code-browser-intro.css. Ensure the render package includes intro tour styles.",
  );
}

/**
 * Compact theme control: primary click opens a menu (readme.io–style), secondary click cycles
 * system → light → dark. Paired with {@link ./code-browser-color-theme.ts} and the client bundle.
 */
const TOOLBAR_COLOR_THEME_HTML = `          <div class="toolbar-theme">
            <button type="button" id="commentray-theme-trigger" class="toolbar-theme__trigger" data-commentray-trigger-mode="system" aria-haspopup="menu" aria-expanded="false" aria-label="Color theme" title="Appearance: left-click opens the theme menu. Right-click cycles System, Light, and Dark.">
              <span class="toolbar-theme__icon toolbar-theme__icon--system" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg></span>
              <span class="toolbar-theme__icon toolbar-theme__icon--light" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 6.34L4.93 4.93m12.02 12.02l1.41 1.41M17.66 6.34l1.41-1.41M6.34 17.66l-1.41 1.41"/></svg></span>
              <span class="toolbar-theme__icon toolbar-theme__icon--dark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>
            </button>
            <div id="commentray-theme-menu" class="toolbar-theme__menu" role="menu" hidden aria-labelledby="commentray-theme-trigger">
              <button type="button" role="menuitemradio" class="toolbar-theme__menuitem" data-commentray-theme-value="system" aria-checked="true">System</button>
              <button type="button" role="menuitemradio" class="toolbar-theme__menuitem" data-commentray-theme-value="light" aria-checked="false">Light</button>
              <button type="button" role="menuitemradio" class="toolbar-theme__menuitem" data-commentray-theme-value="dark" aria-checked="false">Dark</button>
            </div>
          </div>
`;

const TOOLBAR_SHARE_LINK_HTML = `          <button type="button" id="commentray-share-link" class="toolbar-theme__trigger toolbar-share-link-btn" aria-label="Copy shareable permalink" title="Copy shareable permalink">${TOOLBAR_ICON_SHARE_LINK_SVG}</button>
`;

const TOOLBAR_HELP_TOUR_HTML = `          <button type="button" id="commentray-help-tour" class="toolbar-theme__trigger toolbar-help-tour-btn" aria-label="Restart onboarding walkthrough" title="Restart onboarding walkthrough">${TOOLBAR_ICON_HELP_TOUR_SVG}</button>
`;

const CODE_BROWSER_INTRO_STYLES = loadCodeBrowserIntroStyles();

const CODE_BROWSER_STYLES = `
      :root {
        --cr-control-h: 32px;
        --cr-control-radius: 8px;
        --cr-icon-inner: 18px;
        --cr-label-caps-fs: 10px;
        --cr-label-caps-track: 0.06em;
        --cr-ui-fs: 12px;
        /** Matches code/doc pane horizontal padding so pair-context rows line up with pane content (e.g. line nums). */
        --cr-pane-inline-pad: 12px;
      }
      :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) {
        color-scheme: light dark;
      }
      :root[data-commentray-theme="light"] {
        color-scheme: light;
      }
      :root[data-commentray-theme="dark"] {
        color-scheme: dark;
      }
      * { box-sizing: border-box; }
      html { background: Canvas; color: CanvasText; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        background: Canvas;
        color: CanvasText;
      }
      .skip-link {
        position: absolute;
        left: -9999px;
        top: 0;
        z-index: 10000;
        padding: 8px 16px;
        margin: 0;
        font: inherit;
        font-size: 14px;
        text-decoration: none;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: Canvas;
        color: CanvasText;
      }
      .skip-link:focus {
        left: 12px;
        top: 8px;
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .skip-link:focus:not(:focus-visible) {
        left: -9999px;
        top: 0;
        outline: none;
      }
      .skip-link:focus-visible {
        left: 12px;
        top: 8px;
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
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
        min-height: var(--cr-control-h);
        padding: 0 12px;
        font: inherit;
        font-size: var(--cr-ui-fs);
        line-height: 1.25;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: Canvas;
        color: CanvasText;
      }
      .chrome__search-row #search-clear {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--cr-control-h);
        padding: 0 12px;
        font: inherit;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        border-radius: var(--cr-control-radius);
        cursor: pointer;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
        white-space: nowrap;
      }
      .chrome__search-row #search-clear:hover {
        background: color-mix(in oklab, CanvasText 11%, Canvas);
      }
      .chrome__search-row input[type="search"]:focus-visible,
      .chrome__search-row #search-clear:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .chrome__search-label {
        flex: 0 0 auto;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: default;
        user-select: none;
      }
      /* Wide viewports: same legible caps word as historic Pages shell (icon hidden). */
      .chrome__search-label__glyph {
        display: none;
      }
      .nav-rail__search-label {
        font-size: var(--cr-label-caps-fs);
        font-weight: 700;
        letter-spacing: var(--cr-label-caps-track);
        text-transform: uppercase;
        opacity: 0.78;
      }
      .nav-rail__doc-hub {
        position: relative;
        flex: 0 0 auto;
        align-self: center;
        display: block;
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        border-radius: var(--cr-control-radius);
        background: Canvas;
        overflow: visible;
      }
      .nav-rail__doc-hub-summary {
        cursor: pointer;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
        padding: 0 12px;
        min-height: var(--cr-control-h);
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        box-sizing: border-box;
        list-style: none;
        user-select: none;
        line-height: 1.25;
      }
      .nav-rail__doc-hub-summary:hover {
        background: color-mix(in oklab, CanvasText 6%, Canvas);
      }
      .nav-rail__doc-hub-summary__caption {
        white-space: nowrap;
      }
      .nav-rail__doc-hub-summary__glyph {
        display: none;
      }
      .nav-rail__doc-hub-summary svg {
        display: block;
        flex: 0 0 auto;
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
        font-size: var(--cr-label-caps-fs);
        font-weight: 700;
        letter-spacing: var(--cr-label-caps-track);
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
        position: relative;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        padding: 8px 12px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 18%, Canvas);
        background: color-mix(in oklab, CanvasText 4%, Canvas);
        font-size: var(--cr-ui-fs);
        flex: 0 0 auto;
        min-width: 0;
      }
      .toolbar__primary {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        flex: 1 1 auto;
        min-width: 0;
      }
      .toolbar__primary-main {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        flex: 0 1 auto;
        min-width: 0;
      }
      .toolbar__primary-trail {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 10px 14px;
        margin-left: auto;
        min-width: 0;
      }
      .toolbar__end {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 10px 14px;
        min-width: 0;
      }
      .toolbar-github {
        display: inline-flex; align-items: center; justify-content: center;
        width: var(--cr-control-h);
        height: var(--cr-control-h);
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
      }
      .toolbar-github svg {
        width: var(--cr-icon-inner);
        height: var(--cr-icon-inner);
        display: block;
      }
      .toolbar-github:hover { background: color-mix(in oklab, CanvasText 11%, Canvas); }
      .toolbar-github:focus-visible { outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas); outline-offset: 2px; }
      .app__footer-attribution {
        margin: 0;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .app__footer-attribution a {
        color: inherit;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .app__footer-attribution__version { font-weight: 600; }
      .toolbar label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
      .toolbar label[hidden] { display: none !important; }
      .toolbar-wrap-lines {
        position: relative;
        margin: 0;
        min-height: var(--cr-control-h);
        padding: 0 12px 0 10px;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        background: Canvas;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
        cursor: pointer;
      }
      .toolbar-wrap-lines:hover {
        background: color-mix(in oklab, CanvasText 6%, Canvas);
      }
      .toolbar-wrap-lines__input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
        opacity: 0;
      }
      /** Visible tick box: the real input is visually hidden for a11y; unchecked looked like an empty box with no mark when on. */
      .toolbar-wrap-lines__box {
        flex: 0 0 auto;
        width: 16px;
        height: 16px;
        box-sizing: border-box;
        border: 1.5px solid color-mix(in oklab, CanvasText 38%, Canvas);
        border-radius: 3px;
        background: Canvas;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: CanvasText;
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) .toolbar-wrap-lines__box {
        border-color: color-mix(in oklab, CanvasText 52%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
      }
      .toolbar-wrap-lines__box::after {
        content: "";
        display: none;
        width: 4px;
        height: 9px;
        margin-top: -2px;
        border: solid currentColor;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) .toolbar-wrap-lines__box::after {
        display: block;
      }
      .toolbar-wrap-lines__face {
        display: none;
        align-items: center;
        justify-content: center;
        min-height: var(--cr-control-h);
        min-width: var(--cr-control-h);
        color: color-mix(in oklab, CanvasText 82%, Canvas);
      }
      .toolbar-wrap-lines__caption {
        white-space: nowrap;
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) {
        color: CanvasText;
        background: color-mix(in oklab, CanvasText 10%, Canvas);
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) .toolbar-wrap-lines__caption {
        color: CanvasText;
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) .toolbar-wrap-lines__face {
        color: CanvasText;
        background: color-mix(in oklab, CanvasText 10%, Canvas);
        border-radius: calc(var(--cr-control-radius) - 1px);
      }
      .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:focus-visible) {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .toolbar-icon-btn {
        display: none;
        align-items: center;
        justify-content: center;
        width: var(--cr-control-h);
        height: var(--cr-control-h);
        padding: 0;
        margin: 0;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
        cursor: pointer;
        flex: 0 0 auto;
      }
      .toolbar-icon-btn svg {
        display: block;
        flex: 0 0 auto;
      }
      .toolbar-icon-btn:hover {
        background: color-mix(in oklab, CanvasText 14%, Canvas);
        border-color: color-mix(in oklab, CanvasText 34%, Canvas);
      }
      .toolbar-icon-btn:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .toolbar-source-render-toggle {
        position: relative;
        margin: 0;
        min-height: var(--cr-control-h);
        padding: 0 12px 0 10px;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        background: Canvas;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
        cursor: pointer;
      }
      .toolbar-source-render-toggle:hover {
        background: color-mix(in oklab, CanvasText 6%, Canvas);
      }
      .toolbar-source-render-toggle__box {
        flex: 0 0 auto;
        width: 16px;
        height: 16px;
        box-sizing: border-box;
        border: 1.5px solid color-mix(in oklab, CanvasText 38%, Canvas);
        border-radius: 3px;
        background: Canvas;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: CanvasText;
      }
      .toolbar-source-render-toggle[aria-pressed="true"] .toolbar-source-render-toggle__box {
        border-color: color-mix(in oklab, CanvasText 52%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
      }
      .toolbar-source-render-toggle__box::after {
        content: "";
        display: none;
        width: 4px;
        height: 9px;
        margin-top: -2px;
        border: solid currentColor;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
      .toolbar-source-render-toggle[aria-pressed="true"] .toolbar-source-render-toggle__box::after {
        display: block;
      }
      .toolbar-source-render-toggle__face {
        display: none;
        align-items: center;
        justify-content: center;
        min-height: var(--cr-control-h);
        min-width: var(--cr-control-h);
        color: color-mix(in oklab, CanvasText 82%, Canvas);
      }
      .toolbar-source-render-toggle__caption {
        white-space: nowrap;
      }
      .toolbar-source-render-toggle[aria-pressed="true"] {
        color: CanvasText;
        background: color-mix(in oklab, CanvasText 10%, Canvas);
      }
      .toolbar-source-render-toggle:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .toolbar-icon-btn--source-markdown {
        display: inline-flex;
      }
${CODE_BROWSER_INTRO_STYLES}
      .toolbar label input:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .toolbar .toolbar-theme {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin: 0;
        padding: 0;
        min-width: 0;
        border: 0;
      }
      .toolbar-theme__trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--cr-control-h);
        height: var(--cr-control-h);
        padding: 0;
        margin: 0;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
        color: CanvasText;
        cursor: pointer;
      }
      .toolbar-theme__trigger:hover {
        background: color-mix(in oklab, CanvasText 14%, Canvas);
        border-color: color-mix(in oklab, CanvasText 34%, Canvas);
      }
      .toolbar-theme__trigger:active {
        background: color-mix(in oklab, CanvasText 18%, Canvas);
      }
      .toolbar-theme__trigger:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      .toolbar-theme__trigger svg {
        width: var(--cr-icon-inner);
        height: var(--cr-icon-inner);
        display: block;
        flex: 0 0 auto;
      }
      .toolbar-share-link-btn[data-copied="true"] {
        background: color-mix(in oklab, #2ea043 24%, Canvas);
        border-color: color-mix(in oklab, #2ea043 48%, CanvasText);
      }
      .toolbar-theme__trigger .toolbar-theme__icon {
        display: none;
        flex: 0 0 auto;
      }
      .toolbar-theme__trigger[data-commentray-trigger-mode="system"] .toolbar-theme__icon--system,
      .toolbar-theme__trigger[data-commentray-trigger-mode="light"] .toolbar-theme__icon--light,
      .toolbar-theme__trigger[data-commentray-trigger-mode="dark"] .toolbar-theme__icon--dark {
        display: block;
      }
      .toolbar-theme__menu {
        position: absolute;
        left: 0;
        top: calc(100% + 4px);
        z-index: 80;
        min-width: 148px;
        padding: 4px;
        margin: 0;
        list-style: none;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, CanvasText 16%, Canvas);
        background: Canvas;
        color: CanvasText;
        box-shadow: 0 8px 28px color-mix(in oklab, CanvasText 12%, transparent);
      }
      .toolbar-theme__menu[hidden] {
        display: none !important;
      }
      .toolbar-theme__menuitem {
        display: block;
        width: 100%;
        margin: 0;
        padding: 8px 10px;
        border: 0;
        border-radius: 6px;
        font: inherit;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        color: CanvasText;
        background: transparent;
      }
      .toolbar-theme__menuitem:hover {
        background: color-mix(in oklab, CanvasText 8%, Canvas);
      }
      .toolbar-theme__menuitem:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 0;
      }
      .toolbar-theme__menuitem[aria-checked="true"] {
        background: color-mix(in oklab, CanvasText 10%, Canvas);
        font-weight: 500;
      }
      .toolbar .file-path {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        display: inline-flex; align-items: baseline; gap: 0; margin-right: 4px;
        max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .toolbar .file-path__dir {
        color: color-mix(in oklab, CanvasText 55%, Canvas);
      }
      .toolbar .file-path__dir--root { letter-spacing: 0; }
      .toolbar .file-path__base {
        color: CanvasText;
        font-weight: 500;
      }
      .toolbar .file-path--title { font-weight: 500; }
      .toolbar-related {
        display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px;
        max-width: min(520px, 90vw);
        font-size: var(--cr-ui-fs);
        line-height: 1.35;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .toolbar-related__prefix { font-weight: 500; opacity: 0.88; white-space: nowrap; }
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
      .documented-files-tree .tree-file-link.tree-file-link--current {
        font-weight: 600;
        text-decoration-thickness: 2px;
        border-radius: 3px;
        padding: 1px 3px;
        margin: -1px -3px;
        background: color-mix(in oklab, CanvasText 10%, Canvas);
      }
      .toolbar button {
        font: inherit;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        min-height: var(--cr-control-h);
        padding: 0 12px;
        border-radius: var(--cr-control-radius);
        cursor: pointer;
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: color-mix(in oklab, CanvasText 6%, Canvas);
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
        :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) .search-results mark.search-hit {
          background: color-mix(in oklab, #c9a227 55%, Canvas);
        }
      }
      :root[data-commentray-theme="dark"] .search-results mark.search-hit {
        background: color-mix(in oklab, #c9a227 55%, Canvas);
      }
      .shell:not(.shell--stretch-rows) {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        min-width: 0;
        --split-pct: 46%;
      }
      .app__main .shell { flex: 1 1 auto; }
      .shell__panes {
        display: flex;
        flex-direction: row;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
      }
      .shell__pair-context {
        flex: 0 0 auto;
        display: flex;
        flex-direction: row;
        align-items: stretch;
        padding: 6px 0 8px;
        border-bottom: 1px solid color-mix(in oklab, CanvasText 15%, Canvas);
        background: color-mix(in oklab, CanvasText 3%, Canvas);
        font-size: var(--cr-ui-fs);
        line-height: 1.3;
      }
      .shell__pair-cell {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .shell__pair-cell--src {
        flex: 0 0 var(--split-pct);
        padding-left: var(--cr-pane-inline-pad);
      }
      .shell__pair-gutter-spacer {
        flex: 0 0 14px;
        min-width: 14px;
        align-self: stretch;
      }
      .shell__pair-cell--doc {
        flex: 1 1 auto;
        min-width: 0;
        padding-left: var(--cr-pane-inline-pad);
      }
      .shell__pair-lab {
        flex: 0 0 auto;
        font-size: var(--cr-label-caps-fs);
        font-weight: 700;
        letter-spacing: var(--cr-label-caps-track);
        text-transform: uppercase;
        opacity: 0.72;
      }
      .shell__pair-path {
        flex: 1 1 auto;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        font-size: var(--cr-ui-fs);
        color: CanvasText;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .shell__pair-path--secondary { opacity: 0.88; }
      .pane--code {
        flex: 0 0 var(--split-pct, 46%);
        min-width: 120px; overflow: auto; padding: 12px var(--cr-pane-inline-pad);
        border-right: 1px solid color-mix(in oklab, CanvasText 15%, Canvas);
        --code-line-font-size: 13px;
        --code-line-height: 1.5;
      }
      .source-pane {
        min-width: 0;
      }
      .source-pane--rendered-md {
        font-size: 15px;
        line-height: 1.45;
      }
      .source-pane--rendered-md img {
        max-width: 100%;
        height: auto;
      }
      .source-pane--rendered-md .commentray-mermaid {
        overflow-x: auto;
        max-width: 100%;
      }
      .source-pane--rendered-md .commentray-line-anchor--source {
        display: inline;
        vertical-align: baseline;
      }
      #shell[data-source-pane-mode="rendered-markdown"] .source-pane--code {
        display: none;
      }
      #shell[data-source-pane-mode="source"] .source-pane--rendered-md {
        display: none;
      }
      .pane--code .code-line-stack { --code-ln-min-ch: 3; }
      .pane--code .code-line {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        column-gap: 10px;
        align-items: start;
        min-width: 0;
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
        :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) .gutter {
          --commentray-ray-accent: #6eb0ff;
        }
      }
      :root[data-commentray-theme="dark"] .gutter {
        --commentray-ray-accent: #6eb0ff;
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
        display: flex; flex-direction: column; overflow: hidden; padding: 12px var(--cr-pane-inline-pad);
        background: Canvas;
        color: CanvasText;
      }
      /* #doc-pane-body.wrap beats pre code.hljs from the hljs theme so fenced blocks follow the toggle. */
      #doc-pane-body.wrap pre,
      #doc-pane-body.wrap pre code {
        white-space: pre-wrap;
        word-break: break-word;
      }
      #doc-pane-body:not(.wrap) pre,
      #doc-pane-body:not(.wrap) pre code {
        white-space: pre;
        word-break: normal;
      }
      .doc-pane-body {
        flex: 1 1 auto; min-height: 0; overflow: auto;
      }
      /* Inline backtick code chips (GitHub-like): prose context only, never fenced pre/code blocks. */
      .pane--doc .doc-pane-body :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
      .shell--stretch-rows .stretch-preamble :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
      .block-stretch td.stretch-doc .stretch-doc-inner :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 0.92em;
        padding: 0.12em 0.36em;
        border-radius: 6px;
        border: 1px solid color-mix(in oklab, CanvasText 12%, Canvas);
        background: color-mix(in oklab, CanvasText 8%, Canvas);
        color: inherit;
      }
      @media (prefers-color-scheme: dark) {
        :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) .pane--doc .doc-pane-body :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
        :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) .shell--stretch-rows .stretch-preamble :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
        :root:is(:not([data-commentray-theme]), [data-commentray-theme="system"]) .block-stretch td.stretch-doc .stretch-doc-inner :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code {
          border-color: color-mix(in oklab, CanvasText 26%, Canvas);
          background: color-mix(in oklab, CanvasText 16%, Canvas);
        }
      }
      :root[data-commentray-theme="dark"] .pane--doc .doc-pane-body :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
      :root[data-commentray-theme="dark"] .shell--stretch-rows .stretch-preamble :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code,
      :root[data-commentray-theme="dark"] .block-stretch td.stretch-doc .stretch-doc-inner :where(p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6) > code {
        border-color: color-mix(in oklab, CanvasText 26%, Canvas);
        background: color-mix(in oklab, CanvasText 16%, Canvas);
      }
      /**
       * GFM tables in rendered Markdown (doc pane, stretch preamble, per-block doc cells).
       * Intrinsic width so the pane scrolls sideways instead of squeezing columns; borders
       * and padding match familiar GitHub-style readability.
       */
      .pane--doc .doc-pane-body :where(table),
      .shell--stretch-rows .stretch-preamble :where(table),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(table) {
        width: max-content;
        max-width: none;
        border-collapse: collapse;
        margin: 0.85em 0;
        font-size: inherit;
        line-height: inherit;
      }
      .pane--doc .doc-pane-body :where(th, td),
      .shell--stretch-rows .stretch-preamble :where(th, td),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(th, td) {
        border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
        padding: 8px 12px;
        vertical-align: top;
      }
      .pane--doc .doc-pane-body :where(thead th),
      .shell--stretch-rows .stretch-preamble :where(thead th),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(thead th) {
        font-weight: 600;
        background: color-mix(in oklab, CanvasText 7%, Canvas);
      }
      .pane--doc .doc-pane-body tbody tr:nth-child(even) :where(td),
      .shell--stretch-rows .stretch-preamble tbody tr:nth-child(even) :where(td),
      .block-stretch td.stretch-doc .stretch-doc-inner tbody tr:nth-child(even) :where(td) {
        background: color-mix(in oklab, CanvasText 3.5%, Canvas);
      }
      .pane--doc .doc-pane-body :where(ul.contains-task-list),
      .shell--stretch-rows .stretch-preamble :where(ul.contains-task-list),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(ul.contains-task-list) {
        list-style: none;
        padding-inline-start: 1.2em;
      }
      .pane--doc .doc-pane-body :where(li.task-list-item),
      .shell--stretch-rows .stretch-preamble :where(li.task-list-item),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(li.task-list-item) {
        position: relative;
      }
      .pane--doc .doc-pane-body :where(li.task-list-item input[type="checkbox"]),
      .shell--stretch-rows .stretch-preamble :where(li.task-list-item input[type="checkbox"]),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(li.task-list-item input[type="checkbox"]) {
        position: absolute;
        margin-inline-start: -1.35em;
        margin-top: 0.2em;
      }
      .pane--doc .doc-pane-body :where(del),
      .shell--stretch-rows .stretch-preamble :where(del),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(del) {
        opacity: 0.82;
      }
      .pane--doc .doc-pane-body :where(section.footnotes),
      .shell--stretch-rows .stretch-preamble :where(section.footnotes),
      .block-stretch td.stretch-doc .stretch-doc-inner :where(section.footnotes) {
        margin-top: 1.5em;
        padding-top: 0.75em;
        border-top: 1px solid color-mix(in oklab, CanvasText 18%, Canvas);
        font-size: 0.92em;
      }
      .pane--doc .doc-pane-body .commentray-mermaid {
        overflow-x: auto;
        max-width: 100%;
      }
      /** Wrap on: break long URLs/words in prose; tables opt out so they stay wide + scroll with the body. */
      #doc-pane-body.wrap {
        overflow-wrap: break-word;
      }
      #doc-pane-body.wrap :where(table) {
        overflow-wrap: normal;
        word-break: normal;
      }
      #doc-pane-body:not(.wrap) {
        overflow-wrap: normal;
        word-break: normal;
      }
      #doc-pane-body .commentray-page-break {
        position: relative;
        min-height: var(--commentray-page-break-min-height, clamp(260px, 56vh, 620px));
        margin: 24px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      #doc-pane-body .commentray-page-break__rule {
        width: 100%;
        border-top: 1px dashed var(--border);
        opacity: 0.38;
      }
      #shell[data-page-breaks-enabled="false"] .commentray-page-break {
        display: none;
      }
      .toolbar-angle-picker {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }
      /* Angle caption uses the same class as the Search label (.nav-rail__search-label). */
      .toolbar-angle-picker__lab {
        display: inline-block;
        margin: 0;
        padding: 0;
        cursor: default;
        flex: 0 0 auto;
        white-space: nowrap;
        user-select: none;
      }
      .toolbar-angle-picker select {
        font: inherit;
        font-size: var(--cr-ui-fs);
        font-weight: 500;
        min-height: var(--cr-control-h);
        height: var(--cr-control-h);
        padding: 0 10px;
        border-radius: var(--cr-control-radius);
        border: 1px solid color-mix(in oklab, CanvasText 25%, Canvas);
        background: Canvas;
        color: color-mix(in oklab, CanvasText 88%, Canvas);
      }
      .toolbar-angle-picker select:focus-visible {
        outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
        outline-offset: 2px;
      }
      /* Single-pane + compact chrome below typical tablet / Bootstrap md threshold (768px). */
      @media (max-width: 767px) {
        html,
        body {
          overflow-x: auto;
          overflow-y: auto;
        }
        .app {
          height: auto;
          min-height: 100vh;
          min-height: 100dvh;
          min-width: 0;
          overflow-x: auto;
          overflow-y: visible;
        }
        .app__main {
          flex: 0 0 auto;
          width: 100%;
          min-height: 0;
        }
        .app__main > #shell:not(.shell--stretch-rows) {
          flex: none !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        .app__main > #shell:not(.shell--stretch-rows) .shell__panes {
          flex: none !important;
          min-height: auto !important;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .app__main > #shell:not(.shell--stretch-rows) .pane--code,
        .app__main > #shell:not(.shell--stretch-rows) .pane--doc {
          flex: none !important;
          min-height: auto !important;
          overflow: visible !important;
          max-height: none !important;
          /* flex:none + basis:auto otherwise sizes to max-content so line-wrap has no width cap */
          width: 100%;
          max-width: 100%;
          min-width: 0 !important;
          box-sizing: border-box;
        }
        .app__main > #shell:not(.shell--stretch-rows) .pane--doc {
          display: block;
        }
        .app__main > #shell:not(.shell--stretch-rows) .doc-pane-body {
          flex: none !important;
          min-height: auto !important;
          min-width: 0;
          overflow: visible !important;
        }
        .app__footer {
          margin-top: auto;
          flex-shrink: 0;
          padding: 5px 10px 8px;
          font-size: 10px;
          line-height: 1.35;
        }
        .app__main > #shell.shell--stretch-rows {
          flex: 1 1 auto;
          min-height: min(72vh, 720px);
          min-height: min(72dvh, 720px);
          overflow: auto;
        }
        .toolbar {
          padding: 5px 8px 5px;
          row-gap: 4px;
        }
        .toolbar__primary {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          gap: 6px;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }
        .toolbar__primary-main {
          flex: 1 1 auto;
          min-width: 0;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: visible;
          -webkit-overflow-scrolling: touch;
          gap: 6px;
          scrollbar-width: thin;
        }
        .toolbar__primary-trail {
          flex: 0 0 auto;
          flex-wrap: nowrap;
          align-self: center;
        }
        .toolbar-angle-picker {
          position: relative;
          flex: 0 1 auto;
          min-width: 0;
          max-width: 100%;
        }
        .toolbar-angle-picker__lab {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
          opacity: 0;
          pointer-events: none;
        }
        .toolbar-angle-picker select {
          max-width: min(200px, 52vw);
          min-width: 0;
          text-overflow: ellipsis;
        }
        .app__chrome {
          padding: 5px 8px 6px;
          gap: 5px;
          max-height: min(36vh, 360px);
        }
        /* Compact chrome: avoid heavy rings on inline fields (clear stays a real button). */
        .chrome__search-row input[type="search"]:focus-visible {
          outline: none;
          border-color: color-mix(in oklab, CanvasText 42%, Canvas);
        }
        .chrome__search-row #search-clear:focus-visible {
          outline: 2px solid color-mix(in oklab, CanvasText 45%, Canvas);
          outline-offset: 2px;
        }
        .chrome__search-label__caption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .chrome__search-label__glyph {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 2px;
          margin: 0;
          color: color-mix(in oklab, CanvasText 72%, Canvas);
        }
        .chrome__search-label__glyph:hover {
          color: color-mix(in oklab, CanvasText 88%, Canvas);
        }
        .chrome__search-label:focus-within {
          outline: none;
        }
        .chrome__search-label__glyph svg {
          display: block;
          flex: 0 0 auto;
        }
        .toolbar-angle-picker select:focus-visible {
          outline: none;
          border-color: color-mix(in oklab, CanvasText 42%, Canvas);
        }
        .toolbar-icon-btn--flip-only-narrow {
          display: inline-flex;
        }
        /**
         * Secondary flip: only on narrow viewports, only while the toolbar flip is off-screen
         * (see client IntersectionObserver). Same control as toolbar; fixed so it stays reachable.
         */
        .toolbar-icon-btn--flip-scroll-narrow {
          display: none;
        }
        #mobile-pane-flip-scroll.toolbar-icon-btn--flip-scroll-narrow.is-visible {
          display: inline-flex;
          position: fixed;
          top: calc(10px + env(safe-area-inset-top, 0px));
          right: calc(12px + env(safe-area-inset-right, 0px));
          z-index: 50;
          box-shadow:
            0 1px 2px color-mix(in oklab, CanvasText 12%, transparent),
            0 4px 14px color-mix(in oklab, CanvasText 18%, transparent);
        }
        .toolbar-icon-btn--source-markdown-scroll-narrow {
          display: none;
        }
        #source-markdown-pane-flip-scroll.toolbar-icon-btn--source-markdown-scroll-narrow.is-visible {
          display: inline-flex;
          position: fixed;
          top: calc(10px + env(safe-area-inset-top, 0px));
          left: calc(12px + env(safe-area-inset-left, 0px));
          z-index: 50;
          box-shadow:
            0 1px 2px color-mix(in oklab, CanvasText 12%, transparent),
            0 4px 14px color-mix(in oklab, CanvasText 18%, transparent);
        }
        /** Region connector lines are not needed on the narrow single-pane layout (gutter is hidden). */
        .shell:not(.shell--stretch-rows) .gutter .gutter__rays {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .nav-rail__doc-hub-summary {
          min-width: var(--cr-control-h);
          padding: 0 10px;
          justify-content: center;
          gap: 0;
        }
        .nav-rail__doc-hub-summary__caption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .nav-rail__doc-hub-summary__glyph {
          display: inline-flex;
        }
        .toolbar-wrap-lines {
          min-width: var(--cr-control-h);
          padding: 0;
          justify-content: center;
          gap: 0;
          font-weight: 500;
        }
        .toolbar-wrap-lines__caption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .toolbar-wrap-lines__box {
          display: none;
        }
        .toolbar-wrap-lines__face {
          display: inline-flex;
          position: relative;
          width: 100%;
          height: 100%;
          min-height: var(--cr-control-h);
          min-width: var(--cr-control-h);
        }
        .toolbar-wrap-lines:has(.toolbar-wrap-lines__input:checked) .toolbar-wrap-lines__face::after {
          content: "✓";
          position: absolute;
          right: 1px;
          bottom: 0;
          font-size: 11px;
          line-height: 1;
          font-weight: 800;
          color: CanvasText;
          text-shadow: 0 0 2px Canvas, 0 0 3px Canvas;
        }
        .toolbar-source-render-toggle {
          min-width: var(--cr-control-h);
          width: var(--cr-control-h);
          height: var(--cr-control-h);
          padding: 0;
          justify-content: center;
          gap: 0;
        }
        .toolbar-source-render-toggle__caption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .toolbar-source-render-toggle__box {
          display: none;
        }
        .toolbar-source-render-toggle__face {
          display: inline-flex;
          position: relative;
          width: 100%;
          height: 100%;
          min-height: var(--cr-control-h);
          min-width: var(--cr-control-h);
        }
        .toolbar-source-render-toggle[aria-pressed="true"] .toolbar-source-render-toggle__face::after {
          content: "✓";
          position: absolute;
          right: 1px;
          bottom: 0;
          font-size: 11px;
          line-height: 1;
          font-weight: 800;
          color: CanvasText;
          text-shadow: 0 0 2px Canvas, 0 0 3px Canvas;
        }
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="code"] .pane--doc,
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="code"] .gutter {
          display: none !important;
        }
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="doc"] .pane--code,
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="doc"] .gutter {
          display: none !important;
        }
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="code"] .pane--code,
        .shell:not(.shell--stretch-rows)[data-dual-mobile-pane="doc"] .pane--doc {
          border-right: 0 !important;
        }
        .shell:not(.shell--stretch-rows) .shell__pair-context {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          padding: 4px 0 6px;
        }
        .shell:not(.shell--stretch-rows) .shell__pair-gutter-spacer {
          display: none;
        }
        .shell:not(.shell--stretch-rows) .shell__pair-cell--src {
          flex: 1 1 auto;
          padding-left: var(--cr-pane-inline-pad);
        }
        .shell:not(.shell--stretch-rows) .shell__pair-cell--doc {
          flex: 1 1 auto;
          padding-left: var(--cr-pane-inline-pad);
        }
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
        overflow-x: auto;
        max-width: 100%;
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
        min-width: 0;
        overflow-x: auto;
      }
      .block-stretch td.stretch-doc .stretch-doc-inner img { max-width: 100%; height: auto; }
      .block-stretch td.stretch-doc .stretch-doc-inner .commentray-mermaid {
        overflow-x: auto;
        max-width: 100%;
      }
      .block-stretch.wrap td.stretch-doc .stretch-doc-inner {
        overflow-wrap: break-word;
      }
      .block-stretch.wrap td.stretch-doc .stretch-doc-inner :where(table) {
        overflow-wrap: normal;
        word-break: normal;
      }
      .block-stretch:not(.wrap) td.stretch-doc .stretch-doc-inner {
        overflow-wrap: normal;
        word-break: normal;
      }
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
      .block-stretch.wrap .stretch-doc-inner pre,
      .block-stretch.wrap .stretch-doc-inner pre code {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .block-stretch:not(.wrap) .stretch-doc-inner pre,
      .block-stretch:not(.wrap) .stretch-doc-inner pre code {
        white-space: pre;
      }
`;

/** Native tooltip on #search-q (short hint is visible under the search row). */
const CODE_BROWSER_SEARCH_INPUT_TITLE =
  "Filename, path, or words. Matches this pair (source + commentray lines) first; merges commentray-nav-search.json when the export includes it (indexed paths + commentray lines).";

type CodeBrowserPageParts = {
  title: string;
  metaDescriptionHtml: string;
  generatorMetaHtml: string;
  /** Same-site hub control; first in `toolbar__primary-main` when present. */
  toolbarSiteHubHtml: string;
  /**
   * When non-empty, ` data-commentray-pair-source-path="…" data-commentray-pair-commentray-path="…"` on `#shell`
   * so the documented-files tree can mark the active pair (incl. multi-angle updates on the client).
   */
  shellPairIdentityDataAttrs: string;
  /** When non-empty, ` data-commentray-pair-browse-href="…"` on `#shell` (same-site browse or GitHub blob). */
  shellPairDocDataAttr: string;
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
  /** Markdown source pages can flip between rendered/source in the source pane. */
  sourceMarkdownToggleHtml: string;
  sourceMarkdownFlipScrollAffordanceHtml: string;
  sourcePaneModeAttr: string;
};

function buildCodeBrowserPageHtml(p: CodeBrowserPageParts): string {
  const shellClass = p.layout === "stretch" ? "shell shell--stretch-rows" : "shell";
  const dualFlipControlHtml =
    p.layout === "dual"
      ? `<button type="button" id="mobile-pane-flip" class="toolbar-icon-btn toolbar-icon-btn--flip-only-narrow" aria-label="Switch between source code and commentary" title="Switch between source code and commentary">${TOOLBAR_ICON_FLIP_PANES_SVG}</button>`
      : "";
  const dualFlipScrollAffordanceHtml =
    p.layout === "dual"
      ? `<button type="button" id="mobile-pane-flip-scroll" class="toolbar-icon-btn toolbar-icon-btn--flip-scroll-narrow" hidden aria-label="Switch between source code and commentary" title="Switch between source code and commentary">${TOOLBAR_ICON_FLIP_PANES_SVG}</button>`
      : "";
  return `<!doctype html>
<html lang="en" data-commentray-theme="system">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${COMMENTRAY_FAVICON_LINK_HTML}
    ${p.metaDescriptionHtml}${p.generatorMetaHtml}<title>${escapeHtml(p.title)}</title>
    <link rel="stylesheet" id="commentray-hljs-light" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      p.hljs,
    )}.min.css" media="(prefers-color-scheme: light)" />
    <link rel="stylesheet" id="commentray-hljs-dark" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/${escapeHtml(
      p.hljsDark,
    )}.min.css" media="(prefers-color-scheme: dark)" />
    <script>
${commentrayColorThemeHeadBoot()}
    </script>
    <style>
${CODE_BROWSER_STYLES}
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app">
      <header class="toolbar" role="banner" aria-label="View options">
        <h1 class="sr-only">${escapeHtml(p.title)}</h1>
        <div class="toolbar__primary">
          <div class="toolbar__primary-main">
          ${p.toolbarSiteHubHtml}
          ${p.navRailDocumentedHtml}
          ${p.angleSelectHtml}
          <label class="toolbar-wrap-lines" title="Wrap long lines in the source pane; in commentary, wrap long words and fenced code when on (wide tables and diagrams scroll horizontally).">
            <input type="checkbox" id="wrap-lines" class="toolbar-wrap-lines__input" />
            <span class="toolbar-wrap-lines__box" aria-hidden="true"></span>
            <span class="toolbar-wrap-lines__face" aria-hidden="true">${TOOLBAR_ICON_WRAP_SVG}</span>
            <span class="toolbar-wrap-lines__caption">Wrap lines</span>
          </label>
          ${dualFlipControlHtml}
          ${p.sourceMarkdownToggleHtml}
          ${p.toolbarDocHubHtml}
          ${p.relatedNavHtml}
          </div>
          <div class="toolbar__primary-trail">
        ${p.toolbarEndHtml}
${TOOLBAR_SHARE_LINK_HTML}
${TOOLBAR_HELP_TOUR_HTML}
${TOOLBAR_COLOR_THEME_HTML}
          </div>
        </div>
      </header>
      ${dualFlipScrollAffordanceHtml}
      ${p.sourceMarkdownFlipScrollAffordanceHtml}
      <header class="app__chrome" role="region" aria-label="Search">
        <div class="chrome__search-row">
          <label class="chrome__search-label" for="search-q" aria-label="Search" title="Search"><span class="chrome__search-label__caption nav-rail__search-label">Search</span><span class="chrome__search-label__glyph" aria-hidden="true">${CHROME_ICON_SEARCH_SVG}</span></label>
          <input type="search" id="search-q" placeholder="${escapeHtml(p.searchPlaceholder)}" title="${escapeHtml(CODE_BROWSER_SEARCH_INPUT_TITLE)}" autocomplete="off" spellcheck="false" />
          <button type="button" id="search-clear" aria-label="Clear search" title="Clear search">Clear</button>
        </div>
        <div class="search-results" id="search-results" hidden aria-live="polite"></div>
      </header>
      <main id="main-content" class="app__main" tabindex="-1">
        <div class="${shellClass}" id="shell" data-layout="${p.layout}"${p.layout === "dual" ? ' data-dual-mobile-pane="doc"' : ""}${p.sourcePaneModeAttr} data-raw-code-b64="${escapeHtml(p.rawCodeB64)}" data-raw-md-b64="${escapeHtml(p.rawMdB64)}" data-scroll-block-links-b64="${escapeHtml(p.scrollBlockLinksB64)}"${p.shellDocumentedPairsAttr}${p.shellSearchAttrs}${p.shellPairIdentityDataAttrs}${p.shellPairDocDataAttr}>
${p.shellInner}
        </div>
      </main>
      ${p.pageFooterHtml}
    </div>
    <script type="text/plain" id="commentray-multi-angle-b64">${p.multiAngleScriptBlock}</script>
    ${p.mermaidScript}
    <script>
${loadCodeBrowserClientBundle()}
    </script>
  </body>
</html>`;
}

type CodeBrowserShell = {
  layout: "dual" | "stretch";
  shellInner: string;
  scrollBlockLinksB64: string;
  angleSelectHtml: string;
  multiAnglePayloadB64: string;
  sourceMarkdownToggleEnabled: boolean;
  sourcePaneDefaultMode: "source" | "rendered-markdown";
  /** When multi-angle browsing is active, overrides shell `data-raw-md-b64` / search path / GitHub link. */
  multiShell?: {
    rawMdB64: string;
    scrollBlockLinksB64: string;
    commentrayPathForSearch: string;
    commentrayOnGithubUrl?: string;
    commentrayStaticBrowseUrl?: string;
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
  staticBrowseUrl?: string;
};

type MultiAngleDefaultSelection = {
  defaultMarkdown: string;
  defaultScrollB64: string;
  defaultPathSearch: string;
  defaultGh: string | undefined;
  defaultStaticBrowse: string;
  defaultPaneHtml: string;
};

function firstNonEmpty(values: string[]): string | undefined {
  return values.find((v) => v.trim().length > 0);
}

function resolveMultiAngleDefaultSelection(args: {
  multi: CodeBrowserMultiAngleBrowsing;
  defaultId: string;
  opts: CodeBrowserPageOptions;
  builtAngles: Array<{
    spec: CodeBrowserMultiAngleSpec;
    commentrayHtml: string;
    scrollB64: string;
  }>;
}): MultiAngleDefaultSelection {
  const { multi, defaultId, opts, builtAngles } = args;
  let defaultMarkdown = opts.commentrayMarkdown;
  let defaultScrollB64 = "";
  let defaultPathSearch = (opts.commentrayPathForSearch ?? "").trim();
  let defaultGh = opts.commentrayOnGithubUrl;
  let defaultStaticBrowse = (opts.commentrayStaticBrowseUrl ?? "").trim();
  let defaultPaneHtml = "";
  for (const b of builtAngles) {
    if (b.spec.id !== defaultId) continue;
    defaultMarkdown = b.spec.markdown;
    defaultScrollB64 = b.scrollB64;
    defaultPathSearch = b.spec.commentrayPathRel.trim();
    defaultGh = b.spec.commentrayOnGithubUrl;
    defaultStaticBrowse = (b.spec.staticBrowseUrl ?? "").trim();
    defaultPaneHtml = b.commentrayHtml;
    break;
  }
  if (defaultStaticBrowse.length === 0) {
    defaultStaticBrowse =
      firstNonEmpty(multi.angles.map((a) => (a.staticBrowseUrl ?? "").trim())) ?? "";
  }
  if ((defaultGh ?? "").trim().length === 0) {
    defaultGh = firstNonEmpty(multi.angles.map((a) => (a.commentrayOnGithubUrl ?? "").trim()));
  }
  return {
    defaultMarkdown,
    defaultScrollB64,
    defaultPathSearch,
    defaultGh,
    defaultStaticBrowse,
    defaultPaneHtml,
  };
}

async function multiAngleJsonRowAndDocHtml(
  opts: CodeBrowserPageOptions,
  spec: CodeBrowserMultiAngleSpec,
): Promise<{ jsonRow: MultiAngleJsonRow; commentrayHtml: string; scrollB64: string }> {
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
  const mdForDoc = injectCommentrayDocAnchors(spec.markdown, links.length > 0 ? links : undefined);
  const scrollB64 =
    links.length > 0 ? Buffer.from(JSON.stringify(links), "utf8").toString("base64") : "";
  const commentrayHtml = await renderMarkdownToHtml(mdForDoc, {
    commentrayOutputUrls: opts.commentrayOutputUrls,
  });
  return {
    jsonRow: {
      id: spec.id,
      title: spec.title?.trim() || spec.id,
      docInnerHtmlB64: Buffer.from(commentrayHtml, "utf8").toString("base64"),
      rawMdB64: Buffer.from(spec.markdown, "utf8").toString("base64"),
      scrollBlockLinksB64: scrollB64,
      commentrayPathForSearch: spec.commentrayPathRel.trim(),
      commentrayOnGithubUrl: spec.commentrayOnGithubUrl,
      staticBrowseUrl: spec.staticBrowseUrl,
    },
    commentrayHtml,
    scrollB64,
  };
}

async function buildMultiAngleDualPaneShell(
  opts: CodeBrowserPageOptions,
  multi: CodeBrowserMultiAngleBrowsing,
): Promise<{
  shellInner: string;
  multiShell: NonNullable<CodeBrowserShell["multiShell"]>;
  angleSelectHtml: string;
  multiAnglePayloadB64: string;
  sourceMarkdownToggleEnabled: boolean;
  sourcePaneDefaultMode: "source" | "rendered-markdown";
}> {
  const defaultId = multi.angles.some((a) => a.id === multi.defaultAngleId)
    ? multi.defaultAngleId
    : (multi.angles[0]?.id ?? "main");
  const jsonAngles: MultiAngleJsonRow[] = [];
  const builtAngles: Array<{
    spec: CodeBrowserMultiAngleSpec;
    commentrayHtml: string;
    scrollB64: string;
  }> = [];

  const sourceMarkdownEnabled = isMarkdownLikeSource(opts);
  const sourceMdForPane = sourceMarkdownEnabled ? injectSourceMarkdownAnchors(opts.code) : "";
  const [codeHtml, sourceMarkdownPaneHtml] = await Promise.all([
    renderHighlightedCodeLineRows(opts.code, opts.language),
    sourceMarkdownEnabled
      ? renderMarkdownToHtml(sourceMdForPane, {
          commentrayOutputUrls: opts.commentrayOutputUrls,
        })
      : Promise.resolve(""),
  ]);

  for (const spec of multi.angles) {
    const { jsonRow, commentrayHtml, scrollB64 } = await multiAngleJsonRowAndDocHtml(opts, spec);
    builtAngles.push({ spec, commentrayHtml, scrollB64 });
    jsonAngles.push(jsonRow);
  }
  const {
    defaultMarkdown,
    defaultScrollB64,
    defaultPathSearch,
    defaultGh,
    defaultStaticBrowse,
    defaultPaneHtml,
  } = resolveMultiAngleDefaultSelection({ multi, defaultId, opts, builtAngles });

  const selOpts = multi.angles
    .map((a) => {
      const lab = escapeHtml(a.title?.trim() || a.id);
      return `<option value="${escapeHtml(a.id)}"${a.id === defaultId ? " selected" : ""}>${lab}</option>`;
    })
    .join("");
  const angleSelectHtml = `<span class="toolbar-angle-picker"><label class="toolbar-angle-picker__lab nav-rail__search-label" for="angle-select">Angle</label><select id="angle-select" aria-label="Commentray angle">${selOpts}</select></span>`;

  const pairHtml = renderShellPairContextHtml(opts.filePath, defaultPathSearch);
  const shellInner = wrapDualShellInner(
    pairHtml,
    dualPanePanesInnerHtml(codeHtml, defaultPaneHtml, sourceMarkdownPaneHtml),
  );

  const payloadObj = { defaultAngleId: defaultId, angles: jsonAngles };
  const multiAnglePayloadB64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64");

  return {
    shellInner,
    multiShell: {
      rawMdB64: Buffer.from(defaultMarkdown, "utf8").toString("base64"),
      scrollBlockLinksB64: defaultScrollB64,
      commentrayPathForSearch: defaultPathSearch,
      commentrayOnGithubUrl: defaultGh,
      ...(defaultStaticBrowse.length > 0 ? { commentrayStaticBrowseUrl: defaultStaticBrowse } : {}),
    },
    angleSelectHtml,
    multiAnglePayloadB64,
    sourceMarkdownToggleEnabled: sourceMarkdownEnabled,
    sourcePaneDefaultMode: sourceMarkdownEnabled ? "rendered-markdown" : "source",
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
      sourceMarkdownToggleEnabled: built.sourceMarkdownToggleEnabled,
      sourcePaneDefaultMode: built.sourcePaneDefaultMode,
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
    const sourceMarkdownEnabled = isMarkdownLikeSource(opts);
    const sourceMdForPane = sourceMarkdownEnabled ? injectSourceMarkdownAnchors(opts.code) : "";
    const [codeHtml, commentrayHtml, sourceMarkdownPaneHtml] = await Promise.all([
      renderHighlightedCodeLineRows(opts.code, opts.language),
      renderMarkdownToHtml(mdForDoc, {
        commentrayOutputUrls: opts.commentrayOutputUrls,
      }),
      sourceMarkdownEnabled
        ? renderMarkdownToHtml(sourceMdForPane, {
            commentrayOutputUrls: opts.commentrayOutputUrls,
          })
        : Promise.resolve(""),
    ]);
    const pairHtml = renderShellPairContextHtml(
      opts.filePath,
      (opts.commentrayPathForSearch ?? "").trim(),
    );
    shellInner = wrapDualShellInner(
      pairHtml,
      dualPanePanesInnerHtml(codeHtml, commentrayHtml, sourceMarkdownPaneHtml),
    );
    return {
      layout,
      shellInner,
      scrollBlockLinksB64,
      angleSelectHtml: "",
      multiAnglePayloadB64: "",
      sourceMarkdownToggleEnabled: sourceMarkdownEnabled,
      sourcePaneDefaultMode: sourceMarkdownEnabled ? "rendered-markdown" : "source",
    };
  }

  return {
    layout,
    shellInner,
    scrollBlockLinksB64,
    angleSelectHtml: "",
    multiAnglePayloadB64: "",
    sourceMarkdownToggleEnabled: false,
    sourcePaneDefaultMode: "source",
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

function currentPairCommentrayPathRel(
  shell: CodeBrowserShell,
  opts: CodeBrowserPageOptions,
): string {
  return (
    shell.multiShell?.commentrayPathForSearch ??
    opts.commentrayPathForSearch ??
    opts.blockStretchRows?.commentrayPathRel ??
    ""
  ).trim();
}

/**
 * Repo-relative source + companion Markdown paths for matching the current page to nav pairs
 * (see `code-browser-client.ts` documented-files tree).
 */
function shellPairIdentityDataAttrs(shell: CodeBrowserShell, opts: CodeBrowserPageOptions): string {
  const src = normPosixPath(opts.filePath ?? "");
  const cr = normPosixPath(currentPairCommentrayPathRel(shell, opts));
  if (src.length === 0 || cr.length === 0) return "";
  return ` data-commentray-pair-source-path="${escapeHtml(src)}" data-commentray-pair-commentray-path="${escapeHtml(cr)}"`;
}

/** Canonical doc target for static validation: same-site `./browse/…` when present, else GitHub blob. */
function shellPairDocDataAttr(shell: CodeBrowserShell, opts: CodeBrowserPageOptions): string {
  if (shell.layout !== "dual") return "";
  const browseRaw = (
    shell.multiShell?.commentrayStaticBrowseUrl ??
    opts.commentrayStaticBrowseUrl ??
    ""
  ).trim();
  if (browseRaw.length > 0) {
    const href = safeToolbarNavigationHref(browseRaw);
    if (href !== null) {
      return ` data-commentray-pair-browse-href="${escapeHtml(href)}"`;
    }
  }
  const gh = safeExternalHttpUrl(toolbarCommentrayGithubFromShell(shell, opts));
  if (gh !== null) {
    return ` data-commentray-pair-browse-href="${escapeHtml(gh)}"`;
  }
  return "";
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
  const metaDescriptionHtml = renderMetaDescriptionHtml(opts, title);
  const builtAt = opts.builtAt ?? new Date();
  const renderSemver = commentrayRenderVersion();
  const toolbarSiteHubHtml = buildToolbarSiteHubHtml(opts.siteHubUrl);
  const toolbarEndHtml = buildToolbarEndHtml(opts.githubRepoUrl, opts.siteHubUrl);
  const pageFooterHtml = renderPageFooterHtml({
    builtAt,
    toolHomeUrl: opts.toolHomeUrl,
    commentrayRenderSemver: renderSemver,
  });
  const { hljsLight, hljsDark } = hljsStylesheetThemes(opts.hljsTheme);

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
  const pairDocDataAttr = shellPairDocDataAttr(shell, opts);
  const pairIdentityDataAttrs = shellPairIdentityDataAttrs(shell, opts);
  const sourceMarkdownToggles = sourceMarkdownToggleControlsHtml(shell.sourceMarkdownToggleEnabled);
  const sourcePaneModeAttr = ` data-source-pane-mode="${shell.sourcePaneDefaultMode}"`;

  return buildCodeBrowserPageHtml({
    title,
    metaDescriptionHtml,
    generatorMetaHtml,
    toolbarSiteHubHtml,
    shellPairIdentityDataAttrs: pairIdentityDataAttrs,
    shellPairDocDataAttr: pairDocDataAttr,
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
    hljs: hljsLight,
    hljsDark,
    mermaidScript,
    searchPlaceholder,
    shellSearchAttrs,
    multiAngleScriptBlock: shell.multiAnglePayloadB64,
    sourceMarkdownToggleHtml: sourceMarkdownToggles.sourceMarkdownToggleHtml,
    sourceMarkdownFlipScrollAffordanceHtml:
      sourceMarkdownToggles.sourceMarkdownFlipScrollAffordanceHtml,
    sourcePaneModeAttr,
  });
}
