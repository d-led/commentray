import {
  FuzzySearcher,
  PrefixSearcher,
  Query,
  SearcherFactory,
  SubstringSearcher,
} from "@m31coding/fuzzy-search";
import {
  activeBlockIdForCommentrayLine0,
  activeBlockIdForViewport,
  clampViewportYToGutterLocal,
  codeLineDomIndex0,
  dedupeBlockScrollLinksById,
  gutterRayBezierPaths,
  maxRenderableCommentaryContentBottomViewport,
  nextBlockLinkInCommentrayOrder,
  sortBlockLinksBySource,
} from "./code-browser-block-rays.js";
import {
  type BlockScrollLink,
  mirroredScrollTop,
  pickBlockScrollLinkForCommentrayScroll,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./code-browser-scroll-sync.js";
import { maxCommentrayAnchorLine0AtOrAboveViewportY } from "./commentray-anchor-viewport-probe.js";
import { decodeBase64Utf8 } from "./code-browser-encoding.js";
import { readEmbeddedRawB64Strings } from "./code-browser-embedded-payload.js";
import {
  escapeHtmlHighlightingSearchTokens,
  filterPairsByDocumentedTreeQuery,
  findOrderedTokenSpans,
  lineAtIndex,
  offsetToLineIndex,
  pathRowsFromDocumentedPairs,
  tokenizeQuery,
  uniqueSourceFilePreviewRows,
  type SourceFilePreviewRow,
} from "./code-browser-search.js";
import {
  findDocumentedPair,
  isHubRelativeStaticBrowseHref,
  isSameDocumentedPair,
  normPosixPath,
  resolveStaticBrowseHref,
  staticBrowseHrefForShellDataAttribute,
} from "./code-browser-pair-nav.js";
import {
  COMMENTRAY_COLOR_THEME_STORAGE_KEY,
  applyCommentrayColorTheme,
  nextCommentrayColorThemeMode,
  parseCommentrayColorThemeMode,
  type CommentrayColorThemeMode,
} from "./code-browser-color-theme.js";
import { wireWideModeIntroTour } from "./code-browser-wide-intro-controller.js";
import { readWebStorageItem, writeWebStorageItem } from "./code-browser-web-storage.js";

/**
 * Hub pages emit `./browse/…` relative to the site root. From `/…/browse/current.html` the browser
 * would otherwise resolve that to `…/browse/browse/…`.
 */
function rewriteHubRelativeBrowseAnchorsIn(root: ParentNode): void {
  const path = globalThis.location.pathname;
  const origin = globalThis.location.origin;
  for (const el of Array.from(root.querySelectorAll("a[href]"))) {
    if (!(el instanceof HTMLAnchorElement)) continue;
    const raw = el.getAttribute("href")?.trim() ?? "";
    if (!isHubRelativeStaticBrowseHref(raw)) continue;
    el.href = resolveStaticBrowseHref(raw, path, origin);
  }
}

/** Set by the Mermaid module script in {@link ./mermaid-runtime-html.ts} (same origin, not `file:`). */
type CommentrayMermaidGlobal = {
  run: (opts: { nodes?: HTMLElement[]; querySelector?: string }) => Promise<unknown>;
};

function runMermaidOnFreshDocNodes(docBody: HTMLElement): void {
  if (typeof globalThis.location !== "undefined" && globalThis.location.protocol === "file:")
    return;
  /** Only fenced diagram sources; Mermaid leaves other `.mermaid` nodes in the tree after render. */
  const allPres = Array.from(docBody.querySelectorAll("pre.mermaid")) as HTMLElement[];
  /** Do not re-run on wrappers that already have SVG (avoids corrupting output after dual-mobile pane flip). */
  const nodes = allPres.filter((pre) => {
    const wrap = pre.closest(".commentray-mermaid");
    return wrap === null || wrap.querySelector("svg") === null;
  });
  if (nodes.length === 0) return;
  const m = (globalThis as unknown as { commentrayMermaid?: CommentrayMermaidGlobal })
    .commentrayMermaid;
  if (!m) return;
  void m.run({ nodes }).catch((err: unknown) => {
    console.error("Commentray: mermaid.run failed", err);
  });
}

type HitKind = "code" | "md" | "path";

/** Optional `crPath` / `spPath` tie a hit to a companion file (hub search); omit for the open pair only. */
type Row = { kind: HitKind; line: number; text: string; crPath?: string; spPath?: string };

type Hit = {
  kind: HitKind;
  line: number;
  text: string;
  score: number;
  source: "ordered" | "fuzzy";
  crPath?: string;
  spPath?: string;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Y offset in `scrollEl`’s scroll coordinate space to place `child`’s top at the scrollport (CSS px). */
function scrollTopToAlignChildTop(
  scrollEl: HTMLElement,
  child: Element,
  leadCssPx: number,
): number {
  const cr = child.getBoundingClientRect();
  const sr = scrollEl.getBoundingClientRect();
  return scrollEl.scrollTop + (cr.top - sr.top) - scrollEl.clientTop - leadCssPx;
}

/** Avoid feedback loops when sub-pixel math matches the current position (common with browser zoom). */
function applyScrollTopClamped(scrollEl: HTMLElement, nextTop: number): void {
  const maxY = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  const clamped = clamp(nextTop, 0, maxY);
  if (Math.abs(scrollEl.scrollTop - clamped) < 0.25) return;
  scrollEl.scrollTop = clamped;
}

function paneUsesInternalYScroll(el: HTMLElement): boolean {
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === "auto" || oy === "scroll" || oy === "overlay";
}

/** Sub-pixel noise threshold for “which direction did the user scroll?”. */
const SCROLL_SYNC_MONOTONIC_EPS = 1.5;

function rootScrollingElement(): HTMLElement {
  const s = document.scrollingElement;
  if (s instanceof HTMLElement) return s;
  return document.documentElement;
}

function readPaneVerticalScroll(pane: HTMLElement): number {
  return paneUsesInternalYScroll(pane) ? pane.scrollTop : rootScrollingElement().scrollTop;
}

/** Monotonic revert must not use {@link applyScrollTopClamped}’s sub-pixel skip, or the partner never moves back. */
function writePaneVerticalScrollForced(partnerPane: HTMLElement, target: number): void {
  if (paneUsesInternalYScroll(partnerPane)) {
    const maxY = Math.max(0, partnerPane.scrollHeight - partnerPane.clientHeight);
    partnerPane.scrollTop = clamp(target, 0, maxY);
    return;
  }
  const root = rootScrollingElement();
  const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
  root.scrollTop = clamp(target, 0, maxY);
}

/**
 * If the driver pane moved down/up, the partner must not move the opposite way (static Pages UX:
 * no backward “snap” while scrolling one column).
 */
function enforceScrollSyncMonotonic(args: {
  driverDelta: number;
  partnerBefore: number;
  partnerPane: HTMLElement;
}): void {
  const { driverDelta, partnerBefore, partnerPane } = args;
  if (Math.abs(driverDelta) < SCROLL_SYNC_MONOTONIC_EPS) return;
  const partnerAfter = readPaneVerticalScroll(partnerPane);
  if (
    driverDelta > SCROLL_SYNC_MONOTONIC_EPS &&
    partnerAfter < partnerBefore - SCROLL_SYNC_MONOTONIC_EPS
  ) {
    writePaneVerticalScrollForced(partnerPane, partnerBefore);
    return;
  }
  if (
    driverDelta < -SCROLL_SYNC_MONOTONIC_EPS &&
    partnerAfter > partnerBefore + SCROLL_SYNC_MONOTONIC_EPS
  ) {
    writePaneVerticalScrollForced(partnerPane, partnerBefore);
  }
}

function applyWindowScrollRatio(ratio: number): void {
  const root = rootScrollingElement();
  const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
  const next = clamp(ratio * maxY, 0, maxY);
  if (Math.abs(root.scrollTop - next) < 0.25) return;
  root.scrollTop = next;
}

/**
 * Reveal `child` near the top of the reading surface: the pane’s own scrollport when it scrolls
 * internally (desktop dual-pane), otherwise the document root (narrow flow layout).
 */
function applyRevealChildInPane(scrollport: HTMLElement, child: Element, leadCssPx: number): void {
  if (paneUsesInternalYScroll(scrollport)) {
    applyScrollTopClamped(
      scrollport,
      Math.round(scrollTopToAlignChildTop(scrollport, child, leadCssPx)),
    );
    return;
  }
  const root = rootScrollingElement();
  const cr = child.getBoundingClientRect();
  const targetTop = globalThis.scrollY + cr.top - leadCssPx;
  const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
  const clamped = clamp(targetTop, 0, maxY);
  if (Math.abs(root.scrollTop - clamped) < 0.25) return;
  root.scrollTop = clamped;
}

/** Captured commentary→source scroll state for a narrow single-pane flip (see {@link DualPaneScrollSyncRunners}). */
type DocToCodeFlipPlan =
  | { k: "noop" }
  | { k: "block"; src0: number; winRatio: number }
  | { k: "mirrorI"; docTop: number; docSH: number; docCH: number }
  | { k: "mirrorW"; ratio: number };

/** Captured source→commentary scroll state for a narrow single-pane flip. */
type CodeToDocFlipPlan =
  | { k: "noop" }
  | { k: "block"; mdLine0: number; winRatio: number }
  | { k: "mirrorI"; codeTop: number; codeSH: number; codeCH: number }
  | { k: "mirrorW"; ratio: number };

function windowScrollRatio(): number {
  const root = rootScrollingElement();
  const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
  return maxY > 0 ? clamp(root.scrollTop / maxY, 0, 1) : 0;
}

const SCROLL_SYNC_DEBUG_FLAG = "commentrayDebugScroll";

function scrollSyncDebugQueryOn(): boolean {
  const v = new URLSearchParams(globalThis.location.search).get(SCROLL_SYNC_DEBUG_FLAG);
  return v === "1" || v === "true" || v === "";
}

function scrollSyncDebugStorageOn(s: Storage): boolean {
  try {
    const v = s.getItem(SCROLL_SYNC_DEBUG_FLAG);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function scrollSyncDebugHashOn(): boolean {
  const h = globalThis.location.hash;
  return h === `#${SCROLL_SYNC_DEBUG_FLAG}` || h === `#${SCROLL_SYNC_DEBUG_FLAG}=1`;
}

/**
 * Opt-in scroll-sync tracing: `console.info` lines prefixed with `[commentray:scroll-sync]`.
 * **Static hosting** — reads the URL and Web Storage in the browser only (no HTTP server logic,
 * headers, or preview tooling required for this flag to work on published Pages or any static file host).
 *
 * Turn on any one of:
 * - Query: `?commentrayDebugScroll=1` (or `=true`, or present with an empty value)
 * - Hash: `#commentrayDebugScroll` or `#commentrayDebugScroll=1` (fragment is not sent to the server)
 * - DevTools, then reload: `sessionStorage.setItem("commentrayDebugScroll", "1")` or the same for `localStorage`
 */
function scrollSyncDebugEnabled(): boolean {
  try {
    if (scrollSyncDebugQueryOn()) return true;
    if (scrollSyncDebugHashOn()) return true;
    if (scrollSyncDebugStorageOn(globalThis.sessionStorage)) return true;
    if (scrollSyncDebugStorageOn(globalThis.localStorage)) return true;
    return false;
  } catch {
    return false;
  }
}

function formatDocToCodePlanForLog(p: DocToCodeFlipPlan): string {
  if (p.k === "noop") return "noop";
  if (p.k === "block") return `block(src0=${String(p.src0)})`;
  if (p.k === "mirrorW") return `mirrorW(ratio=${p.ratio.toFixed(4)})`;
  return `mirrorI(docTop=${String(p.docTop)})`;
}

function formatCodeToDocPlanForLog(p: CodeToDocFlipPlan): string {
  if (p.k === "noop") return "noop";
  if (p.k === "block") return `block(mdLine0=${String(p.mdLine0)})`;
  if (p.k === "mirrorW") return `mirrorW(ratio=${p.ratio.toFixed(4)})`;
  return `mirrorI(codeTop=${String(p.codeTop)})`;
}

function applyDocToCodeFlipPlanImpl(
  codePane: HTMLElement,
  _docPane: HTMLElement,
  plan: DocToCodeFlipPlan,
  lineIdPrefix = "code-line-",
): void {
  if (plan.k === "noop") return;
  const narrowSinglePane = globalThis.matchMedia(DUAL_MOBILE_SINGLE_PANE_MQ).matches;
  if (plan.k === "block") {
    const exact = codePane.querySelector(`#${lineIdPrefix}${String(plan.src0)}`);
    const el =
      exact instanceof HTMLElement
        ? exact
        : findAnchorAtOrAfter(sourceAnchorsFromPrefix(lineIdPrefix), plan.src0);
    if (el) {
      applyRevealChildInPane(codePane, el, 2);
    }
    return;
  }
  if (plan.k === "mirrorW") {
    if (paneUsesInternalYScroll(codePane)) {
      const maxC = Math.max(0, codePane.scrollHeight - codePane.clientHeight);
      applyScrollTopClamped(codePane, plan.ratio * maxC);
      if (narrowSinglePane) applyWindowScrollRatio(plan.ratio);
    } else {
      applyWindowScrollRatio(plan.ratio);
    }
    return;
  }
  const nextTop = mirroredScrollTop(
    plan.docTop,
    plan.docSH,
    plan.docCH,
    codePane.scrollHeight,
    codePane.clientHeight,
  );
  if (paneUsesInternalYScroll(codePane)) {
    applyScrollTopClamped(codePane, nextTop);
    if (narrowSinglePane) {
      const denom = Math.max(1, codePane.scrollHeight - codePane.clientHeight);
      applyWindowScrollRatio(clamp(nextTop / denom, 0, 1));
    }
    return;
  }
  const denom = Math.max(1, codePane.scrollHeight - codePane.clientHeight);
  applyWindowScrollRatio(clamp(nextTop / denom, 0, 1));
}

function applyCodeToDocFlipPlanImpl(
  _codePane: HTMLElement,
  docPane: HTMLElement,
  plan: CodeToDocFlipPlan,
): void {
  if (plan.k === "noop") return;
  if (plan.k === "block") {
    const anchor = docPane.querySelector(`[data-commentray-line="${String(plan.mdLine0)}"]`);
    if (anchor instanceof HTMLElement) {
      applyRevealChildInPane(docPane, anchor, 2);
    }
    return;
  }
  if (plan.k === "mirrorW") {
    if (paneUsesInternalYScroll(docPane)) {
      const maxD = Math.max(0, docPane.scrollHeight - docPane.clientHeight);
      applyScrollTopClamped(docPane, plan.ratio * maxD);
    } else {
      applyWindowScrollRatio(plan.ratio);
    }
    return;
  }
  const nextTop = mirroredScrollTop(
    plan.codeTop,
    plan.codeSH,
    plan.codeCH,
    docPane.scrollHeight,
    docPane.clientHeight,
  );
  if (paneUsesInternalYScroll(docPane)) {
    applyScrollTopClamped(docPane, nextTop);
    return;
  }
  const denom = Math.max(1, docPane.scrollHeight - docPane.clientHeight);
  applyWindowScrollRatio(clamp(nextTop / denom, 0, 1));
}

function buildDocToCodeFlipPlanBlockAware(
  docPane: HTMLElement,
  getLinks: () => BlockScrollLink[],
): DocToCodeFlipPlan {
  const winRatio = paneUsesInternalYScroll(docPane)
    ? clamp(docPane.scrollTop / Math.max(1, docPane.scrollHeight - docPane.clientHeight), 0, 1)
    : windowScrollRatio();
  const pulledSrc0 = pulledSourceLine0FromPageBreak(docPane);
  if (pulledSrc0 !== null) return { k: "block", src0: pulledSrc0, winRatio };
  const links = getLinks();
  const mdLine0 = probeCommentrayLine0FromDoc(docPane);
  if (mdLine0 !== null) {
    const src0 = pickSourceLine0ForCommentrayScroll(links, mdLine0);
    if (src0 !== null) return { k: "block", src0, winRatio };
  }
  /** Index-backed pair but no confident block anchor for this viewport — do not nudge the source. */
  if (links.length > 0) return { k: "noop" };
  if (paneUsesInternalYScroll(docPane)) {
    return {
      k: "mirrorI",
      docTop: docPane.scrollTop,
      docSH: docPane.scrollHeight,
      docCH: docPane.clientHeight,
    };
  }
  return { k: "mirrorW", ratio: winRatio };
}

function buildCodeToDocFlipPlanBlockAware(
  codePane: HTMLElement,
  docPane: HTMLElement,
  getLinks: () => BlockScrollLink[],
  lineIdPrefix = "code-line-",
): CodeToDocFlipPlan {
  const winRatio = windowScrollRatio();
  const links = getLinks();
  const line1 = probeCodeLine1FromViewport(codePane, lineIdPrefix);
  const mdLine0 = pickCommentrayLineForSourceScroll(links, line1);
  if (mdLine0 === null) {
    if (links.length > 0) return { k: "noop" };
    if (paneUsesInternalYScroll(codePane)) {
      return {
        k: "mirrorI",
        codeTop: codePane.scrollTop,
        codeSH: codePane.scrollHeight,
        codeCH: codePane.clientHeight,
      };
    }
    return { k: "mirrorW", ratio: winRatio };
  }
  const docProbe = probeCommentrayLine0FromDoc(docPane);
  if (docProbe !== null && docProbe === mdLine0) {
    return { k: "noop" };
  }
  return { k: "block", mdLine0, winRatio };
}

function buildDocToCodeFlipPlanProportional(docPane: HTMLElement): DocToCodeFlipPlan {
  if (paneUsesInternalYScroll(docPane)) {
    return {
      k: "mirrorI",
      docTop: docPane.scrollTop,
      docSH: docPane.scrollHeight,
      docCH: docPane.clientHeight,
    };
  }
  return { k: "mirrorW", ratio: windowScrollRatio() };
}

function buildCodeToDocFlipPlanProportional(codePane: HTMLElement): CodeToDocFlipPlan {
  if (paneUsesInternalYScroll(codePane)) {
    return {
      k: "mirrorI",
      codeTop: codePane.scrollTop,
      codeSH: codePane.scrollHeight,
      codeCH: codePane.clientHeight,
    };
  }
  return { k: "mirrorW", ratio: windowScrollRatio() };
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function snippet(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function mergeHits(rows: Hit[], max: number): Hit[] {
  const byKey = new Map<string, Hit>();
  for (const r of rows) {
    const key =
      r.kind === "path"
        ? `path:${r.spPath ?? ""}|${r.crPath ?? ""}|${r.text.slice(0, 120)}`
        : `${r.kind}:${r.line}:${r.crPath ?? ""}`;
    const prev = byKey.get(key);
    if (!prev || r.score > prev.score) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

function buildOrderedHits(raw: string, kind: HitKind, tokens: string[]): Hit[] {
  const spans = findOrderedTokenSpans(raw, tokens);
  const seen = new Set<number>();
  const out: Hit[] = [];
  for (const sp of spans) {
    const line = offsetToLineIndex(raw, sp.start);
    if (seen.has(line)) continue;
    seen.add(line);
    out.push({
      kind,
      line,
      text: lineAtIndex(raw, line),
      score: 1000,
      source: "ordered",
    });
  }
  return out;
}

function buildFuzzyHits(
  searcher: ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>>,
  query: string,
  topN: number,
): Hit[] {
  const qstr = query.trim();
  if (!qstr) return [];
  const q = new Query(qstr, topN, [
    new FuzzySearcher(0.22),
    new SubstringSearcher(0),
    new PrefixSearcher(0),
  ]);
  const res = searcher.getMatches(q);
  const out: Hit[] = [];
  for (const m of res.matches) {
    const row = m.entity;
    out.push({
      kind: row.kind,
      line: row.line,
      text: row.text,
      score: 100 + m.quality,
      source: "fuzzy",
      crPath: row.crPath,
      spPath: row.spPath,
    });
  }
  return out;
}

/** Ordered token matches per path row (keeps `spPath` / `crPath` for navigation). */
function buildOrderedPathHitsFromRows(pathRows: Row[], tokens: string[]): Hit[] {
  if (tokens.length === 0) return [];
  const out: Hit[] = [];
  for (const row of pathRows) {
    if (row.kind !== "path") continue;
    const spans = findOrderedTokenSpans(row.text, tokens);
    if (spans.length === 0) continue;
    out.push({
      kind: "path",
      line: row.line,
      text: row.text,
      score: 1000,
      source: "ordered",
      spPath: row.spPath,
      crPath: row.crPath,
    });
  }
  return out;
}

type SearchScope = "full" | "commentray-and-paths";

type MergedSearchHitInput = {
  scope: SearchScope;
  filePathLabel: string;
  commentrayPathLabel: string;
  rawCode: string;
  rawMd: string;
  searcher: ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>>;
  queryRaw: string;
  tokens: string[];
  /** When set (hub), ordered path-token search spans every indexed path string, not only the open pair. */
  pathBlobWide?: string;
  /** Structured path rows for ordered filename / path-segment search (preferred over `pathBlobWide`). */
  pathRowsForOrdering?: Row[];
};

function computeMergedSearchHits(input: MergedSearchHitInput): Hit[] {
  const {
    scope,
    filePathLabel,
    commentrayPathLabel,
    rawCode,
    rawMd,
    searcher,
    queryRaw,
    tokens,
    pathBlobWide,
    pathRowsForOrdering,
  } = input;
  const pathBlob =
    (pathBlobWide && pathBlobWide.trim().length > 0
      ? pathBlobWide.trim()
      : [filePathLabel, commentrayPathLabel].filter((s) => s.trim().length > 0).join("\n")) || "";
  const orderedCode =
    scope === "commentray-and-paths" ? [] : buildOrderedHits(rawCode, "code", tokens);
  const orderedPath =
    scope === "commentray-and-paths" && pathRowsForOrdering && pathRowsForOrdering.length > 0
      ? buildOrderedPathHitsFromRows(pathRowsForOrdering, tokens)
      : scope === "commentray-and-paths" && pathBlob
        ? buildOrderedHits(pathBlob, "path", tokens)
        : [];
  const orderedMd = buildOrderedHits(rawMd, "md", tokens);
  const fuzzyHits = buildFuzzyHits(searcher, queryRaw, 60);
  return mergeHits([...orderedCode, ...orderedPath, ...orderedMd, ...fuzzyHits], 80);
}

type SearchHitRenderContext = {
  currentCommentrayPath: string;
  currentSourcePath: string;
};

function searchScopeResultsHintIntro(scope: SearchScope): string {
  return scope === "commentray-and-paths"
    ? "Paths + indexed commentray (this page + browse pages when built). Ordered tokens + fuzzy lines."
    : "Whole source: whitespace tokens in order (may span lines). Per-line fuzzy ranking for typos.";
}

function searchHitMetaLabel(h: Hit, ctx: SearchHitRenderContext): string {
  if (h.kind === "code") return `Code L${h.line + 1}`;
  if (h.kind === "path") return `Path`;
  const foreign = h.crPath && h.crPath !== ctx.currentCommentrayPath ? ` · ${h.crPath}` : "";
  return `Commentray L${h.line + 1}${foreign}`;
}

function searchHitButtonHtml(h: Hit, tokens: string[], ctx: SearchHitRenderContext): string {
  const label = searchHitMetaLabel(h, ctx);
  const tag = h.source === "ordered" ? "ordered" : "fuzzy";
  const snippetHtml = escapeHtmlHighlightingSearchTokens(snippet(h.text, 320), tokens);
  const crAttr = escapeHtmlText(
    h.kind === "md" ? (h.crPath ?? ctx.currentCommentrayPath) : (h.crPath ?? ""),
  );
  const spAttr = escapeHtmlText(
    h.kind === "md" ? (h.spPath ?? ctx.currentSourcePath) : (h.spPath ?? ""),
  );
  return (
    `<button type="button" class="hit" data-kind="${h.kind}" data-line="${String(h.line)}" data-cr-path="${crAttr}" data-sp-path="${spAttr}">` +
    `<span class="meta">${escapeHtmlText(label)} <span class="src-tag">(${tag})</span></span>` +
    `<div class="snippet">${snippetHtml}</div></button>`
  );
}

function searchResultsInnerHtml(
  scope: SearchScope,
  combined: Hit[],
  tokens: string[],
  ctx: SearchHitRenderContext,
): string {
  if (combined.length === 0) {
    return '<div class="hint">No matches. Try fewer tokens or looser spelling (fuzzy matches per line).</div>';
  }
  const hintIntro = searchScopeResultsHintIntro(scope);
  const buf: string[] = [];
  buf.push(`<div class="hint">${hintIntro} ${combined.length} hit(s).</div>`);
  for (const h of combined) {
    buf.push(searchHitButtonHtml(h, tokens, ctx));
  }
  return buf.join("");
}

function emptyBrowsePreviewHint(
  scope: SearchScope,
  rowCount: number,
  totalUnique: number,
  usedIndexFallback: boolean,
): string {
  if (scope === "full") {
    return "Documented source for this page. Type to search.";
  }
  if (usedIndexFallback) {
    return "Documented source on this page. Type to search the index when it is available.";
  }
  if (totalUnique > rowCount) {
    return `Indexed source files (${String(rowCount)} of ${String(totalUnique)} shown). Type to search.`;
  }
  return `Indexed source files (${String(totalUnique)}). Type to search.`;
}

function emptySearchBrowsePreviewInnerHtml(
  hint: string,
  rows: SourceFilePreviewRow[],
  ctx: SearchHitRenderContext,
): string {
  const tokens: string[] = [];
  const buf: string[] = [`<div class="hint">${escapeHtmlText(hint)}</div>`];
  const hits: Hit[] = rows.map((r, i) => ({
    kind: "path",
    line: i,
    text: r.sourcePath,
    score: 1000,
    source: "ordered",
    spPath: r.sourcePath,
    crPath: r.commentrayPath,
  }));
  for (const h of hits) {
    buf.push(searchHitButtonHtml(h, tokens, ctx));
  }
  return buf.join("");
}

function scrollDocToMarkdownLine0(
  docScrollEl: HTMLElement,
  line0: number,
  mdLineCount: number,
): void {
  const el = docScrollEl.querySelector(`#commentray-md-line-${String(line0)}`);
  if (el instanceof HTMLElement) {
    const top = Math.round(scrollTopToAlignChildTop(docScrollEl, el, 8));
    const maxY = Math.round(Math.max(0, docScrollEl.scrollHeight - docScrollEl.clientHeight));
    docScrollEl.scrollTo({ top: clamp(top, 0, maxY), behavior: "smooth" });
    return;
  }
  if (mdLineCount <= 1) return;
  const ratio = line0 / Math.max(1, mdLineCount - 1);
  const maxScroll = Math.max(0, docScrollEl.scrollHeight - docScrollEl.clientHeight);
  docScrollEl.scrollTo({ top: ratio * maxScroll, behavior: "smooth" });
}

function navigateToDocumentedPair(pair: DocumentedPairNav, mdLine0: number | null): void {
  if (pair.staticBrowseUrl?.trim()) {
    const href = resolveStaticBrowseHref(
      pair.staticBrowseUrl.trim(),
      globalThis.location.pathname,
      globalThis.location.origin,
    );
    const u = new URL(href);
    if (mdLine0 !== null && mdLine0 >= 0) u.hash = `commentray-md-line-${String(mdLine0)}`;
    globalThis.location.assign(u.toString());
    return;
  }
  const gh = (pair.commentrayOnGithub ?? "").trim();
  if (gh.length > 0) {
    const url = mdLine0 !== null && mdLine0 >= 0 ? `${gh}#L${String(mdLine0 + 1)}` : gh;
    globalThis.location.assign(url);
  }
}

function readSearchScopeFromShell(shell: HTMLElement): {
  scope: SearchScope;
  filePathLabel: string;
  commentrayPathLabel: string;
} {
  const scopeAttr = shell.getAttribute("data-search-scope") || "";
  return {
    scope: scopeAttr === "commentray-and-paths" ? "commentray-and-paths" : "full",
    filePathLabel: shell.getAttribute("data-search-file-path") || "",
    commentrayPathLabel: shell.getAttribute("data-search-commentray-path") || "",
  };
}

function buildIndexedSearchRows(
  scope: SearchScope,
  rawCode: string,
  rawMd: string,
  filePathLabel: string,
  commentrayPathLabel: string,
): Row[] {
  const mdLines = rawMd.split("\n");
  const codeLines = rawCode.split("\n");
  const pathRows: Row[] = [];
  if (scope === "commentray-and-paths") {
    if (filePathLabel.trim()) {
      pathRows.push({ kind: "path", line: pathRows.length, text: filePathLabel });
    }
    if (commentrayPathLabel.trim()) {
      pathRows.push({ kind: "path", line: pathRows.length, text: commentrayPathLabel });
    }
  }
  return [
    ...(scope === "full"
      ? codeLines.map((text, line) => ({ kind: "code" as const, line, text }))
      : []),
    ...pathRows,
    ...mdLines.map((text, line) => ({ kind: "md" as const, line, text })),
  ];
}

function indexSearchLineRows(
  rows: Row[],
): ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>> {
  const searcher = SearcherFactory.createDefaultSearcher<Row, string>();
  searcher.indexEntities(
    rows,
    (e) => {
      if (e.kind === "md" && e.crPath) return `md:${e.crPath}:${e.line}`;
      if (e.kind === "path")
        return `path:${e.spPath ?? ""}|${e.crPath ?? ""}|${e.line}|${e.text.slice(0, 120)}`;
      return `${e.kind}:${e.line}`;
    },
    (e) => [e.text],
  );
  return searcher;
}

type MutableSearchFields = {
  rawMd: string;
  mdLines: string[];
  commentrayPathLabel: string;
  searcher: ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>>;
  pathBlobWide: string;
  pathRowsForOrdering: Row[];
  documentedPairs: DocumentedPairNav[];
};

type SearchUiContext = {
  scope: SearchScope;
  filePathLabel: string;
  mutable: MutableSearchFields;
  rawCode: string;
  searchInput: HTMLInputElement;
  searchClear: HTMLElement;
  searchResults: HTMLElement;
  docScrollEl: HTMLElement;
};

type SearchHitClickDeps = {
  mutable: MutableSearchFields;
  docScrollEl: HTMLElement;
  filePathLabel: string;
};

function findSearchHitButton(
  leaf: HTMLElement | null,
  searchResults: HTMLElement,
): HTMLElement | null {
  let t: HTMLElement | null = leaf;
  while (t) {
    if (t.classList?.contains("hit")) return t;
    if (t === searchResults) return null;
    t = t.parentElement;
  }
  return null;
}

function listSearchHitButtons(searchResults: HTMLElement): HTMLButtonElement[] {
  return [...searchResults.querySelectorAll("button.hit")].filter(
    (el): el is HTMLButtonElement => el instanceof HTMLButtonElement,
  );
}

function listDocumentedTreeFileLinks(treeHost: HTMLElement): HTMLAnchorElement[] {
  return [...treeHost.querySelectorAll("a.tree-file-link")].filter(
    (el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement,
  );
}

function scrollCodeHitToView(line: number): void {
  const el = document.getElementById(`code-line-${String(line)}`);
  if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function handlePathSearchHit(button: HTMLElement, deps: SearchHitClickDeps): void {
  const hitCr = (button.getAttribute("data-cr-path") ?? "").trim();
  const hitSp = (button.getAttribute("data-sp-path") ?? "").trim();
  const pair = findDocumentedPair(deps.mutable.documentedPairs, hitCr, hitSp);
  if (pair && isSameDocumentedPair(pair, deps.filePathLabel, deps.mutable.commentrayPathLabel)) {
    deps.docScrollEl.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (pair) navigateToDocumentedPair(pair, null);
}

function handleMdSearchHit(line: number, crHit: string, deps: SearchHitClickDeps): void {
  const curCr = deps.mutable.commentrayPathLabel.trim();
  const cr = crHit.trim();
  if (cr.length > 0 && normPosixPath(cr) !== normPosixPath(curCr)) {
    const pair = findDocumentedPair(deps.mutable.documentedPairs, cr, "");
    if (pair) {
      navigateToDocumentedPair(pair, line);
      return;
    }
    return;
  }
  scrollDocToMarkdownLine0(deps.docScrollEl, line, deps.mutable.mdLines.length);
}

function handleSearchHitButtonClick(button: HTMLElement, deps: SearchHitClickDeps): void {
  const kind = button.getAttribute("data-kind");
  const line = parseInt(button.getAttribute("data-line") || "0", 10);
  const crHit = button.getAttribute("data-cr-path")?.trim() ?? "";
  if (kind === "code") {
    scrollCodeHitToView(line);
    return;
  }
  if (kind === "path") {
    handlePathSearchHit(button, deps);
    return;
  }
  handleMdSearchHit(line, crHit, deps);
}

/** Empty query + ArrowDown: browse preview HTML, or null when there is nothing to show. */
function emptyBrowsePreviewInnerHtml(
  scope: SearchScope,
  filePathLabel: string,
  mutable: MutableSearchFields,
): string | null {
  const hitCtx: SearchHitRenderContext = {
    currentCommentrayPath: mutable.commentrayPathLabel,
    currentSourcePath: filePathLabel,
  };
  if (scope === "full") {
    const sp = filePathLabel.trim();
    if (sp.length === 0) return null;
    const rows: SourceFilePreviewRow[] = [
      { sourcePath: sp, commentrayPath: mutable.commentrayPathLabel.trim() },
    ];
    const hint = emptyBrowsePreviewHint("full", rows.length, rows.length, false);
    return emptySearchBrowsePreviewInnerHtml(hint, rows, hitCtx);
  }
  const { rows, totalUnique } = uniqueSourceFilePreviewRows(mutable.documentedPairs);
  if (rows.length > 0) {
    const hint = emptyBrowsePreviewHint("commentray-and-paths", rows.length, totalUnique, false);
    return emptySearchBrowsePreviewInnerHtml(hint, rows, hitCtx);
  }
  const sp = filePathLabel.trim();
  if (sp.length === 0) return null;
  const fb: SourceFilePreviewRow[] = [
    { sourcePath: sp, commentrayPath: mutable.commentrayPathLabel.trim() },
  ];
  const hint = emptyBrowsePreviewHint("commentray-and-paths", fb.length, fb.length, true);
  return emptySearchBrowsePreviewInnerHtml(hint, fb, hitCtx);
}

function wireSearchResultsHitListKeyboard(
  searchResults: HTMLElement,
  searchInput: HTMLInputElement,
): void {
  searchResults.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.isComposing || searchResults.hidden) return;
    const hits = listSearchHitButtons(searchResults);
    if (hits.length === 0) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || !active.classList.contains("hit")) return;
    const idx = hits.indexOf(active);
    if (idx < 0) return;
    if (e.key === "ArrowDown" && idx < hits.length - 1) {
      hits[idx + 1].focus({ preventScroll: true });
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      if (idx > 0) {
        hits[idx - 1].focus({ preventScroll: true });
        e.preventDefault();
        return;
      }
      searchInput.focus({ preventScroll: true });
      e.preventDefault();
    }
  });
}

type SearchInputKeyboardActions = {
  renderEmptyBrowsePreview: () => void;
  runSearch: () => void;
  cancelDebounceTimer: () => void;
  hitClickDeps: SearchHitClickDeps;
};

function wireSearchInputKeyboard(
  searchInput: HTMLInputElement,
  searchResults: HTMLElement,
  actions: SearchInputKeyboardActions,
): void {
  const { renderEmptyBrowsePreview, runSearch, cancelDebounceTimer, hitClickDeps } = actions;
  searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (e.key === "ArrowDown") {
      if (!searchResults.hidden) {
        const hits = listSearchHitButtons(searchResults);
        if (hits.length > 0 && document.activeElement === searchInput) {
          hits[0].focus({ preventScroll: true });
          e.preventDefault();
          return;
        }
      }
      if (tokenizeQuery(searchInput.value).length > 0) return;
      renderEmptyBrowsePreview();
      e.preventDefault();
      return;
    }
    if (e.key !== "Enter") return;
    cancelDebounceTimer();
    if (tokenizeQuery(searchInput.value).length > 0) {
      runSearch();
    }
    const hits = listSearchHitButtons(searchResults);
    if (!searchResults.hidden && hits.length > 0 && document.activeElement === searchInput) {
      e.preventDefault();
      handleSearchHitButtonClick(hits[0], hitClickDeps);
    }
  });
}

function wireSearchUi(ctx: SearchUiContext): void {
  const {
    scope,
    filePathLabel,
    mutable,
    rawCode,
    searchInput,
    searchClear,
    searchResults,
    docScrollEl,
  } = ctx;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelDebounceTimer(): void {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  function clearSearch(): void {
    cancelDebounceTimer();
    searchInput.value = "";
    searchResults.innerHTML = "";
    searchResults.hidden = true;
  }

  function renderEmptyBrowsePreview(): void {
    const html = emptyBrowsePreviewInnerHtml(scope, filePathLabel, mutable);
    if (html === null) return;
    searchResults.hidden = false;
    searchResults.innerHTML = html;
  }

  function runSearch(): void {
    const tokens = tokenizeQuery(searchInput.value);
    if (tokens.length === 0) {
      searchResults.hidden = true;
      searchResults.innerHTML = "";
      return;
    }
    const combined = computeMergedSearchHits({
      scope,
      filePathLabel,
      commentrayPathLabel: mutable.commentrayPathLabel,
      rawCode,
      rawMd: mutable.rawMd,
      searcher: mutable.searcher,
      queryRaw: searchInput.value,
      tokens,
      pathBlobWide: mutable.pathBlobWide,
      pathRowsForOrdering:
        mutable.pathRowsForOrdering.length > 0 ? mutable.pathRowsForOrdering : undefined,
    });
    searchResults.hidden = false;
    searchResults.innerHTML = searchResultsInnerHtml(scope, combined, tokens, {
      currentCommentrayPath: mutable.commentrayPathLabel,
      currentSourcePath: filePathLabel,
    });
  }

  const hitClickDeps: SearchHitClickDeps = { mutable, docScrollEl, filePathLabel };
  searchResults.addEventListener("click", (ev: MouseEvent) => {
    const hit = findSearchHitButton(ev.target as HTMLElement | null, searchResults);
    if (!hit) return;
    handleSearchHitButtonClick(hit, hitClickDeps);
  });

  wireSearchResultsHitListKeyboard(searchResults, searchInput);

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
  });
  wireSearchInputKeyboard(searchInput, searchResults, {
    renderEmptyBrowsePreview,
    runSearch,
    cancelDebounceTimer,
    hitClickDeps,
  });
  searchClear.addEventListener("click", clearSearch);

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const query = searchInput.value.trim().length > 0;
    const searchFocused = document.activeElement === searchInput;
    const resultsOpen = !searchResults.hidden;
    if (!query && !searchFocused && !resultsOpen) return;
    clearSearch();
    if (searchFocused) searchInput.blur();
    e.preventDefault();
  });
}

/**
 * After toggling `pre-wrap`, line rows reflow without necessarily resizing the pane’s border box,
 * so gutter block rays and scroll sync must be nudged explicitly.
 *
 * Pass optional `docWrapRoots` (e.g. `#doc-pane` and `#doc-pane-body` in dual layout): the toggle
 * syncs `wrap` on those nodes so commentary fenced blocks and prose honor the control. `#doc-pane-body`
 * is targeted in CSS with an id so rules win over `pre code.hljs` from the highlight.js theme.
 */
function wireWrapToggle(
  storageWrap: string,
  codePane: HTMLElement,
  wrapCb: HTMLInputElement,
  onAfterLayout?: () => void,
  ...docWrapRoots: Array<HTMLElement | null | undefined>
): void {
  const docTargets = docWrapRoots.filter((el): el is HTMLElement => el instanceof HTMLElement);
  const wrap = readWebStorageItem(localStorage, storageWrap) === "1";
  wrapCb.checked = wrap;
  if (wrap) {
    codePane.classList.add("wrap");
    for (const el of docTargets) el.classList.add("wrap");
  } else {
    codePane.classList.remove("wrap");
    for (const el of docTargets) el.classList.remove("wrap");
  }

  wrapCb.addEventListener("change", () => {
    if (wrapCb.checked) {
      codePane.classList.add("wrap");
      for (const el of docTargets) el.classList.add("wrap");
      writeWebStorageItem(localStorage, storageWrap, "1");
    } else {
      codePane.classList.remove("wrap");
      for (const el of docTargets) el.classList.remove("wrap");
      writeWebStorageItem(localStorage, storageWrap, "0");
    }
    if (!onAfterLayout) return;
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        onAfterLayout();
        requestAnimationFrame(() => {
          onAfterLayout();
        });
      });
    });
  });
}

function parseScrollBlockLinksFromShell(b64: string): BlockScrollLink[] {
  const t = b64.trim();
  if (!t) return [];
  try {
    const raw = JSON.parse(decodeBase64Utf8(t)) as unknown;
    if (!Array.isArray(raw)) return [];
    const out: BlockScrollLink[] = [];
    for (const x of raw) {
      if (typeof x !== "object" || x === null) continue;
      const o = x as Record<string, unknown>;
      if (
        typeof o.id === "string" &&
        typeof o.commentrayLine === "number" &&
        typeof o.sourceStart === "number" &&
        typeof o.sourceEnd === "number"
      ) {
        const mvRaw = o.markerViewportHalfOpen1Based;
        const mv =
          typeof mvRaw === "object" &&
          mvRaw !== null &&
          typeof (mvRaw as { lo?: unknown }).lo === "number" &&
          typeof (mvRaw as { hiExclusive?: unknown }).hiExclusive === "number"
            ? {
                lo: (mvRaw as { lo: number }).lo,
                hiExclusive: (mvRaw as { hiExclusive: number }).hiExclusive,
              }
            : { lo: o.sourceStart, hiExclusive: o.sourceEnd + 1 };
        out.push({
          id: o.id,
          commentrayLine: o.commentrayLine,
          sourceStart: o.sourceStart,
          sourceEnd: o.sourceEnd,
          markerViewportHalfOpen1Based: mv,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function rootScrollNearDocumentEnd(edgePx = 56): boolean {
  const root = rootScrollingElement();
  const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
  return maxY > 0 && root.scrollTop >= maxY - edgePx;
}

/** When the pane itself is the scrollport (dual desktop), mirror root “near end” behavior. */
function paneScrollNearEnd(pane: HTMLElement, edgePx = 56): boolean {
  const maxY = Math.max(0, pane.scrollHeight - pane.clientHeight);
  return maxY > 0 && pane.scrollTop >= maxY - edgePx;
}

function readCommentrayLine0FromAnchor(el: HTMLElement): number | null {
  const lineAttr = el.getAttribute("data-commentray-line");
  if (lineAttr === null || lineAttr === "") return null;
  return Number(lineAttr);
}

function bestCommentrayAnchorLine0AtOrAboveY(
  anchors: NodeListOf<HTMLElement>,
  y: number,
): number | null {
  const readings: { line0: number; top: number }[] = [];
  for (const a of anchors) {
    const line0 = readCommentrayLine0FromAnchor(a);
    if (line0 === null) continue;
    readings.push({ line0, top: a.getBoundingClientRect().top });
  }
  return maxCommentrayAnchorLine0AtOrAboveViewportY(readings, y);
}

function lastCommentrayAnchorLine0(anchors: NodeListOf<HTMLElement>): number | null {
  for (let i = anchors.length - 1; i >= 0; i--) {
    const el = anchors.item(i);
    if (!el) continue;
    const v = readCommentrayLine0FromAnchor(el);
    if (v !== null) return v;
  }
  return null;
}

function probeCodeLine1FromViewport(codePane: HTMLElement, lineIdPrefix = "code-line-"): number {
  const rows = codePane.querySelectorAll<HTMLElement>(`[id^="${lineIdPrefix}"]`);
  if (rows.length === 0) return 1;

  if (!paneUsesInternalYScroll(codePane)) {
    if (rootScrollNearDocumentEnd()) {
      const last = rows[rows.length - 1];
      const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(last.id);
      if (m) return Number(m[1]) + 1;
      return rows.length;
    }
    const sr = codePane.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const clipT = Math.max(0, sr.top);
    const clipB = Math.min(vh, sr.bottom);
    const y = clipT + Math.max(2, Math.min(40, (clipB - clipT) * 0.15));
    for (const el of rows) {
      const r = el.getBoundingClientRect();
      if (r.bottom > y - 1e-3) {
        const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(el.id);
        if (m) return Number(m[1]) + 1;
        return 1;
      }
    }
    return rows.length;
  }

  if (paneScrollNearEnd(codePane)) {
    const last = rows[rows.length - 1];
    const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(last.id);
    if (m) return Number(m[1]) + 1;
    return rows.length;
  }

  const sr = codePane.getBoundingClientRect();
  const y = sr.top + codePane.clientTop + 2;
  for (const el of rows) {
    const r = el.getBoundingClientRect();
    if (r.bottom > y - 1e-3) {
      const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(el.id);
      if (m) return Number(m[1]) + 1;
      return 1;
    }
  }
  return rows.length;
}

function probeCommentrayLine0FromDoc(docPane: HTMLElement): number | null {
  const anchors = docPane.querySelectorAll<HTMLElement>(".commentray-block-anchor");
  if (anchors.length === 0) return null;

  if (!paneUsesInternalYScroll(docPane)) {
    if (rootScrollNearDocumentEnd()) {
      const tail = lastCommentrayAnchorLine0(anchors);
      if (tail !== null) return tail;
    }
    const dr = docPane.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const clipT = Math.max(0, dr.top);
    const clipB = Math.min(vh, dr.bottom);
    const y = clipT + Math.max(2, Math.min(40, (clipB - clipT) * 0.15));
    return bestCommentrayAnchorLine0AtOrAboveY(anchors, y);
  }

  if (paneScrollNearEnd(docPane)) {
    const tail = lastCommentrayAnchorLine0(anchors);
    if (tail !== null) return tail;
  }

  const dr = docPane.getBoundingClientRect();
  /** Same band as the root-scroll branch: a few px below the pane top so block anchors sit inside `top <= y` while their prose is what the reader sees first. */
  const y = dr.top + docPane.clientTop + Math.max(2, Math.min(40, docPane.clientHeight * 0.15));
  return bestCommentrayAnchorLine0AtOrAboveY(anchors, y);
}

function pageBreakPullEnabled(): boolean {
  const shell = document.getElementById("shell");
  if (!(shell instanceof HTMLElement)) return false;
  return shell.getAttribute("data-page-breaks-enabled") === "true";
}

function docProbeTopY(docPane: HTMLElement): number {
  if (!paneUsesInternalYScroll(docPane)) {
    const dr = docPane.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const clipT = Math.max(0, dr.top);
    const clipB = Math.min(vh, dr.bottom);
    return clipT + Math.max(2, Math.min(40, (clipB - clipT) * 0.15));
  }
  const dr = docPane.getBoundingClientRect();
  return dr.top + docPane.clientTop + 2;
}

/**
 * In long synthetic page-break gaps, shift source toward the next block once
 * the break itself occupies the top reading position.
 */
function pulledSourceLine0FromPageBreak(docPane: HTMLElement): number | null {
  if (!pageBreakPullEnabled()) return null;
  const topY = docProbeTopY(docPane);
  const breaks = Array.from(
    docPane.querySelectorAll<HTMLElement>(".commentray-page-break[data-next-source-start]"),
  );
  for (const pageBreak of breaks) {
    const nextSourceStartRaw = pageBreak.getAttribute("data-next-source-start");
    if (!nextSourceStartRaw) continue;
    const nextSourceStart = Number.parseInt(nextSourceStartRaw, 10);
    if (!Number.isFinite(nextSourceStart) || nextSourceStart <= 0) continue;

    const breakTop = pageBreak.getBoundingClientRect().top;
    const nextLineRaw = pageBreak.getAttribute("data-next-commentray-line");
    const nextLine0 = nextLineRaw ? Number.parseInt(nextLineRaw, 10) : Number.NaN;
    const nextAnchor =
      Number.isFinite(nextLine0) && nextLine0 >= 0
        ? docPane.querySelector<HTMLElement>(`[data-commentray-line="${String(nextLine0)}"]`)
        : null;
    const nextTop = nextAnchor
      ? nextAnchor.getBoundingClientRect().top
      : breakTop + pageBreak.clientHeight;
    if (!(breakTop <= topY && topY < nextTop)) continue;
    const denom = Math.max(1, nextTop - breakTop);
    const progress = clamp((topY - breakTop) / denom, 0, 1);
    const narrow = globalThis.matchMedia("(max-width: 767px)").matches;
    const pullThreshold = narrow ? 0.2 : 0.35;
    if (progress < pullThreshold) return null;
    return nextSourceStart - 1;
  }
  return null;
}

type SyncPane = "none" | "code" | "doc";

/**
 * Programmatic `scrollTop` on the partner pane can emit several `scroll` events, sometimes
 * after `syncing` is already cleared; the next handler would treat that as a user scroll and
 * apply the opposite block snap (doc↔code ping-pong). Arm a short budget on the partner before
 * each sync-driven update; release it after three rAFs so unused skips do not accumulate.
 */
const PARTNER_SCROLL_EVENT_SKIP_BUDGET = 6;

function armIgnoreNextPaneScrollReaction(armed: { n: number }): void {
  armed.n += PARTNER_SCROLL_EVENT_SKIP_BUDGET;
  const release = PARTNER_SCROLL_EVENT_SKIP_BUDGET;
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          armed.n = Math.max(0, armed.n - release);
        });
      });
    });
  });
}

function wireBidirectionalScroll(
  codePane: HTMLElement,
  docPane: HTMLElement,
  syncFromCode: (driverDelta: number) => void,
  syncFromDoc: (driverDelta: number) => void,
): void {
  let syncing: SyncPane = "none";
  const ignoreCodeScrollFromPartnerSync = { n: 0 };
  const ignoreDocScrollFromPartnerSync = { n: 0 };
  let lastSeenCodeTop = codePane.scrollTop;
  let lastSeenDocTop = docPane.scrollTop;

  codePane.addEventListener(
    "scroll",
    () => {
      const now = codePane.scrollTop;
      const delta = now - lastSeenCodeTop;
      lastSeenCodeTop = now;
      if (ignoreCodeScrollFromPartnerSync.n > 0) {
        ignoreCodeScrollFromPartnerSync.n--;
        return;
      }
      if (syncing === "doc") return;
      if (syncing === "code") return;
      syncing = "code";
      armIgnoreNextPaneScrollReaction(ignoreDocScrollFromPartnerSync);
      syncFromCode(delta);
      syncing = "none";
    },
    { passive: true },
  );

  docPane.addEventListener(
    "scroll",
    () => {
      const now = docPane.scrollTop;
      const delta = now - lastSeenDocTop;
      lastSeenDocTop = now;
      if (ignoreDocScrollFromPartnerSync.n > 0) {
        ignoreDocScrollFromPartnerSync.n--;
        return;
      }
      if (syncing === "code") return;
      if (syncing === "doc") return;
      syncing = "doc";
      armIgnoreNextPaneScrollReaction(ignoreCodeScrollFromPartnerSync);
      syncFromDoc(delta);
      syncing = "none";
    },
    { passive: true },
  );
}

/** One-shot runners used when the mobile single-pane flip reveals the partner pane. */
type DualPaneScrollSyncRunners = {
  /** Apply code scroll position to the commentary scroll element. */
  syncFromCodeToDoc: () => void;
  /** Apply commentary scroll position to the code pane. */
  syncFromDocToCode: () => void;
  /**
   * Narrow single-pane flip: the outgoing pane must still be visible for viewport probes; the
   * incoming pane must be visible for geometry-based alignment — so capture first, flip
   * `data-dual-mobile-pane`, then {@link finishMobileFlipToCode} on the next frame.
   */
  prepareMobileFlipToCode: () => void;
  finishMobileFlipToCode: () => void;
  prepareMobileFlipToDoc: () => void;
  finishMobileFlipToDoc: () => void;
};

/** Index-backed scroll sync when `data-scroll-block-links-b64` is present; else see proportional fallback. */
function wireBlockAwareScrollSync(
  codePane: HTMLElement,
  docPane: HTMLElement,
  getLinks: () => BlockScrollLink[],
  lineIdPrefix: () => string,
  shouldUseProportionalDocToCodeOnMobileFlip?: () => boolean,
): DualPaneScrollSyncRunners {
  let pendingDocToCode: DocToCodeFlipPlan | null = null;
  let pendingCodeToDoc: CodeToDocFlipPlan | null = null;

  const syncFromCodeToDocInner = (driverDelta: number): void => {
    const docBefore = readPaneVerticalScroll(docPane);
    const prefix = lineIdPrefix();
    const p = buildCodeToDocFlipPlanBlockAware(codePane, docPane, getLinks, prefix);
    if (scrollSyncDebugEnabled()) {
      const links = getLinks();
      const line1 = probeCodeLine1FromViewport(codePane, prefix);
      const docProbe = probeCommentrayLine0FromDoc(docPane);
      const pickedMd = pickCommentrayLineForSourceScroll(links, line1);
      globalThis.console.info("[commentray:scroll-sync] code→doc", {
        plan: formatCodeToDocPlanForLog(p),
        driverDelta,
        line1,
        docProbe,
        pickedMd,
        linkCount: links.length,
        codeScrollTop: codePane.scrollTop,
        docScrollTop: docPane.scrollTop,
      });
    }
    applyCodeToDocFlipPlanImpl(codePane, docPane, p);
    enforceScrollSyncMonotonic({ driverDelta, partnerBefore: docBefore, partnerPane: docPane });
  };
  const syncFromDocToCodeInner = (driverDelta: number): void => {
    const codeBefore = readPaneVerticalScroll(codePane);
    const prefix = lineIdPrefix();
    const p = buildDocToCodeFlipPlanBlockAware(docPane, getLinks);
    if (scrollSyncDebugEnabled()) {
      const links = getLinks();
      const mdLine0 = probeCommentrayLine0FromDoc(docPane);
      const line1 = probeCodeLine1FromViewport(codePane, prefix);
      const link = mdLine0 !== null ? pickBlockScrollLinkForCommentrayScroll(links, mdLine0) : null;
      globalThis.console.info("[commentray:scroll-sync] doc→code", {
        plan: formatDocToCodePlanForLog(p),
        driverDelta,
        mdLine0,
        line1,
        blockId: link?.id ?? null,
        markerSpan: link?.markerViewportHalfOpen1Based ?? null,
        linkCount: links.length,
        docScrollTop: docPane.scrollTop,
        codeScrollTop: codePane.scrollTop,
      });
    }
    applyDocToCodeFlipPlanImpl(codePane, docPane, p, prefix);
    enforceScrollSyncMonotonic({ driverDelta, partnerBefore: codeBefore, partnerPane: codePane });
  };
  const syncFromCodeToDoc = (): void => {
    syncFromCodeToDocInner(0);
  };
  const syncFromDocToCode = (): void => {
    syncFromDocToCodeInner(0);
  };
  const prepareMobileFlipToCode = (): void => {
    if (shouldUseProportionalDocToCodeOnMobileFlip?.() === true) {
      pendingDocToCode = { k: "mirrorW", ratio: windowScrollRatio() };
      return;
    }
    pendingDocToCode = buildDocToCodeFlipPlanBlockAware(docPane, getLinks);
  };
  const finishMobileFlipToCode = (): void => {
    if (!pendingDocToCode) return;
    let p = pendingDocToCode;
    pendingDocToCode = null;
    if (p.k === "noop") p = buildDocToCodeFlipPlanProportional(docPane);
    applyDocToCodeFlipPlanImpl(codePane, docPane, p, lineIdPrefix());
  };
  const prepareMobileFlipToDoc = (): void => {
    pendingCodeToDoc = buildCodeToDocFlipPlanBlockAware(
      codePane,
      docPane,
      getLinks,
      lineIdPrefix(),
    );
  };
  const finishMobileFlipToDoc = (): void => {
    if (!pendingCodeToDoc) return;
    let p = pendingCodeToDoc;
    pendingCodeToDoc = null;
    if (p.k === "noop") p = buildCodeToDocFlipPlanProportional(codePane);
    applyCodeToDocFlipPlanImpl(codePane, docPane, p);
  };
  wireBidirectionalScroll(codePane, docPane, syncFromCodeToDocInner, syncFromDocToCodeInner);
  return {
    syncFromCodeToDoc,
    syncFromDocToCode,
    prepareMobileFlipToCode,
    finishMobileFlipToCode,
    prepareMobileFlipToDoc,
    finishMobileFlipToDoc,
  };
}

/** Proportional scroll sync when there is no index-backed block map (GitHub Pages default). */
function wireProportionalScrollSync(
  codePane: HTMLElement,
  docPane: HTMLElement,
): DualPaneScrollSyncRunners {
  let pendingDocToCode: DocToCodeFlipPlan | null = null;
  let pendingCodeToDoc: CodeToDocFlipPlan | null = null;

  const syncFromCodeToDocInner = (driverDelta: number): void => {
    const docBefore = readPaneVerticalScroll(docPane);
    const p = buildCodeToDocFlipPlanProportional(codePane);
    if (scrollSyncDebugEnabled()) {
      globalThis.console.info("[commentray:scroll-sync] code→doc (proportional)", {
        plan: formatCodeToDocPlanForLog(p),
        driverDelta,
        codeScrollTop: codePane.scrollTop,
        docScrollTop: docPane.scrollTop,
      });
    }
    applyCodeToDocFlipPlanImpl(codePane, docPane, p);
    enforceScrollSyncMonotonic({ driverDelta, partnerBefore: docBefore, partnerPane: docPane });
  };
  const syncFromDocToCodeInner = (driverDelta: number): void => {
    const codeBefore = readPaneVerticalScroll(codePane);
    const p = buildDocToCodeFlipPlanProportional(docPane);
    if (scrollSyncDebugEnabled()) {
      globalThis.console.info("[commentray:scroll-sync] doc→code (proportional)", {
        plan: formatDocToCodePlanForLog(p),
        driverDelta,
        docScrollTop: docPane.scrollTop,
        codeScrollTop: codePane.scrollTop,
      });
    }
    applyDocToCodeFlipPlanImpl(codePane, docPane, p);
    enforceScrollSyncMonotonic({ driverDelta, partnerBefore: codeBefore, partnerPane: codePane });
  };
  const syncFromCodeToDoc = (): void => {
    syncFromCodeToDocInner(0);
  };
  const syncFromDocToCode = (): void => {
    syncFromDocToCodeInner(0);
  };
  const prepareMobileFlipToCode = (): void => {
    pendingDocToCode = buildDocToCodeFlipPlanProportional(docPane);
  };
  const finishMobileFlipToCode = (): void => {
    if (!pendingDocToCode) return;
    const p = pendingDocToCode;
    pendingDocToCode = null;
    applyDocToCodeFlipPlanImpl(codePane, docPane, p);
  };
  const prepareMobileFlipToDoc = (): void => {
    pendingCodeToDoc = buildCodeToDocFlipPlanProportional(codePane);
  };
  const finishMobileFlipToDoc = (): void => {
    if (!pendingCodeToDoc) return;
    const p = pendingCodeToDoc;
    pendingCodeToDoc = null;
    applyCodeToDocFlipPlanImpl(codePane, docPane, p);
  };
  wireBidirectionalScroll(codePane, docPane, syncFromCodeToDocInner, syncFromDocToCodeInner);
  return {
    syncFromCodeToDoc,
    syncFromDocToCode,
    prepareMobileFlipToCode,
    finishMobileFlipToCode,
    prepareMobileFlipToDoc,
    finishMobileFlipToDoc,
  };
}

function centerYInViewport(el: Element): number {
  const r = el.getBoundingClientRect();
  return (r.top + r.bottom) / 2;
}

/**
 * Vertical anchor for gutter rays on the source side. Must match the **numbered row** the reader
 * sees: the full `.code-line` row (line number + highlighted code) shares one grid row with
 * aligned line-heights. Measuring only `pre code` can shift Y (hljs spans, sub-pixel layout) so
 * rays sit above the line labels; the row’s geometric center tracks `lines:a-b` anchors reliably.
 */
function codeLineHighlightCenterYViewport(lineEl: HTMLElement): number {
  return centerYInViewport(lineEl);
}

function commentaryBandEndYViewport(
  docScrollEl: HTMLElement,
  next: BlockScrollLink | undefined,
  docTop: HTMLElement,
  clipThroughPageBreakGaps: boolean,
): number {
  if (next) {
    const nextEl = document.getElementById(`commentray-block-${next.id}`);
    if (!nextEl) return centerYInViewport(docTop);
    const nextTop = nextEl.getBoundingClientRect().top - 3;
    if (!clipThroughPageBreakGaps) return nextTop;
    const docBandTop = docTop.getBoundingClientRect().top + 4;
    const contentBottom = maxRenderableCommentaryContentBottomViewport(docScrollEl, docTop, nextEl);
    return Math.min(nextTop, Math.max(docBandTop, contentBottom));
  }
  const dr = docScrollEl.getBoundingClientRect();
  let bottom = dr.bottom - 4;
  const lastKid = docScrollEl.children[docScrollEl.children.length - 1];
  if (lastKid) bottom = Math.min(bottom, lastKid.getBoundingClientRect().bottom - 4);
  if (clipThroughPageBreakGaps) {
    const docBandTop = docTop.getBoundingClientRect().top + 4;
    const contentBottom = maxRenderableCommentaryContentBottomViewport(docScrollEl, docTop, null);
    bottom = Math.min(bottom, Math.max(docBandTop, contentBottom));
  }
  return bottom;
}

function sourceAnchorIndexFromId(id: string, prefix: string): number | null {
  if (!id.startsWith(prefix)) return null;
  const n = Number.parseInt(id.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : null;
}

function findAnchorAtOrAfter(
  anchors: ReadonlyArray<{ line0: number; el: HTMLElement }>,
  line0: number,
): HTMLElement | null {
  let lo = 0;
  let hi = anchors.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = anchors[mid]?.line0 ?? -1;
    if (line >= line0) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return ans >= 0 ? (anchors[ans]?.el ?? null) : null;
}

function findAnchorAtOrBefore(
  anchors: ReadonlyArray<{ line0: number; el: HTMLElement }>,
  line0: number,
): HTMLElement | null {
  let lo = 0;
  let hi = anchors.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = anchors[mid]?.line0 ?? -1;
    if (line <= line0) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? (anchors[ans]?.el ?? null) : null;
}

function sourceAnchorsFromPrefix(prefix: string): Array<{ line0: number; el: HTMLElement }> {
  return Array.from(document.querySelectorAll<HTMLElement>(`[id^="${prefix}"]`))
    .map((el) => ({ line0: sourceAnchorIndexFromId(el.id, prefix), el }))
    .filter((x): x is { line0: number; el: HTMLElement } => x.line0 !== null)
    .sort((a, b) => a.line0 - b.line0);
}

function subscribeBlockRayRedraw(
  gutter: HTMLElement,
  codePane: HTMLElement,
  docScrollEl: HTMLElement,
  scheduleDraw: () => void,
): void {
  const onScrollOrResize = (): void => scheduleDraw();
  codePane.addEventListener("scroll", onScrollOrResize, { passive: true });
  docScrollEl.addEventListener("scroll", onScrollOrResize, { passive: true });
  globalThis.addEventListener("resize", onScrollOrResize);
  const ro = new ResizeObserver(onScrollOrResize);
  ro.observe(gutter);
  ro.observe(codePane);
  ro.observe(docScrollEl);
  const shell = gutter.parentElement;
  if (shell) ro.observe(shell);
}

function drawBlockRaysIntoSvg(
  svg: SVGSVGElement,
  gutter: HTMLElement,
  docScrollEl: HTMLElement,
  getLinks: () => BlockScrollLink[],
  probeTopSourceLine1Based: () => number,
  lineIdPrefix: string,
): void {
  const links = dedupeBlockScrollLinksById(getLinks());
  const sorted = sortBlockLinksBySource(links);
  const gutterRect = gutter.getBoundingClientRect();
  const w = gutterRect.width;
  const h = gutterRect.height;
  if (w <= 0 || h <= 0 || sorted.length === 0) {
    svg.replaceChildren();
    return;
  }

  /** Doc-aligned active block matches visible commentary; code-only probe can lag in page gaps. */
  const mdLine0ForRay = probeCommentrayLine0FromDoc(docScrollEl);
  const activeId =
    docScrollEl.querySelector(".commentray-block-anchor") !== null && mdLine0ForRay !== null
      ? activeBlockIdForCommentrayLine0(links, mdLine0ForRay)
      : activeBlockIdForViewport(links, probeTopSourceLine1Based());
  const clipGutterRaysThroughPageBreakGaps = pageBreakPullEnabled();
  svg.setAttribute("viewBox", `0 0 ${String(w)} ${String(h)}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const parts: string[] = [];
  const sourceAnchors = Array.from(
    document.querySelectorAll<HTMLElement>(`[id^="${lineIdPrefix}"]`),
  )
    .map((el) => ({ line0: sourceAnchorIndexFromId(el.id, lineIdPrefix), el }))
    .filter((x): x is { line0: number; el: HTMLElement } => x.line0 !== null)
    .sort((a, b) => a.line0 - b.line0);

  for (let i = 0; i < sorted.length; i++) {
    const link = sorted[i];
    if (!link) continue;
    const next = nextBlockLinkInCommentrayOrder(links, link);

    const i0 = codeLineDomIndex0(link.sourceStart);
    const i1 = codeLineDomIndex0(link.sourceEnd);
    const codeTop =
      document.getElementById(`${lineIdPrefix}${String(i0)}`) ??
      findAnchorAtOrAfter(sourceAnchors, i0);
    const codeBot =
      document.getElementById(`${lineIdPrefix}${String(i1)}`) ??
      findAnchorAtOrBefore(sourceAnchors, i1);
    const docTop = document.getElementById(`commentray-block-${link.id}`);
    if (!codeTop || !codeBot || !docTop) continue;

    const docEndYViewport = commentaryBandEndYViewport(
      docScrollEl,
      next,
      docTop,
      clipGutterRaysThroughPageBreakGaps,
    );
    const yCodeTop = codeLineHighlightCenterYViewport(codeTop);
    const yCodeBot = codeLineHighlightCenterYViewport(codeBot);
    const yDocTop = docTop.getBoundingClientRect().top + 2;
    const yDocEnd = Math.max(docEndYViewport, yDocTop + 4);

    const c0 = clampViewportYToGutterLocal(yCodeTop, gutterRect.top, h);
    const c1 = clampViewportYToGutterLocal(yDocTop, gutterRect.top, h);
    const c2 = clampViewportYToGutterLocal(yCodeBot, gutterRect.top, h);
    const c3 = clampViewportYToGutterLocal(yDocEnd, gutterRect.top, h);

    const strokeClass =
      link.id === activeId ? "gutter__rays-path gutter__rays-path--active" : "gutter__rays-path";
    const trailClass = `${strokeClass} gutter__rays-path--trail`;

    const topPaths = gutterRayBezierPaths(0, c0.y, w, c1.y, {
      tension: 0.38,
      clipStart: c0.clipped,
      clipEnd: c1.clipped,
    });
    const botPaths = gutterRayBezierPaths(0, c2.y, w, c3.y, {
      tension: 0.38,
      clipStart: c2.clipped,
      clipEnd: c3.clipped,
    });

    const topExtra = topPaths.dotted ? `<path class="${trailClass}" d="${topPaths.dotted}" />` : "";
    const botExtra = botPaths.dotted ? `<path class="${trailClass}" d="${botPaths.dotted}" />` : "";

    parts.push(
      `<g class="gutter__rays-block" data-commentray-block="${escapeHtmlText(link.id)}">` +
        `<path class="${strokeClass}" d="${topPaths.solid}" />` +
        topExtra +
        `<path class="${strokeClass}" d="${botPaths.solid}" />` +
        botExtra +
        `</g>`,
    );
  }

  svg.innerHTML = parts.join("");
}

/**
 * Splines in the gutter between each block’s source range and its commentary band (dual pane,
 * index-backed blocks). Emphasizes the block aligned with the **doc** viewport when block anchors
 * exist; otherwise the source viewport. Clamps off-screen endpoints so readers see which way to scroll.
 *
 * @returns Request a redraw after DOM changes that do not resize the panes (e.g. multi-angle body swap).
 */
function wireBlockRayConnectors(args: {
  gutter: HTMLElement;
  codePane: HTMLElement;
  docScrollEl: HTMLElement;
  getLinks: () => BlockScrollLink[];
  probeTopSourceLine1Based: () => number;
  sourceLineIdPrefix?: () => string;
}): () => void {
  const { gutter, codePane, docScrollEl, getLinks, probeTopSourceLine1Based } = args;
  const sourceLineIdPrefix = args.sourceLineIdPrefix ?? (() => "code-line-");

  const svgNs = "http://www.w3.org/2000/svg";
  const host = document.createElement("div");
  host.className = "gutter__rays";
  host.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(svgNs, "svg");
  host.appendChild(svg);
  gutter.appendChild(host);

  let raf = 0;
  function scheduleDraw(): void {
    if (raf !== 0) return;
    raf = globalThis.requestAnimationFrame(() => {
      raf = 0;
      drawBlockRaysIntoSvg(
        svg,
        gutter,
        docScrollEl,
        getLinks,
        probeTopSourceLine1Based,
        sourceLineIdPrefix(),
      );
    });
  }

  subscribeBlockRayRedraw(gutter, codePane, docScrollEl, scheduleDraw);

  scheduleDraw();
  /** First paint can report gutter height 0 before flex layout settles; redraw after layout. */
  globalThis.requestAnimationFrame(() => {
    scheduleDraw();
    globalThis.requestAnimationFrame(scheduleDraw);
  });

  return scheduleDraw;
}

type DocumentedPairNav = {
  sourcePath: string;
  commentrayPath: string;
  sourceOnGithub?: string;
  commentrayOnGithub?: string;
  staticBrowseUrl?: string;
};

type NavJsonDoc = {
  documentedPairs?: unknown;
};

type TrieNode = {
  children: Map<string, TrieNode>;
  pairs: DocumentedPairNav[];
};

function isDocumentedPairNav(x: unknown): x is DocumentedPairNav {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.sourcePath !== "string" || typeof o.commentrayPath !== "string") return false;
  if (o.staticBrowseUrl !== undefined && typeof o.staticBrowseUrl !== "string") return false;
  const sg = o.sourceOnGithub;
  const cg = o.commentrayOnGithub;
  const hasSg = typeof sg === "string";
  const hasCg = typeof cg === "string";
  if (hasSg !== hasCg) return false;
  const browseOk = typeof o.staticBrowseUrl === "string" && o.staticBrowseUrl.trim().length > 0;
  if (!browseOk && !hasSg) return false;
  return true;
}

function pairsFromJsonArray(raw: unknown): DocumentedPairNav[] {
  const pairs: DocumentedPairNav[] = [];
  if (!Array.isArray(raw)) return pairs;
  for (const x of raw) {
    if (isDocumentedPairNav(x)) pairs.push(x);
  }
  return pairs;
}

function commentrayLineRowFromNavJson(r: Record<string, unknown>): Row | null {
  if (r.kind !== "commentrayLine") return null;
  if (typeof r.line !== "number" || typeof r.text !== "string") return null;
  const sp = typeof r.sourcePath === "string" ? r.sourcePath : "";
  const cr = typeof r.commentrayPath === "string" ? r.commentrayPath : "";
  return { kind: "md", line: r.line, text: r.text, spPath: sp, crPath: cr };
}

function pathRowFromNavJson(r: Record<string, unknown>, pathLine: number): Row | null {
  if (r.kind !== "sourcePath" && r.kind !== "commentrayPath") return null;
  const sp = typeof r.sourcePath === "string" ? r.sourcePath : "";
  const cr = typeof r.commentrayPath === "string" ? r.commentrayPath : "";
  const text = r.kind === "sourcePath" ? sp : cr;
  if (!text) return null;
  return { kind: "path", line: pathLine, text, spPath: sp, crPath: cr };
}

function rowsFromNavSearchJson(doc: unknown): Row[] {
  if (!doc || typeof doc !== "object") return [];
  const rowsRaw = (doc as { rows?: unknown }).rows;
  if (!Array.isArray(rowsRaw)) return [];
  const out: Row[] = [];
  let pathLine = 0;
  for (const raw of rowsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const mdRow = commentrayLineRowFromNavJson(r);
    if (mdRow) {
      out.push(mdRow);
      continue;
    }
    const pathRow = pathRowFromNavJson(r, pathLine);
    if (pathRow) {
      out.push(pathRow);
      pathLine += 1;
    }
  }
  return out;
}

/** Offline-first: UTF-8 base64 JSON array produced by the static Pages build. */
function parseDocumentedPairsFromEmbeddedB64(b64: string): DocumentedPairNav[] {
  const t = b64.trim();
  if (t === "") return [];
  try {
    const raw = JSON.parse(decodeBase64Utf8(t)) as unknown;
    return pairsFromJsonArray(raw);
  } catch {
    return [];
  }
}

function insertSourcePathTrie(root: TrieNode, pair: DocumentedPairNav): void {
  const segments = pair.sourcePath.split("/").filter(Boolean);
  if (segments.length === 0) return;
  let n = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === undefined) continue;
    if (!n.children.has(seg)) n.children.set(seg, { children: new Map(), pairs: [] });
    const next = n.children.get(seg);
    if (next === undefined) return;
    if (i === segments.length - 1) next.pairs.push(pair);
    n = next;
  }
}

function pathBasenamePosixStyle(p: string): string {
  const t = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = t.lastIndexOf("/");
  return i >= 0 ? t.slice(i + 1) : t;
}

/** Companion Markdown filename stem (e.g. `main` from `.../README.md/main.md`). */
function companionDocStem(commentrayPath: string): string {
  const norm = commentrayPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const lastSeg = norm.split("/").filter(Boolean).at(-1) ?? "";
  return lastSeg.replace(/\.md$/i, "");
}

function treeFileLinkLabel(pr: DocumentedPairNav, disambiguate: boolean): string {
  const base = pathBasenamePosixStyle(pr.sourcePath);
  if (!disambiguate) return base;
  const stem = companionDocStem(pr.commentrayPath);
  return stem !== "" && stem !== base ? `${base} · ${stem}` : base;
}

/** Prefer static hub browse page; optional SCM blob URL when the export has no `staticBrowseUrl`. */
function treeFileLinkHref(pr: DocumentedPairNav): string {
  const browse = (pr.staticBrowseUrl ?? "").trim();
  if (browse.length > 0) {
    return resolveStaticBrowseHref(
      browse,
      globalThis.location.pathname,
      globalThis.location.origin,
    );
  }
  const gh = (pr.commentrayOnGithub ?? "").trim();
  return gh.length > 0 ? gh : "#";
}

function treeFileLinkTitle(pr: DocumentedPairNav): string {
  const browse = (pr.staticBrowseUrl ?? "").trim();
  if (browse.length > 0) {
    return `${pr.sourcePath} — open this pair in the site viewer`;
  }
  if ((pr.commentrayOnGithub ?? "").trim().length > 0) {
    return `${pr.sourcePath} — open companion commentray on the repository host`;
  }
  return pr.sourcePath;
}

function clearDocumentedTreePairHighlights(tree: HTMLElement): void {
  for (const el of tree.querySelectorAll("a.tree-file-link")) {
    if (!(el instanceof HTMLAnchorElement)) continue;
    el.classList.remove("tree-file-link--current");
    el.removeAttribute("aria-current");
  }
}

function markFirstDocumentedTreeLinkMatchingPair(
  tree: HTMLElement,
  curSrc: string,
  curCr: string,
): void {
  for (const el of tree.querySelectorAll("a.tree-file-link")) {
    if (!(el instanceof HTMLAnchorElement)) continue;
    const sp = el.getAttribute("data-pair-source-path")?.trim() ?? "";
    const cp = el.getAttribute("data-pair-commentray-path")?.trim() ?? "";
    if (!isSameDocumentedPair({ sourcePath: sp, commentrayPath: cp }, curSrc, curCr)) continue;
    el.classList.add("tree-file-link--current");
    el.setAttribute("aria-current", "page");
    break;
  }
}

/** Marks the tree link for the pair shown in `#shell` (pair paths from server or multi-angle swap). */
function applyDocumentedTreeCurrentPairHighlight(): void {
  const shell = document.getElementById("shell");
  const tree = document.getElementById("documented-files-tree");
  if (!(shell instanceof HTMLElement) || !(tree instanceof HTMLElement)) return;
  clearDocumentedTreePairHighlights(tree);
  const curSrc = shell.getAttribute("data-commentray-pair-source-path")?.trim() ?? "";
  const curCr = shell.getAttribute("data-commentray-pair-commentray-path")?.trim() ?? "";
  if (curSrc.length === 0 || curCr.length === 0) return;
  markFirstDocumentedTreeLinkMatchingPair(tree, curSrc, curCr);
}

function renderDocumentedTreeHtml(node: TrieNode): string {
  const keys = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) return "";
  const lis: string[] = [];
  for (const name of keys) {
    const ch = node.children.get(name);
    if (ch === undefined) continue;
    if (ch.children.size > 0) {
      const inner = renderDocumentedTreeHtml(ch);
      lis.push(`<li><div class="tree-dir">${escapeHtmlText(name)}</div>${inner}</li>`);
    }
    if (ch.pairs.length > 0) {
      const multi = ch.pairs.length > 1;
      for (const pr of ch.pairs) {
        const label = escapeHtmlText(treeFileLinkLabel(pr, multi));
        const title = escapeHtmlText(treeFileLinkTitle(pr));
        const href = escapeHtmlText(treeFileLinkHref(pr));
        const spAttr = escapeHtmlText(normPosixPath(pr.sourcePath));
        const crAttr = escapeHtmlText(normPosixPath(pr.commentrayPath));
        const useSiteBrowse = (pr.staticBrowseUrl?.trim() ?? "").length > 0;
        const external = useSiteBrowse ? "" : ' target="_blank" rel="noopener noreferrer"';
        lis.push(
          `<li><div class="tree-file">` +
            `<a class="tree-file-link" href="${href}" data-pair-source-path="${spAttr}" data-pair-commentray-path="${crAttr}"${external} title="${title}">${label}</a>` +
            `</div></li>`,
        );
      }
    }
  }
  return `<ul>${lis.join("")}</ul>`;
}

function renderDocumentedPairsIntoHost(
  treeHost: HTMLElement,
  pairs: DocumentedPairNav[],
  emptyBecauseFilter?: boolean,
): void {
  if (pairs.length === 0) {
    treeHost.innerHTML = emptyBecauseFilter
      ? '<p class="nav-rail__doc-hub-hint" role="status">No paths match this filter.</p>'
      : '<p class="nav-rail__doc-hub-hint" role="status">No documented pairs in this export.</p>';
    return;
  }
  const root: TrieNode = { children: new Map(), pairs: [] };
  for (const p of pairs) insertSourcePathTrie(root, p);
  treeHost.innerHTML = renderDocumentedTreeHtml(root);
  applyDocumentedTreeCurrentPairHighlight();
}

function loadDocumentedPairs(
  jsonUrl: string,
  embeddedB64: string,
): () => Promise<DocumentedPairNav[]> {
  let loaded: DocumentedPairNav[] | null = null;
  let loadPromise: Promise<void> | null = null;
  return async () => {
    if (loaded !== null) return loaded;
    if (loadPromise === null) {
      loadPromise = (async () => {
        if (embeddedB64.length > 0) {
          loaded = parseDocumentedPairsFromEmbeddedB64(embeddedB64);
          if (loaded.length > 0) return;
        }
        if (jsonUrl.length === 0) {
          loaded = [];
          return;
        }
        const res = await fetch(jsonUrl, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`nav json ${String(res.status)}`);
        const body = (await res.json()) as NavJsonDoc;
        loaded = pairsFromJsonArray(body.documentedPairs);
      })();
    }
    await loadPromise;
    return loaded ?? [];
  };
}

/**
 * On narrow viewports the toolbar strip uses horizontal overflow; absolutely positioned
 * `.nav-rail__doc-hub-inner` is clipped. Pin the panel with `position: fixed` while open.
 */
function wireDocumentedFilesTreeMobileFlyout(hub: HTMLDetailsElement): () => void {
  const innerCandidate = hub.querySelector(".nav-rail__doc-hub-inner");
  if (!(innerCandidate instanceof HTMLElement)) {
    return (): void => {};
  }
  const flyoutInner: HTMLElement = innerCandidate;
  const mq = globalThis.matchMedia("(max-width: 767px)");

  function summaryEl(): HTMLElement | null {
    const s = hub.querySelector("summary");
    return s instanceof HTMLElement ? s : null;
  }

  function placeFlyout(): void {
    if (!hub.open || !mq.matches) {
      flyoutInner.style.removeProperty("position");
      flyoutInner.style.removeProperty("top");
      flyoutInner.style.removeProperty("left");
      flyoutInner.style.removeProperty("right");
      flyoutInner.style.removeProperty("width");
      flyoutInner.style.removeProperty("max-width");
      flyoutInner.style.removeProperty("max-height");
      flyoutInner.style.removeProperty("z-index");
      return;
    }
    const sum = summaryEl();
    if (!sum) return;
    const r = sum.getBoundingClientRect();
    const pad = 8;
    flyoutInner.style.position = "fixed";
    flyoutInner.style.top = `${String(Math.round(r.bottom + 4))}px`;
    flyoutInner.style.left = `${String(Math.round(pad))}px`;
    flyoutInner.style.right = `${String(Math.round(pad))}px`;
    flyoutInner.style.width = "auto";
    flyoutInner.style.maxWidth = "none";
    flyoutInner.style.maxHeight = "min(52vh, 400px)";
    flyoutInner.style.zIndex = "200";
  }

  mq.addEventListener("change", placeFlyout);
  globalThis.addEventListener("resize", placeFlyout);
  globalThis.addEventListener("scroll", placeFlyout, true);
  return placeFlyout;
}

function focusDocumentedFilesFilterInput(): void {
  const el = document.getElementById("documented-files-filter");
  if (!(el instanceof HTMLInputElement)) return;
  el.focus({ preventScroll: true });
}

function wireDocumentedFilesTree(): void {
  const hub = document.getElementById("documented-files-hub");
  const treeHost = document.getElementById("documented-files-tree");
  const filterInput = document.getElementById("documented-files-filter");
  const shell = document.getElementById("shell");
  if (!(hub instanceof HTMLDetailsElement) || !(treeHost instanceof HTMLElement)) {
    return;
  }

  const detailsHub: HTMLDetailsElement = hub;
  const treeMount: HTMLElement = treeHost;

  const jsonUrl = detailsHub.getAttribute("data-nav-json-url")?.trim() ?? "";
  const embeddedB64 = shell?.getAttribute("data-documented-pairs-b64")?.trim() ?? "";
  if (jsonUrl.length === 0 && embeddedB64.length === 0) return;

  const placeDocHubFlyout = wireDocumentedFilesTreeMobileFlyout(detailsHub);

  const ensureLoaded = loadDocumentedPairs(jsonUrl, embeddedB64);
  let cachedPairs: DocumentedPairNav[] | null = null;

  function applyFilterAndRender(): void {
    if (cachedPairs === null) return;
    const q = filterInput instanceof HTMLInputElement ? filterInput.value : "";
    const pairs = filterPairsByDocumentedTreeQuery(cachedPairs, q);
    const filterActive = q.trim().length > 0;
    renderDocumentedPairsIntoHost(
      treeMount,
      pairs,
      filterActive && cachedPairs.length > 0 && pairs.length === 0,
    );
  }

  async function hydrateTree(): Promise<void> {
    try {
      const pairs = await ensureLoaded();
      cachedPairs = pairs;
      applyFilterAndRender();
    } catch {
      cachedPairs = null;
      treeMount.innerHTML =
        '<p class="nav-rail__doc-hub-hint" role="alert">Could not load the file list.</p>';
    }
  }

  detailsHub.addEventListener("toggle", () => {
    placeDocHubFlyout();
    if (detailsHub.open) {
      globalThis.requestAnimationFrame(() => {
        placeDocHubFlyout();
        focusDocumentedFilesFilterInput();
      });
    }
    if (!detailsHub.open) return;
    void hydrateTree();
  });

  function onDocumentedFilesHubEscape(ev: KeyboardEvent): void {
    if (!detailsHub.open || ev.key !== "Escape") return;
    ev.preventDefault();
    detailsHub.open = false;
    const sum = detailsHub.querySelector("summary");
    if (sum instanceof HTMLElement) sum.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", onDocumentedFilesHubEscape, true);

  treeMount.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!detailsHub.open || e.isComposing) return;
    const t = e.target;
    if (!(t instanceof HTMLAnchorElement) || !t.classList.contains("tree-file-link")) return;
    const links = listDocumentedTreeFileLinks(treeMount);
    if (links.length === 0) return;
    const idx = links.indexOf(t);
    if (idx < 0) return;
    if (e.key === "ArrowDown") {
      if (idx < links.length - 1) {
        links[idx + 1].focus({ preventScroll: true });
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowUp") {
      if (idx > 0) {
        links[idx - 1].focus({ preventScroll: true });
        e.preventDefault();
        return;
      }
      if (filterInput instanceof HTMLInputElement) {
        filterInput.focus({ preventScroll: true });
        e.preventDefault();
      }
    }
  });

  if (filterInput instanceof HTMLInputElement) {
    filterInput.addEventListener("input", () => {
      if (!detailsHub.open || cachedPairs === null) return;
      applyFilterAndRender();
    });
    filterInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!detailsHub.open || e.isComposing || e.key !== "ArrowDown") return;
      const links = listDocumentedTreeFileLinks(treeMount);
      if (links.length === 0) return;
      links[0].focus({ preventScroll: true });
      e.preventDefault();
    });
  }
}

function wireSplitter(
  storageSplit: string,
  shell: HTMLElement,
  codePane: HTMLElement,
  gutter: HTMLElement,
  initialPct: number,
): void {
  let dragging = false;
  let lastPct = initialPct;
  function onMove(ev: MouseEvent): void {
    if (!dragging) return;
    const rect = shell.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const p = clamp((x / rect.width) * 100, 15, 85);
    lastPct = p;
    codePane.style.flex = `0 0 ${p}%`;
    shell.style.setProperty("--split-pct", `${String(p)}%`);
  }
  function stop(): void {
    dragging = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stop);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    writeWebStorageItem(localStorage, storageSplit, String(lastPct));
  }
  gutter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
  });
}

const STORAGE_SPLIT_PCT = "commentray.codeCommentrayStatic.splitPct";
const STORAGE_WRAP_LINES = "commentray.codeCommentrayStatic.wrap";
const STORAGE_DUAL_MOBILE_PANE = "commentray.codeCommentrayStatic.dualMobilePane";
const STORAGE_SOURCE_MARKDOWN_PANE_MODE = "commentray.codeCommentrayStatic.sourceMarkdownPaneMode";
const STORAGE_PAGE_BREAKS_ENABLED = "commentray.codeCommentrayStatic.pageBreaksEnabled";
/** Matches `code-browser.ts` `@media (max-width: 767px)` (dual column from 768px up). */
const DUAL_MOBILE_SINGLE_PANE_MQ = "(max-width: 767px)";

function normalizedDualMobilePane(v: string | null | undefined): "code" | "doc" {
  return v === "code" ? "code" : "doc";
}

function isNarrowViewport(): boolean {
  return globalThis.matchMedia(DUAL_MOBILE_SINGLE_PANE_MQ).matches;
}

function wireWideModeIntroTrigger(shell: HTMLElement): void {
  const btn = document.getElementById("commentray-help-tour");
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.addEventListener("click", () => {
    wireWideModeIntroTour(shell, isNarrowViewport, { force: true });
  });
}

function sourcePaneModeForShell(shell: HTMLElement): "source" | "rendered-markdown" {
  return shell.getAttribute("data-source-pane-mode") === "rendered-markdown"
    ? "rendered-markdown"
    : "source";
}

function pageBreaksEnabledFromStorage(raw: string | null): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "0" || t === "false" || t === "off") return false;
  return true;
}

function applyPageBreakFeatureToggle(shell: HTMLElement): void {
  const enabled = pageBreaksEnabledFromStorage(
    readWebStorageItem(localStorage, STORAGE_PAGE_BREAKS_ENABLED),
  );
  shell.setAttribute("data-page-breaks-enabled", enabled ? "true" : "false");
}

function wireResponsivePageBreakHeight(shell: HTMLElement): void {
  const setHeight = (): void => {
    const viewportHeight = Math.max(
      globalThis.innerHeight,
      document.documentElement?.clientHeight ?? 0,
    );
    if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
    const minHeightPx = Math.round(clamp(viewportHeight * 0.72, 260, 820));
    shell.style.setProperty("--commentray-page-break-min-height", `${String(minHeightPx)}px`);
  };
  globalThis.addEventListener("resize", setHeight, { passive: true });
  globalThis.addEventListener("orientationchange", setHeight, { passive: true });
  globalThis.visualViewport?.addEventListener("resize", setHeight, { passive: true });
  setHeight();
}

function syncWrapLinesVisibilityForSourcePaneMode(shell: HTMLElement): void {
  const wrapToggle = document.querySelector("label.toolbar-wrap-lines");
  if (!(wrapToggle instanceof HTMLLabelElement)) return;
  wrapToggle.hidden = sourcePaneModeForShell(shell) === "rendered-markdown";
}

function sourceLineIdPrefixForShell(shell: HTMLElement): "code-line-" | "code-md-line-" {
  return sourcePaneModeForShell(shell) === "rendered-markdown" ? "code-md-line-" : "code-line-";
}

/** When the commentary pane is visible, (re)run Mermaid so diagrams are not laid out under display:none. */
function scheduleMermaidWhenDualDocPaneVisible(shell: HTMLElement, mq: MediaQueryList): void {
  const kick = (): void => {
    if (shell.getAttribute("data-layout") !== "dual") return;
    if (!mq.matches) return;
    if (normalizedDualMobilePane(shell.getAttribute("data-dual-mobile-pane")) !== "doc") return;
    const docBody = document.getElementById("doc-pane-body");
    if (!(docBody instanceof HTMLElement)) return;
    runMermaidOnFreshDocNodes(docBody);
  };
  queueMicrotask(() => {
    kick();
    requestAnimationFrame(() => {
      kick();
      requestAnimationFrame(kick);
    });
  });
}

function wireDualMobilePaneFlipScrollAffordance(
  primaryFlip: HTMLButtonElement,
  scrollFlip: HTMLButtonElement,
  mq: MediaQueryList,
): void {
  const hideScroll = (): void => {
    scrollFlip.hidden = true;
    scrollFlip.classList.remove("is-visible");
  };
  const showScroll = (): void => {
    scrollFlip.hidden = false;
    scrollFlip.classList.add("is-visible");
  };
  /** Prefer geometry over IntersectionObserver: a sliver “intersecting” the viewport is still unusable. */
  const tick = (): void => {
    if (!mq.matches) {
      hideScroll();
      return;
    }
    const r = primaryFlip.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const margin = 10;
    const offScreen = r.bottom < margin || r.top > vh - margin;
    if (offScreen) showScroll();
    else hideScroll();
  };
  globalThis.addEventListener("scroll", tick, { passive: true });
  globalThis.addEventListener("resize", tick, { passive: true });
  mq.addEventListener("change", tick);
  globalThis.requestAnimationFrame(tick);
}

function wireSourceMarkdownPaneFlipAffordance(
  primaryFlip: HTMLButtonElement,
  scrollFlip: HTMLButtonElement,
): void {
  const hideScroll = (): void => {
    scrollFlip.hidden = true;
    scrollFlip.classList.remove("is-visible");
  };
  const showScroll = (): void => {
    scrollFlip.hidden = false;
    scrollFlip.classList.add("is-visible");
  };
  const tick = (): void => {
    const r = primaryFlip.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const margin = 10;
    const offScreen = r.bottom < margin || r.top > vh - margin;
    if (offScreen) showScroll();
    else hideScroll();
  };
  globalThis.addEventListener("scroll", tick, { passive: true });
  globalThis.addEventListener("resize", tick, { passive: true });
  globalThis.requestAnimationFrame(tick);
}

function closestSourceLine0ForPaneTop(codePane: HTMLElement, idPrefix: string): number | null {
  const rows = codePane.querySelectorAll<HTMLElement>(`[id^="${idPrefix}"]`);
  if (rows.length === 0) return null;
  const y = paneUsesInternalYScroll(codePane)
    ? codePane.getBoundingClientRect().top + codePane.clientTop + 2
    : Math.max(0, codePane.getBoundingClientRect().top) + 2;
  for (const el of rows) {
    const r = el.getBoundingClientRect();
    if (r.bottom > y - 1e-3) {
      const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(el.id);
      if (!m?.[1]) return null;
      return Number.parseInt(m[1], 10);
    }
  }
  const last = rows[rows.length - 1];
  if (!last) return null;
  const m = /^(?:code-line-|code-md-line-)(\d+)$/.exec(last.id);
  if (!m?.[1]) return null;
  return Number.parseInt(m[1], 10);
}

function wireSourceMarkdownPaneFlip(
  shell: HTMLElement,
  codePane: HTMLElement,
  flipBtn: HTMLButtonElement,
  flipScrollBtn: HTMLButtonElement | null,
  onAfterFlip?: () => void,
): void {
  function syncSourceMarkdownFlipA11y(): void {
    const mode = sourcePaneModeForShell(shell);
    const renderedActive = mode === "rendered-markdown";
    const nextModeLabel = renderedActive ? "markdown source" : "rendered markdown";
    const ariaLabel = `Switch source pane to ${nextModeLabel}`;
    const title = `Source pane: ${renderedActive ? "rendered markdown" : "markdown source"} (click to switch)`;
    const apply = (btn: HTMLButtonElement | null): void => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.setAttribute("aria-pressed", renderedActive ? "true" : "false");
      btn.setAttribute("aria-label", ariaLabel);
      btn.title = title;
    };
    apply(flipBtn);
    apply(flipScrollBtn);
  }

  // Keep initial behavior deterministic: source pane starts in rendered markdown mode.
  shell.setAttribute("data-source-pane-mode", "rendered-markdown");
  syncSourceMarkdownFlipA11y();
  syncWrapLinesVisibilityForSourcePaneMode(shell);
  const runFlip = (): void => {
    const cur = sourcePaneModeForShell(shell);
    const currentPrefix = cur === "rendered-markdown" ? "code-md-line-" : "code-line-";
    const line0 = closestSourceLine0ForPaneTop(codePane, currentPrefix);
    const next = cur === "rendered-markdown" ? "source" : "rendered-markdown";
    const nextPrefix = next === "rendered-markdown" ? "code-md-line-" : "code-line-";
    shell.setAttribute("data-source-pane-mode", next);
    writeWebStorageItem(localStorage, STORAGE_SOURCE_MARKDOWN_PANE_MODE, next);
    syncSourceMarkdownFlipA11y();
    syncWrapLinesVisibilityForSourcePaneMode(shell);
    if (line0 !== null) {
      const row = codePane.querySelector(`#${nextPrefix}${String(line0)}`);
      if (row instanceof HTMLElement) {
        applyRevealChildInPane(codePane, row, 2);
      }
    }
    if (next === "rendered-markdown") {
      const sourceMdBody = document.getElementById("code-pane-markdown-body");
      if (sourceMdBody instanceof HTMLElement) {
        runMermaidOnFreshDocNodes(sourceMdBody);
        rewriteHubRelativeBrowseAnchorsIn(sourceMdBody);
      }
    }
    onAfterFlip?.();
  };
  flipBtn.addEventListener("click", runFlip);
  if (flipScrollBtn) {
    flipScrollBtn.addEventListener("click", runFlip);
    wireSourceMarkdownPaneFlipAffordance(flipBtn, flipScrollBtn);
  }
}

function wireDualMobilePaneFlip(
  shell: HTMLElement,
  flipBtn: HTMLButtonElement,
  scrollRunners: DualPaneScrollSyncRunners,
  flipScrollBtn: HTMLButtonElement | null,
): void {
  const mq = globalThis.matchMedia(DUAL_MOBILE_SINGLE_PANE_MQ);
  function readStoredPane(): "code" | "doc" {
    return normalizedDualMobilePane(readWebStorageItem(localStorage, STORAGE_DUAL_MOBILE_PANE));
  }
  function applyForViewport(): void {
    if (mq.matches) {
      shell.setAttribute("data-dual-mobile-pane", readStoredPane());
    } else {
      shell.removeAttribute("data-dual-mobile-pane");
    }
  }
  const runFlip = (): void => {
    if (!mq.matches) return;
    const cur = normalizedDualMobilePane(shell.getAttribute("data-dual-mobile-pane"));
    const next = cur === "code" ? "doc" : "code";
    const rootTopBeforeFlip = rootScrollingElement().scrollTop;
    if (next === "code") {
      scrollRunners.prepareMobileFlipToCode();
    } else {
      scrollRunners.prepareMobileFlipToDoc();
    }
    shell.setAttribute("data-dual-mobile-pane", next);
    writeWebStorageItem(localStorage, STORAGE_DUAL_MOBILE_PANE, next);
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => {
        if (next === "code") {
          scrollRunners.finishMobileFlipToCode();
          const root = rootScrollingElement();
          if (rootTopBeforeFlip > 5 && root.scrollTop <= 1) {
            const maxY = Math.max(0, root.scrollHeight - root.clientHeight);
            root.scrollTop = clamp(rootTopBeforeFlip, 0, maxY);
          }
        } else {
          scrollRunners.finishMobileFlipToDoc();
        }
      });
    });
    // Only here (not on every viewport apply): avoids redundant Mermaid passes on load/resize for the default commentary-first shell.
    if (next === "doc") {
      scheduleMermaidWhenDualDocPaneVisible(shell, mq);
    }
  };
  flipBtn.addEventListener("click", runFlip);
  if (flipScrollBtn) {
    flipScrollBtn.addEventListener("click", runFlip);
    wireDualMobilePaneFlipScrollAffordance(flipBtn, flipScrollBtn, mq);
  }
  mq.addEventListener("change", applyForViewport);
  applyForViewport();
}

function wireStretchLayoutChrome(codePane: HTMLElement): void {
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  if (wrapCb) {
    wireWrapToggle(STORAGE_WRAP_LINES, codePane, wrapCb, () => {
      globalThis.dispatchEvent(new Event("resize"));
    });
  }
}

type MultiAngleClientPayload = {
  defaultAngleId: string;
  angles: {
    id: string;
    title: string;
    docInnerHtmlB64: string;
    rawMdB64: string;
    scrollBlockLinksB64: string;
    commentrayPathForSearch: string;
    commentrayOnGithubUrl?: string;
    staticBrowseUrl?: string;
  }[];
};

function parseMultiAnglePayload(script: HTMLElement | null): MultiAngleClientPayload | null {
  const t = script?.textContent?.trim() ?? "";
  if (!t) return null;
  try {
    const raw = JSON.parse(decodeBase64Utf8(t)) as MultiAngleClientPayload;
    if (!raw || !Array.isArray(raw.angles) || raw.angles.length < 2) return null;
    for (const a of raw.angles) {
      if (typeof a.id !== "string" || typeof a.docInnerHtmlB64 !== "string") return null;
    }
    return raw;
  } catch {
    return null;
  }
}

type DualPaneDomBundle = {
  docBody: HTMLElement | null;
  docScrollEl: HTMLElement;
  gutter: HTMLElement;
  wrapCb: HTMLInputElement;
  searchInput: HTMLInputElement;
  searchClear: HTMLElement;
  searchResults: HTMLElement;
};

function readDualPaneDomBundle(): DualPaneDomBundle | null {
  const docPane = document.getElementById("doc-pane");
  const gutter = document.getElementById("gutter");
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  const searchInput = document.getElementById("search-q") as HTMLInputElement | null;
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");
  if (!docPane || !gutter || !wrapCb || !searchInput || !searchClear || !searchResults) {
    return null;
  }
  const docBody = document.getElementById("doc-pane-body");
  const docScrollEl = docBody instanceof HTMLElement ? docBody : docPane;
  return { docBody, docScrollEl, gutter, wrapCb, searchInput, searchClear, searchResults };
}

function hubSearcherRowsForDualPane(args: {
  scope: SearchScope;
  rawCode: string;
  filePathLabel: string;
  hubNavRows: Row[];
  pathRowsForOrdering: Row[];
  rawMd: string;
  commentrayPathLabel: string;
}): Row[] {
  const {
    scope,
    rawCode,
    filePathLabel,
    hubNavRows,
    pathRowsForOrdering,
    rawMd,
    commentrayPathLabel,
  } = args;
  if (scope !== "commentray-and-paths") {
    return buildIndexedSearchRows(scope, rawCode, rawMd, filePathLabel, commentrayPathLabel);
  }
  if (hubNavRows.length > 0) return hubNavRows;
  const pathPart =
    pathRowsForOrdering.length > 0
      ? pathRowsForOrdering
      : buildIndexedSearchRows(scope, rawCode, rawMd, filePathLabel, commentrayPathLabel).filter(
          (r) => r.kind === "path",
        );
  const mdRows = rawMd.split("\n").map((text, line) => ({
    kind: "md" as const,
    line,
    text,
    spPath: filePathLabel,
    crPath: commentrayPathLabel,
  }));
  return [...pathPart, ...mdRows];
}

function initialCommentrayScopePathState(
  shell: HTMLElement,
  scope: SearchScope,
  filePathLabel: string,
  commentrayPathLabel: string,
): { documentedPairs: DocumentedPairNav[]; pathRowsForOrdering: Row[]; pathBlobWide: string } {
  if (scope !== "commentray-and-paths") {
    return { documentedPairs: [], pathRowsForOrdering: [], pathBlobWide: "" };
  }
  const documentedPairs = parseDocumentedPairsFromEmbeddedB64(
    shell.getAttribute("data-documented-pairs-b64")?.trim() ?? "",
  );
  const pathRowsForOrdering = pathRowsFromDocumentedPairs(documentedPairs);
  const pathBlobWide =
    pathRowsForOrdering.length > 0
      ? pathRowsForOrdering.map((r) => r.text).join("\n")
      : [filePathLabel, commentrayPathLabel].filter((s) => s.trim().length > 0).join("\n");
  return { documentedPairs, pathRowsForOrdering, pathBlobWide };
}

type DualPaneSearchIndexState = {
  hubNavRows: Row[];
  documentedPairs: DocumentedPairNav[];
  pathRowsForOrdering: Row[];
};

/**
 * Fetched `commentray-nav-search.json` sometimes omits `staticBrowseUrl` on pairs; the hub embed
 * carries browse URLs from the same build — merge so search hits open `_site/browse/…`, not GitHub.
 */
function mergeFetchedDocumentedPairsWithEmbeddedBrowse(
  embedded: DocumentedPairNav[],
  fetched: DocumentedPairNav[],
): DocumentedPairNav[] {
  if (fetched.length === 0) return embedded;
  if (embedded.length === 0) return fetched;
  const browseByCr = new Map<string, string>();
  for (const p of embedded) {
    const b = (p.staticBrowseUrl ?? "").trim();
    if (b.length === 0) continue;
    browseByCr.set(normPosixPath(p.commentrayPath), b);
  }
  return fetched.map((p) => {
    const have = (p.staticBrowseUrl ?? "").trim();
    if (have.length > 0) return p;
    const fromEmb = browseByCr.get(normPosixPath(p.commentrayPath));
    if (fromEmb !== undefined && fromEmb.length > 0) {
      return { ...p, staticBrowseUrl: fromEmb };
    }
    return p;
  });
}

function resolvedNavSearchJsonUrl(shell: HTMLElement): string {
  const raw = shell.getAttribute("data-nav-search-json-url")?.trim() ?? "";
  if (raw.length === 0) return "";
  try {
    return new URL(raw, globalThis.location.href).href;
  } catch {
    return raw;
  }
}

function wireDualPaneNavSearchFetch(
  shell: HTMLElement,
  embeddedPairs: DocumentedPairNav[],
  indexState: DualPaneSearchIndexState,
  mutable: MutableSearchFields,
  rebuildSearcher: () => void,
  searchInput: HTMLInputElement,
): void {
  const navSearchUrl = resolvedNavSearchJsonUrl(shell);
  if (navSearchUrl.length === 0) return;
  void (async () => {
    try {
      const res = await fetch(navSearchUrl, { credentials: "same-origin" });
      if (!res.ok) return;
      const doc = (await res.json()) as NavJsonDoc;
      const fetched = pairsFromJsonArray(doc.documentedPairs);
      const mergedPairs = mergeFetchedDocumentedPairsWithEmbeddedBrowse(embeddedPairs, fetched);
      if (mergedPairs.length > 0) {
        indexState.documentedPairs = mergedPairs;
        mutable.documentedPairs = mergedPairs;
      }
      const nr = rowsFromNavSearchJson(doc);
      if (nr.length === 0) return;
      indexState.hubNavRows = nr;
      indexState.pathRowsForOrdering = nr.filter((r) => r.kind === "path");
      mutable.pathRowsForOrdering = indexState.pathRowsForOrdering;
      mutable.pathBlobWide = indexState.pathRowsForOrdering.map((r) => r.text).join("\n");
      rebuildSearcher();
      if (searchInput.value.trim().length > 0) {
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch {
      /* keep embedded index */
    }
  })();
}

function applySelectedMultiAngle(args: {
  angle: NonNullable<MultiAngleClientPayload>["angles"][number];
  docBody: HTMLElement;
  mutable: MutableSearchFields;
  rebuildSearcher: () => void;
  scrollLinksRef: { current: BlockScrollLink[] };
  shell: HTMLElement;
  searchInput: HTMLInputElement;
  searchResults: HTMLElement;
  requestBlockRayRedraw?: () => void;
}): void {
  const {
    angle,
    docBody,
    mutable,
    rebuildSearcher,
    scrollLinksRef,
    shell,
    searchInput,
    searchResults,
    requestBlockRayRedraw,
  } = args;
  docBody.innerHTML = decodeBase64Utf8(angle.docInnerHtmlB64);
  runMermaidOnFreshDocNodes(docBody);
  rewriteHubRelativeBrowseAnchorsIn(docBody);
  mutable.rawMd = decodeBase64Utf8(angle.rawMdB64);
  mutable.mdLines = mutable.rawMd.split("\n");
  mutable.commentrayPathLabel = angle.commentrayPathForSearch;
  rebuildSearcher();
  scrollLinksRef.current = parseScrollBlockLinksFromShell(angle.scrollBlockLinksB64);
  shell.setAttribute("data-scroll-block-links-b64", angle.scrollBlockLinksB64);
  shell.setAttribute("data-search-commentray-path", angle.commentrayPathForSearch);
  const crIdentity = normPosixPath(angle.commentrayPathForSearch);
  if (crIdentity.length > 0) shell.setAttribute("data-commentray-pair-commentray-path", crIdentity);
  else shell.removeAttribute("data-commentray-pair-commentray-path");
  applyDocumentedTreeCurrentPairHighlight();
  const docPathEl = document.getElementById("nav-rail-doc-path");
  if (docPathEl) {
    const path = angle.commentrayPathForSearch.trim();
    docPathEl.textContent = path.length > 0 ? path : "—";
    if (path.length > 0) docPathEl.setAttribute("title", path);
    else docPathEl.removeAttribute("title");
  }
  const browse = angle.staticBrowseUrl?.trim() ?? "";
  if (browse.length > 0) {
    const resolved = staticBrowseHrefForShellDataAttribute(
      browse,
      globalThis.location.pathname,
      globalThis.location.origin,
    );
    shell.setAttribute("data-commentray-pair-browse-href", resolved);
  } else {
    const ghu = angle.commentrayOnGithubUrl?.trim();
    if (ghu) shell.setAttribute("data-commentray-pair-browse-href", ghu);
    else shell.removeAttribute("data-commentray-pair-browse-href");
  }
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchResults.hidden = true;
  requestBlockRayRedraw?.();
  globalThis.requestAnimationFrame(() => {
    requestBlockRayRedraw?.();
    globalThis.requestAnimationFrame(() => {
      requestBlockRayRedraw?.();
    });
  });
}

function wireDualPaneMultiAngleAndScroll(args: {
  codePane: HTMLElement;
  docScrollEl: HTMLElement;
  docBody: HTMLElement | null;
  shell: HTMLElement;
  scrollLinksRef: { current: BlockScrollLink[] };
  multiPayload: MultiAngleClientPayload | null;
  mutable: MutableSearchFields;
  rebuildSearcher: () => void;
  searchInput: HTMLInputElement;
  searchResults: HTMLElement;
  requestBlockRayRedraw?: () => void;
}): DualPaneScrollSyncRunners {
  const {
    codePane,
    docScrollEl,
    docBody,
    shell,
    scrollLinksRef,
    multiPayload,
    mutable,
    rebuildSearcher,
    searchInput,
    searchResults,
    requestBlockRayRedraw,
  } = args;
  if (multiPayload) {
    const runners = wireBlockAwareScrollSync(
      codePane,
      docScrollEl,
      () => scrollLinksRef.current,
      () => sourceLineIdPrefixForShell(shell),
      () => sourcePaneModeForShell(shell) === "rendered-markdown",
    );
    const angleSel = document.getElementById("angle-select") as HTMLSelectElement | null;
    if (angleSel && docBody) {
      angleSel.addEventListener("change", () => {
        const a = multiPayload.angles.find((x) => x.id === angleSel.value);
        if (!a) return;
        applySelectedMultiAngle({
          angle: a,
          docBody,
          mutable,
          rebuildSearcher,
          scrollLinksRef,
          shell,
          searchInput,
          searchResults,
          requestBlockRayRedraw,
        });
      });
    }
    return runners;
  }
  if (scrollLinksRef.current.length > 0) {
    return wireBlockAwareScrollSync(
      codePane,
      docScrollEl,
      () => scrollLinksRef.current,
      () => sourceLineIdPrefixForShell(shell),
      () => sourcePaneModeForShell(shell) === "rendered-markdown",
    );
  }
  return wireProportionalScrollSync(codePane, docScrollEl);
}

function wireDualPaneCommentrayLocationHash(
  docScrollEl: HTMLElement,
  mdLineCount: () => number,
): void {
  function commentrayMdLineFromLocationHash(rawHash: string): number | null {
    const hash = rawHash.replace(/^#/, "").trim();
    if (hash.length === 0) return null;
    const tokens = hash
      .split(/--|&/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    for (const token of tokens) {
      const m = /^commentray-md-line-(\d+)$/.exec(token);
      if (!m?.[1]) continue;
      const line0 = Number.parseInt(m[1], 10);
      if (Number.isFinite(line0)) return line0;
    }
    return null;
  }

  function applyCommentrayLocationHash(): void {
    const line0 = commentrayMdLineFromLocationHash(globalThis.location.hash);
    if (line0 === null) return;
    scrollDocToMarkdownLine0(docScrollEl, line0, mdLineCount());
  }
  globalThis.addEventListener("hashchange", applyCommentrayLocationHash);
  globalThis.requestAnimationFrame(() => {
    globalThis.requestAnimationFrame(applyCommentrayLocationHash);
  });
}

type DualPaneSearcherBundle = {
  rawCode: string;
  rawMd: string;
  scrollLinksRef: { current: BlockScrollLink[] };
  scope: SearchScope;
  filePathLabel: string;
  commentrayPathLabel: string;
  pathInit: ReturnType<typeof initialCommentrayScopePathState>;
  indexState: DualPaneSearchIndexState;
  mutable: MutableSearchFields;
  rebuildSearcher: () => void;
};

function initializeSourceMarkdownPane(shell: HTMLElement): void {
  if (sourcePaneModeForShell(shell) !== "rendered-markdown") return;
  const sourceMdBody = document.getElementById("code-pane-markdown-body");
  if (!(sourceMdBody instanceof HTMLElement)) return;
  runMermaidOnFreshDocNodes(sourceMdBody);
  rewriteHubRelativeBrowseAnchorsIn(sourceMdBody);
}

function wireSourceMarkdownControls(
  shell: HTMLElement,
  codePane: HTMLElement,
  onAfterFlip?: () => void,
): void {
  const sourceMdFlip = document.getElementById("source-markdown-pane-flip");
  const sourceMdFlipScroll = document.getElementById("source-markdown-pane-flip-scroll");
  if (!(sourceMdFlip instanceof HTMLButtonElement)) return;
  wireSourceMarkdownPaneFlip(
    shell,
    codePane,
    sourceMdFlip,
    sourceMdFlipScroll instanceof HTMLButtonElement ? sourceMdFlipScroll : null,
    onAfterFlip,
  );
  initializeSourceMarkdownPane(shell);
}

function buildDualPaneSearcherBundle(
  shell: HTMLElement,
  codePane: HTMLElement,
): DualPaneSearcherBundle {
  const { rawCodeB64, rawMdB64 } = readEmbeddedRawB64Strings(shell, codePane);
  const rawCode = decodeBase64Utf8(rawCodeB64);
  const rawMd = decodeBase64Utf8(rawMdB64);
  const scrollLinks = parseScrollBlockLinksFromShell(
    shell.getAttribute("data-scroll-block-links-b64") || "",
  );
  const scrollLinksRef = { current: scrollLinks };
  const { scope, filePathLabel, commentrayPathLabel } = readSearchScopeFromShell(shell);

  const pathInit = initialCommentrayScopePathState(
    shell,
    scope,
    filePathLabel,
    commentrayPathLabel,
  );
  const indexState: DualPaneSearchIndexState = {
    hubNavRows: [],
    documentedPairs: pathInit.documentedPairs,
    pathRowsForOrdering: pathInit.pathRowsForOrdering,
  };

  const mutable: MutableSearchFields = {
    rawMd,
    mdLines: rawMd.split("\n"),
    commentrayPathLabel,
    searcher: indexSearchLineRows([]),
    pathBlobWide: pathInit.pathBlobWide,
    pathRowsForOrdering: indexState.pathRowsForOrdering,
    documentedPairs: indexState.documentedPairs,
  };

  function rebuildSearcher(): void {
    mutable.searcher = indexSearchLineRows(
      hubSearcherRowsForDualPane({
        scope,
        rawCode,
        filePathLabel,
        hubNavRows: indexState.hubNavRows,
        pathRowsForOrdering: indexState.pathRowsForOrdering,
        rawMd: mutable.rawMd,
        commentrayPathLabel: mutable.commentrayPathLabel,
      }),
    );
  }
  rebuildSearcher();

  return {
    rawCode,
    rawMd,
    scrollLinksRef,
    scope,
    filePathLabel,
    commentrayPathLabel,
    pathInit,
    indexState,
    mutable,
    rebuildSearcher,
  };
}

function wireDualPaneCodeBrowser(shell: HTMLElement, codePane: HTMLElement): void {
  const dom = readDualPaneDomBundle();
  if (!dom) return;

  const { docBody, docScrollEl, gutter, wrapCb, searchInput, searchClear, searchResults } = dom;

  const bundle = buildDualPaneSearcherBundle(shell, codePane);

  rewriteHubRelativeBrowseAnchorsIn(document);

  wireSearchUi({
    scope: bundle.scope,
    filePathLabel: bundle.filePathLabel,
    mutable: bundle.mutable,
    rawCode: bundle.rawCode,
    searchInput,
    searchClear,
    searchResults,
    docScrollEl,
  });

  wireDualPaneNavSearchFetch(
    shell,
    bundle.pathInit.documentedPairs,
    bundle.indexState,
    bundle.mutable,
    bundle.rebuildSearcher,
    searchInput,
  );

  const pct0 = parseFloat(readWebStorageItem(localStorage, STORAGE_SPLIT_PCT) || "46");
  const pct = clamp(Number.isFinite(pct0) ? pct0 : 46, 15, 85);
  codePane.style.flex = `0 0 ${pct}%`;
  shell.style.setProperty("--split-pct", `${String(pct)}%`);

  const docPaneEl = document.getElementById("doc-pane");
  const docPaneForWrap = docPaneEl instanceof HTMLElement ? docPaneEl : null;
  const sourceMdBodyForWrap = document.getElementById("code-pane-markdown-body");

  const blockRayRedraw: { request?: () => void } = {};
  wireWrapToggle(
    STORAGE_WRAP_LINES,
    codePane,
    wrapCb,
    () => {
      blockRayRedraw.request?.();
    },
    docPaneForWrap,
    docBody,
    sourceMdBodyForWrap instanceof HTMLElement ? sourceMdBodyForWrap : null,
  );
  wireSplitter(STORAGE_SPLIT_PCT, shell, codePane, gutter, pct);

  const multiScript = document.getElementById("commentray-multi-angle-b64");
  const multiPayload = parseMultiAnglePayload(multiScript);
  const shouldWireBlockRays = multiPayload !== null || bundle.scrollLinksRef.current.length > 0;
  const requestBlockRayRedraw = shouldWireBlockRays
    ? wireBlockRayConnectors({
        gutter,
        codePane,
        docScrollEl,
        getLinks: () => bundle.scrollLinksRef.current,
        probeTopSourceLine1Based: () =>
          probeCodeLine1FromViewport(codePane, sourceLineIdPrefixForShell(shell)),
        sourceLineIdPrefix: () => sourceLineIdPrefixForShell(shell),
      })
    : undefined;
  blockRayRedraw.request = requestBlockRayRedraw;
  const scrollRunners = wireDualPaneMultiAngleAndScroll({
    codePane,
    docScrollEl,
    docBody,
    shell,
    scrollLinksRef: bundle.scrollLinksRef,
    multiPayload,
    mutable: bundle.mutable,
    rebuildSearcher: bundle.rebuildSearcher,
    searchInput,
    searchResults,
    requestBlockRayRedraw,
  });

  const flipBtn = document.getElementById("mobile-pane-flip");
  const flipScrollBtn = document.getElementById("mobile-pane-flip-scroll");
  if (flipBtn instanceof HTMLButtonElement) {
    wireDualMobilePaneFlip(
      shell,
      flipBtn,
      scrollRunners,
      flipScrollBtn instanceof HTMLButtonElement ? flipScrollBtn : null,
    );
  }
  wireSourceMarkdownControls(shell, codePane, () => {
    requestBlockRayRedraw?.();
  });
  wireWideModeIntroTour(shell, isNarrowViewport);

  wireDualPaneCommentrayLocationHash(docScrollEl, () => bundle.mutable.mdLines.length);
}

function commentrayThemeModeLabel(mode: CommentrayColorThemeMode): string {
  if (mode === "light") return "Light";
  if (mode === "dark") return "Dark";
  return "System";
}

function setCommentrayThemeTriggerHints(
  trigger: HTMLButtonElement,
  mode: CommentrayColorThemeMode,
): void {
  const label = commentrayThemeModeLabel(mode);
  trigger.setAttribute(
    "aria-label",
    `Color theme: ${label}. Left-click opens the menu. Right-click cycles System, Light, and Dark.`,
  );
  trigger.title = `Appearance: ${label} — left-click menu, right-click cycle`;
}

function wireColorThemeToolbar(): void {
  const wrapEl = document.querySelector(".toolbar-theme");
  const triggerEl = document.getElementById("commentray-theme-trigger");
  const menuEl = document.getElementById("commentray-theme-menu");
  if (!wrapEl || !(triggerEl instanceof HTMLButtonElement) || !(menuEl instanceof HTMLElement))
    return;

  const themeToolbarWrap: Element = wrapEl;
  const themeButton: HTMLButtonElement = triggerEl;
  const themeMenu: HTMLElement = menuEl;

  let currentMode: CommentrayColorThemeMode = parseCommentrayColorThemeMode(
    readWebStorageItem(localStorage, COMMENTRAY_COLOR_THEME_STORAGE_KEY),
  );
  applyCommentrayColorTheme(currentMode);

  let menuOpen = false;

  function syncUi(): void {
    themeButton.dataset.commentrayTriggerMode = currentMode;
    themeButton.setAttribute("aria-expanded", menuOpen ? "true" : "false");
    setCommentrayThemeTriggerHints(themeButton, currentMode);
    for (const el of themeMenu.querySelectorAll<HTMLButtonElement>(
      "[data-commentray-theme-value]",
    )) {
      const v = parseCommentrayColorThemeMode(el.dataset.commentrayThemeValue ?? "");
      el.setAttribute("aria-checked", v === currentMode ? "true" : "false");
    }
  }

  function openMenu(): void {
    menuOpen = true;
    themeMenu.removeAttribute("hidden");
    syncUi();
    const checked = themeMenu.querySelector<HTMLElement>(
      '[role="menuitemradio"][aria-checked="true"]',
    );
    (checked ?? themeMenu.querySelector<HTMLElement>('[role="menuitemradio"]'))?.focus();
  }

  function closeMenu(): void {
    menuOpen = false;
    themeMenu.setAttribute("hidden", "");
    syncUi();
  }

  function persistAndApply(mode: CommentrayColorThemeMode): void {
    currentMode = mode;
    writeWebStorageItem(localStorage, COMMENTRAY_COLOR_THEME_STORAGE_KEY, mode);
    applyCommentrayColorTheme(mode);
    syncUi();
  }

  themeButton.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  themeButton.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    if (menuOpen) closeMenu();
    persistAndApply(nextCommentrayColorThemeMode(currentMode));
  });

  for (const item of themeMenu.querySelectorAll<HTMLButtonElement>(
    "[data-commentray-theme-value]",
  )) {
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const mode = parseCommentrayColorThemeMode(item.dataset.commentrayThemeValue ?? "");
      persistAndApply(mode);
      closeMenu();
      themeButton.focus();
    });
  }

  function onDocumentPointerDown(ev: Event): void {
    if (!menuOpen) return;
    const t = ev.target;
    if (!(t instanceof Node)) return;
    if (themeToolbarWrap.contains(t)) return;
    closeMenu();
  }

  function onDocumentKeydown(ev: KeyboardEvent): void {
    if (!menuOpen || ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    closeMenu();
    themeButton.focus();
  }

  document.addEventListener("mousedown", onDocumentPointerDown, true);
  document.addEventListener("touchstart", onDocumentPointerDown, true);
  document.addEventListener("keydown", onDocumentKeydown, true);

  syncUi();
}

function safePermalinkHref(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  if (/^(javascript|data):/i.test(t)) return null;
  try {
    return new URL(t, globalThis.location.href).toString();
  } catch {
    return null;
  }
}

function makeAbsoluteUrlAgainst(raw: string, baseHref: string): string {
  return new URL(raw, baseHref).toString();
}

function absolutizeNavJsonUrls(shell: HTMLElement, beforeHref: string): void {
  const navSearchRaw = shell.getAttribute("data-nav-search-json-url")?.trim() ?? "";
  if (navSearchRaw.length > 0) {
    shell.setAttribute(
      "data-nav-search-json-url",
      makeAbsoluteUrlAgainst(navSearchRaw, beforeHref),
    );
  }
  const navTree = document.getElementById("documented-files-hub");
  if (navTree instanceof HTMLElement) {
    const navRaw = navTree.getAttribute("data-nav-json-url")?.trim() ?? "";
    if (navRaw.length > 0) {
      navTree.setAttribute("data-nav-json-url", makeAbsoluteUrlAgainst(navRaw, beforeHref));
    }
  }
}

function normalizePairBrowseHrefForCurrentPath(shell: HTMLElement, pathname: string): void {
  const pairBrowseRaw = shell.getAttribute("data-commentray-pair-browse-href")?.trim() ?? "";
  if (pairBrowseRaw.length > 0 && isHubRelativeStaticBrowseHref(pairBrowseRaw)) {
    shell.setAttribute(
      "data-commentray-pair-browse-href",
      resolveStaticBrowseHref(pairBrowseRaw, pathname, globalThis.location.origin),
    );
  }
}

function activeCommentrayHashTokenFromViewport(): string | null {
  const docPane = document.getElementById("doc-pane");
  if (!(docPane instanceof HTMLElement)) return null;
  const docBody = document.getElementById("doc-pane-body");
  const docScrollEl = docBody instanceof HTMLElement ? docBody : docPane;
  const anchors = docScrollEl.querySelectorAll<HTMLElement>(".commentray-block-anchor");
  if (anchors.length === 0) return null;
  const mdLine0 = probeCommentrayLine0FromDoc(docScrollEl);
  if (mdLine0 === null || !Number.isFinite(mdLine0) || mdLine0 < 0) return null;
  return `commentray-md-line-${String(mdLine0)}`;
}

/**
 * Resolves hub-relative `data-nav-*` and pair-browse attributes against the current document URL so
 * `fetch()` and toolbar targets work from deep `/browse/…/index.html` pages (static HTML stays portable).
 */
function resolveEmbeddedStaticNavUrlsForCurrentPage(shell: HTMLElement): void {
  if ((shell.getAttribute("data-layout") ?? "dual") !== "dual") return;
  const pathname = globalThis.location.pathname;
  const beforeHref = globalThis.location.href;
  absolutizeNavJsonUrls(shell, beforeHref);
  normalizePairBrowseHrefForCurrentPath(shell, pathname);
}

function permalinkHashSuffixFromUi(): string {
  const tokens: string[] = [];
  const pushUnique = (token: string): void => {
    const t = token.trim();
    if (t.length === 0) return;
    if (!tokens.includes(t)) tokens.push(t);
  };
  const angleSel = document.getElementById("angle-select");
  if (angleSel instanceof HTMLSelectElement) {
    const id = angleSel.value.trim();
    if (id.length > 0) {
      pushUnique(`angle-${encodeURIComponent(id)}`);
    }
  }
  const activeAnchor = activeCommentrayHashTokenFromViewport();
  if (activeAnchor) pushUnique(activeAnchor);
  return tokens.length > 0 ? `#${tokens.join("&")}` : "";
}

function sharePermalinkFromShell(shell: HTMLElement): string {
  const raw = shell.getAttribute("data-commentray-pair-browse-href") ?? "";
  const canonical =
    isHubRelativeStaticBrowseHref(raw.trim()) && raw.trim().length > 0
      ? resolveStaticBrowseHref(
          raw.trim(),
          globalThis.location.pathname,
          globalThis.location.origin,
        )
      : safePermalinkHref(raw);
  const base = canonical ?? globalThis.location.href;
  const u = new URL(base, globalThis.location.href);
  const hash = permalinkHashSuffixFromUi();
  u.hash = hash.length > 0 ? hash.slice(1) : "";
  return u.toString();
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

function wireSharePermalinkButton(): void {
  const shell = document.getElementById("shell");
  const btn = document.getElementById("commentray-share-link");
  if (!(shell instanceof HTMLElement) || !(btn instanceof HTMLButtonElement)) return;
  const baseLabel = "Copy shareable permalink";
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener("click", () => {
    void (async () => {
      const shareUrl = sharePermalinkFromShell(shell);
      const copied = await writeTextToClipboard(shareUrl);
      if (!copied) return;
      btn.dataset.copied = "true";
      btn.setAttribute("aria-label", "Permalink copied");
      btn.title = "Permalink copied";
      if (copiedTimer !== undefined) globalThis.clearTimeout(copiedTimer);
      copiedTimer = globalThis.setTimeout(() => {
        delete btn.dataset.copied;
        btn.setAttribute("aria-label", baseLabel);
        btn.title = baseLabel;
      }, 1200);
    })();
  });
}

function main(): void {
  wireSharePermalinkButton();
  wireColorThemeToolbar();
  wireDocumentedFilesTree();

  const shell = document.getElementById("shell");
  const codePane = document.getElementById("code-pane");
  if (!shell || !codePane) {
    return;
  }
  applyPageBreakFeatureToggle(shell);
  wireResponsivePageBreakHeight(shell);
  wireWideModeIntroTrigger(shell);

  const layout = shell.getAttribute("data-layout") || "dual";
  if (layout === "stretch") {
    wireStretchLayoutChrome(codePane);
    return;
  }

  wireDualPaneCodeBrowser(shell, codePane);
  resolveEmbeddedStaticNavUrlsForCurrentPage(shell);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
