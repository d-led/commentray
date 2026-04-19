import {
  FuzzySearcher,
  PrefixSearcher,
  Query,
  SearcherFactory,
  SubstringSearcher,
} from "@m31coding/fuzzy-search";
import {
  activeBlockIdForViewport,
  clampViewportYToGutterLocal,
  codeLineDomIndex0,
  gutterRayBezierPaths,
  sortBlockLinksBySource,
} from "./code-browser-block-rays.js";
import {
  type BlockScrollLink,
  mirroredScrollTop,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./code-browser-scroll-sync.js";
import { decodeBase64Utf8 } from "./code-browser-encoding.js";
import { readEmbeddedRawB64Strings } from "./code-browser-embedded-payload.js";
import {
  escapeHtmlHighlightingSearchTokens,
  findOrderedTokenSpans,
  lineAtIndex,
  offsetToLineIndex,
  pathRowsFromDocumentedPairs,
  uniqueSourceFilePreviewRows,
  type SourceFilePreviewRow,
} from "./code-browser-search.js";
import {
  findDocumentedPair,
  isSameDocumentedPair,
  resolveStaticBrowseHref,
} from "./code-browser-pair-nav.js";
import { readWebStorageItem, writeWebStorageItem } from "./code-browser-web-storage.js";

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

function tokenizeQuery(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
    const top =
      el.getBoundingClientRect().top -
      docScrollEl.getBoundingClientRect().top +
      docScrollEl.scrollTop;
    docScrollEl.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    return;
  }
  if (mdLineCount <= 1) return;
  const ratio = line0 / Math.max(1, mdLineCount - 1);
  const maxScroll = docScrollEl.scrollHeight - docScrollEl.clientHeight;
  docScrollEl.scrollTo({ top: ratio * Math.max(0, maxScroll), behavior: "smooth" });
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
  if (pair.commentrayOnGithub) {
    const url =
      mdLine0 !== null && mdLine0 >= 0
        ? `${pair.commentrayOnGithub}#L${String(mdLine0 + 1)}`
        : pair.commentrayOnGithub;
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

function scrollCodeHitToView(line: number): void {
  const el = document.getElementById(`code-line-${String(line)}`);
  if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function handlePathSearchHit(button: HTMLElement, deps: SearchHitClickDeps): void {
  const hitCr = (button.getAttribute("data-cr-path") ?? "").trim();
  const hitSp = (button.getAttribute("data-sp-path") ?? "").trim();
  const pair = findDocumentedPair(deps.mutable.documentedPairs, hitCr, hitSp);
  if (
    pair &&
    isSameDocumentedPair(pair, deps.filePathLabel, deps.mutable.commentrayPathLabel)
  ) {
    deps.docScrollEl.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (pair) navigateToDocumentedPair(pair, null);
}

function handleMdSearchHit(line: number, crHit: string, deps: SearchHitClickDeps): void {
  if (crHit.length > 0 && crHit !== deps.mutable.commentrayPathLabel) {
    const pair = findDocumentedPair(deps.mutable.documentedPairs, crHit, "");
    if (pair) navigateToDocumentedPair(pair, line);
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

  function clearSearch(): void {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
    searchInput.value = "";
    searchResults.innerHTML = "";
    searchResults.hidden = true;
  }

  function renderEmptyBrowsePreview(): void {
    const ctx: SearchHitRenderContext = {
      currentCommentrayPath: mutable.commentrayPathLabel,
      currentSourcePath: filePathLabel,
    };
    if (scope === "full") {
      const sp = filePathLabel.trim();
      if (sp.length === 0) return;
      const rows: SourceFilePreviewRow[] = [
        { sourcePath: sp, commentrayPath: mutable.commentrayPathLabel.trim() },
      ];
      const hint = emptyBrowsePreviewHint("full", rows.length, rows.length, false);
      searchResults.hidden = false;
      searchResults.innerHTML = emptySearchBrowsePreviewInnerHtml(hint, rows, ctx);
      return;
    }
    const { rows, totalUnique } = uniqueSourceFilePreviewRows(mutable.documentedPairs);
    if (rows.length > 0) {
      const hint = emptyBrowsePreviewHint("commentray-and-paths", rows.length, totalUnique, false);
      searchResults.hidden = false;
      searchResults.innerHTML = emptySearchBrowsePreviewInnerHtml(hint, rows, ctx);
      return;
    }
    const sp = filePathLabel.trim();
    if (sp.length === 0) return;
    const fb: SourceFilePreviewRow[] = [
      { sourcePath: sp, commentrayPath: mutable.commentrayPathLabel.trim() },
    ];
    const hint = emptyBrowsePreviewHint("commentray-and-paths", fb.length, fb.length, true);
    searchResults.hidden = false;
    searchResults.innerHTML = emptySearchBrowsePreviewInnerHtml(hint, fb, ctx);
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

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
  });
  searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown") return;
    if (tokenizeQuery(searchInput.value).length > 0) return;
    renderEmptyBrowsePreview();
    e.preventDefault();
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

function wireWrapToggle(
  storageWrap: string,
  codePane: HTMLElement,
  wrapCb: HTMLInputElement,
): void {
  const wrap = readWebStorageItem(localStorage, storageWrap) === "1";
  wrapCb.checked = wrap;
  if (wrap) codePane.classList.add("wrap");

  wrapCb.addEventListener("change", () => {
    if (wrapCb.checked) {
      codePane.classList.add("wrap");
      writeWebStorageItem(localStorage, storageWrap, "1");
    } else {
      codePane.classList.remove("wrap");
      writeWebStorageItem(localStorage, storageWrap, "0");
    }
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
        out.push({
          id: o.id,
          commentrayLine: o.commentrayLine,
          sourceStart: o.sourceStart,
          sourceEnd: o.sourceEnd,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function probeCodeLine1FromViewport(codePane: HTMLElement): number {
  const y = codePane.getBoundingClientRect().top + 2;
  const rows = codePane.querySelectorAll<HTMLElement>('[id^="code-line-"]');
  for (const el of rows) {
    const r = el.getBoundingClientRect();
    if (r.bottom > y) {
      const m = /^code-line-(\d+)$/.exec(el.id);
      if (m) return Number(m[1]) + 1;
      return 1;
    }
  }
  return rows.length > 0 ? rows.length : 1;
}

function probeCommentrayLine0FromDoc(docPane: HTMLElement): number {
  const y = docPane.getBoundingClientRect().top + 2;
  const anchors = docPane.querySelectorAll<HTMLElement>(".commentray-block-anchor");
  let best = 0;
  for (const a of anchors) {
    const lineAttr = a.getAttribute("data-commentray-line");
    if (lineAttr === null || lineAttr === "") continue;
    if (a.getBoundingClientRect().top <= y + 1) best = Number(lineAttr);
    else break;
  }
  return best;
}

type SyncPane = "none" | "code" | "doc";

function wireBidirectionalScroll(
  codePane: HTMLElement,
  docPane: HTMLElement,
  syncFromCode: () => void,
  syncFromDoc: () => void,
): void {
  let syncing: SyncPane = "none";

  codePane.addEventListener(
    "scroll",
    () => {
      if (syncing === "doc") return;
      syncing = "code";
      syncFromCode();
      syncing = "none";
    },
    { passive: true },
  );

  docPane.addEventListener(
    "scroll",
    () => {
      if (syncing === "code") return;
      syncing = "doc";
      syncFromDoc();
      syncing = "none";
    },
    { passive: true },
  );
}

/** Index-backed scroll sync when `data-scroll-block-links-b64` is present; else see proportional fallback. */
function wireBlockAwareScrollSync(
  codePane: HTMLElement,
  docPane: HTMLElement,
  getLinks: () => BlockScrollLink[],
): void {
  wireBidirectionalScroll(
    codePane,
    docPane,
    () => {
      const links = getLinks();
      const line1 = probeCodeLine1FromViewport(codePane);
      const mdLine0 = pickCommentrayLineForSourceScroll(links, line1);
      if (mdLine0 === null) {
        docPane.scrollTop = mirroredScrollTop(
          codePane.scrollTop,
          codePane.scrollHeight,
          codePane.clientHeight,
          docPane.scrollHeight,
          docPane.clientHeight,
        );
      } else {
        const anchor = docPane.querySelector(`[data-commentray-line="${String(mdLine0)}"]`);
        if (anchor instanceof HTMLElement) {
          const top =
            anchor.getBoundingClientRect().top -
            docPane.getBoundingClientRect().top +
            docPane.scrollTop;
          docPane.scrollTop = Math.max(0, top - 2);
        } else {
          docPane.scrollTop = mirroredScrollTop(
            codePane.scrollTop,
            codePane.scrollHeight,
            codePane.clientHeight,
            docPane.scrollHeight,
            docPane.clientHeight,
          );
        }
      }
    },
    () => {
      const links = getLinks();
      const mdLine0 = probeCommentrayLine0FromDoc(docPane);
      const src0 = pickSourceLine0ForCommentrayScroll(links, mdLine0);
      if (src0 === null) {
        codePane.scrollTop = mirroredScrollTop(
          docPane.scrollTop,
          docPane.scrollHeight,
          docPane.clientHeight,
          codePane.scrollHeight,
          codePane.clientHeight,
        );
      } else {
        const el = document.getElementById(`code-line-${String(src0)}`);
        if (el) {
          const top =
            el.getBoundingClientRect().top -
            codePane.getBoundingClientRect().top +
            codePane.scrollTop;
          codePane.scrollTop = Math.max(0, top - 2);
        } else {
          codePane.scrollTop = mirroredScrollTop(
            docPane.scrollTop,
            docPane.scrollHeight,
            docPane.clientHeight,
            codePane.scrollHeight,
            codePane.clientHeight,
          );
        }
      }
    },
  );
}

/** Proportional scroll sync when there is no index-backed block map (GitHub Pages default). */
function wireProportionalScrollSync(codePane: HTMLElement, docPane: HTMLElement): void {
  wireBidirectionalScroll(
    codePane,
    docPane,
    () => {
      docPane.scrollTop = mirroredScrollTop(
        codePane.scrollTop,
        codePane.scrollHeight,
        codePane.clientHeight,
        docPane.scrollHeight,
        docPane.clientHeight,
      );
    },
    () => {
      codePane.scrollTop = mirroredScrollTop(
        docPane.scrollTop,
        docPane.scrollHeight,
        docPane.clientHeight,
        codePane.scrollHeight,
        codePane.clientHeight,
      );
    },
  );
}

function centerYInViewport(el: Element): number {
  const r = el.getBoundingClientRect();
  return (r.top + r.bottom) / 2;
}

/**
 * Vertical center of the highlighted source text for gutter rays. Using the outer `.code-line`
 * row includes the line-number column and extra vertical slack from the grid; Highlight.js
 * padding on `pre`/`code` can shift the glyph center above the row’s geometric center — anchoring
 * to `pre code` tracks the visible passage.
 */
function codeLineHighlightCenterYViewport(lineEl: HTMLElement): number {
  const code =
    lineEl.querySelector<HTMLElement>("pre code.hljs") ?? lineEl.querySelector<HTMLElement>("pre code");
  if (code) return centerYInViewport(code);
  const pre = lineEl.querySelector<HTMLElement>("pre");
  if (pre) return centerYInViewport(pre);
  return centerYInViewport(lineEl);
}

function commentaryBandEndYViewport(
  docScrollEl: HTMLElement,
  next: BlockScrollLink | undefined,
  docTop: HTMLElement,
): number {
  if (next) {
    const nextEl = document.getElementById(`commentray-block-${next.id}`);
    return nextEl ? nextEl.getBoundingClientRect().top - 3 : centerYInViewport(docTop);
  }
  const dr = docScrollEl.getBoundingClientRect();
  let bottom = dr.bottom - 4;
  const lastKid = docScrollEl.children[docScrollEl.children.length - 1];
  if (lastKid) bottom = Math.min(bottom, lastKid.getBoundingClientRect().bottom - 4);
  return bottom;
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
): void {
  const links = getLinks();
  const sorted = sortBlockLinksBySource(links);
  const gutterRect = gutter.getBoundingClientRect();
  const w = gutterRect.width;
  const h = gutterRect.height;
  if (w <= 0 || h <= 0 || sorted.length === 0) {
    svg.replaceChildren();
    return;
  }

  const activeId = activeBlockIdForViewport(links, probeTopSourceLine1Based());
  svg.setAttribute("viewBox", `0 0 ${String(w)} ${String(h)}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const parts: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const link = sorted[i];
    if (!link) continue;
    const next = sorted[i + 1];

    const i0 = codeLineDomIndex0(link.sourceStart);
    const i1 = codeLineDomIndex0(link.sourceEnd);
    const codeTop = document.getElementById(`code-line-${String(i0)}`);
    const codeBot = document.getElementById(`code-line-${String(i1)}`);
    const docTop = document.getElementById(`commentray-block-${link.id}`);
    if (!codeTop || !codeBot || !docTop) continue;

    const docEndYViewport = commentaryBandEndYViewport(docScrollEl, next, docTop);
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
 * index-backed blocks). Emphasizes the block aligned with the current source viewport; clamps
 * off-screen endpoints so readers see which way to scroll.
 */
function wireBlockRayConnectors(args: {
  gutter: HTMLElement;
  codePane: HTMLElement;
  docScrollEl: HTMLElement;
  getLinks: () => BlockScrollLink[];
  probeTopSourceLine1Based: () => number;
}): void {
  const { gutter, codePane, docScrollEl, getLinks, probeTopSourceLine1Based } = args;

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
      drawBlockRaysIntoSvg(svg, gutter, docScrollEl, getLinks, probeTopSourceLine1Based);
    });
  }

  subscribeBlockRayRedraw(gutter, codePane, docScrollEl, scheduleDraw);

  scheduleDraw();
  /** First paint can report gutter height 0 before flex layout settles; redraw after layout. */
  globalThis.requestAnimationFrame(() => {
    scheduleDraw();
    globalThis.requestAnimationFrame(scheduleDraw);
  });
}

type DocumentedPairNav = {
  sourcePath: string;
  commentrayPath: string;
  sourceOnGithub: string;
  commentrayOnGithub: string;
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
  return (
    typeof o.sourcePath === "string" &&
    typeof o.commentrayPath === "string" &&
    typeof o.sourceOnGithub === "string" &&
    typeof o.commentrayOnGithub === "string" &&
    (o.staticBrowseUrl === undefined || typeof o.staticBrowseUrl === "string")
  );
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
        const title = escapeHtmlText(`${pr.sourcePath} — open companion on GitHub`);
        lis.push(
          `<li><div class="tree-file">` +
            `<a class="tree-file-link" href="${escapeHtmlText(pr.commentrayOnGithub)}" target="_blank" rel="noopener noreferrer" title="${title}">${label}</a>` +
            `</div></li>`,
        );
      }
    }
  }
  return `<ul>${lis.join("")}</ul>`;
}

function renderDocumentedPairsIntoHost(treeHost: HTMLElement, pairs: DocumentedPairNav[]): void {
  if (pairs.length === 0) {
    treeHost.innerHTML =
      '<p class="nav-rail__doc-hub-hint" role="status">No documented pairs in this export.</p>';
    return;
  }
  const root: TrieNode = { children: new Map(), pairs: [] };
  for (const p of pairs) insertSourcePathTrie(root, p);
  treeHost.innerHTML = renderDocumentedTreeHtml(root);
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

function wireDocumentedFilesTree(): void {
  const hub = document.getElementById("documented-files-hub");
  const treeHost = document.getElementById("documented-files-tree");
  const shell = document.getElementById("shell");
  if (!(hub instanceof HTMLDetailsElement) || !(treeHost instanceof HTMLElement)) {
    return;
  }

  const treeMount: HTMLElement = treeHost;

  const jsonUrl = hub.getAttribute("data-nav-json-url")?.trim() ?? "";
  const embeddedB64 = shell?.getAttribute("data-documented-pairs-b64")?.trim() ?? "";
  if (jsonUrl.length === 0 && embeddedB64.length === 0) return;

  const ensureLoaded = loadDocumentedPairs(jsonUrl, embeddedB64);

  async function hydrateTree(): Promise<void> {
    try {
      const pairs = await ensureLoaded();
      renderDocumentedPairsIntoHost(treeMount, pairs);
    } catch {
      treeMount.innerHTML =
        '<p class="nav-rail__doc-hub-hint" role="alert">Could not load the file list.</p>';
    }
  }

  hub.addEventListener("toggle", () => {
    if (!hub.open) return;
    void hydrateTree();
  });
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

function wireStretchLayoutChrome(codePane: HTMLElement): void {
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  if (wrapCb) {
    wireWrapToggle(STORAGE_WRAP_LINES, codePane, wrapCb);
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

function wireDualPaneNavSearchFetch(
  navSearchUrl: string,
  indexState: DualPaneSearchIndexState,
  mutable: MutableSearchFields,
  rebuildSearcher: () => void,
  searchInput: HTMLInputElement,
): void {
  if (navSearchUrl.length === 0) return;
  void (async () => {
    try {
      const res = await fetch(navSearchUrl, { credentials: "same-origin" });
      if (!res.ok) return;
      const doc = (await res.json()) as NavJsonDoc;
      const fetched = pairsFromJsonArray(doc.documentedPairs);
      if (fetched.length > 0) {
        indexState.documentedPairs = fetched;
        mutable.documentedPairs = fetched;
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
}): void {
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
  } = args;
  if (multiPayload) {
    wireBlockAwareScrollSync(codePane, docScrollEl, () => scrollLinksRef.current);
    const angleSel = document.getElementById("angle-select") as HTMLSelectElement | null;
    if (angleSel && docBody) {
      angleSel.addEventListener("change", () => {
        const a = multiPayload.angles.find((x) => x.id === angleSel.value);
        if (!a) return;
        docBody.innerHTML = decodeBase64Utf8(a.docInnerHtmlB64);
        mutable.rawMd = decodeBase64Utf8(a.rawMdB64);
        mutable.mdLines = mutable.rawMd.split("\n");
        mutable.commentrayPathLabel = a.commentrayPathForSearch;
        rebuildSearcher();
        scrollLinksRef.current = parseScrollBlockLinksFromShell(a.scrollBlockLinksB64);
        shell.setAttribute("data-scroll-block-links-b64", a.scrollBlockLinksB64);
        shell.setAttribute("data-search-commentray-path", a.commentrayPathForSearch);
        const gh = document.getElementById("toolbar-commentray-github");
        if (gh instanceof HTMLAnchorElement && a.commentrayOnGithubUrl?.trim()) {
          gh.href = a.commentrayOnGithubUrl.trim();
        }
        searchInput.value = "";
        searchResults.innerHTML = "";
        searchResults.hidden = true;
      });
    }
    return;
  }
  if (scrollLinksRef.current.length > 0) {
    wireBlockAwareScrollSync(codePane, docScrollEl, () => scrollLinksRef.current);
    return;
  }
  wireProportionalScrollSync(codePane, docScrollEl);
}

function wireDualPaneCommentrayLocationHash(
  docScrollEl: HTMLElement,
  mdLineCount: () => number,
): void {
  function applyCommentrayLocationHash(): void {
    const m = /^commentray-md-line-(\d+)$/.exec(globalThis.location.hash.slice(1));
    if (!m?.[1]) return;
    const line0 = Number.parseInt(m[1], 10);
    if (!Number.isFinite(line0)) return;
    scrollDocToMarkdownLine0(docScrollEl, line0, mdLineCount());
  }
  globalThis.addEventListener("hashchange", applyCommentrayLocationHash);
  globalThis.requestAnimationFrame(() => {
    globalThis.requestAnimationFrame(applyCommentrayLocationHash);
  });
}

function wireDualPaneCodeBrowser(shell: HTMLElement, codePane: HTMLElement): void {
  const dom = readDualPaneDomBundle();
  if (!dom) return;

  const { docBody, docScrollEl, gutter, wrapCb, searchInput, searchClear, searchResults } = dom;

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

  wireSearchUi({
    scope,
    filePathLabel,
    mutable,
    rawCode,
    searchInput,
    searchClear,
    searchResults,
    docScrollEl,
  });

  const navSearchUrl = shell.getAttribute("data-nav-search-json-url")?.trim() ?? "";
  wireDualPaneNavSearchFetch(navSearchUrl, indexState, mutable, rebuildSearcher, searchInput);

  const pct0 = parseFloat(readWebStorageItem(localStorage, STORAGE_SPLIT_PCT) || "50");
  const pct = clamp(Number.isFinite(pct0) ? pct0 : 50, 15, 85);
  codePane.style.flex = `0 0 ${pct}%`;

  wireWrapToggle(STORAGE_WRAP_LINES, codePane, wrapCb);
  wireSplitter(STORAGE_SPLIT_PCT, shell, codePane, gutter, pct);

  const multiScript = document.getElementById("commentray-multi-angle-b64");
  const multiPayload = parseMultiAnglePayload(multiScript);
  wireDualPaneMultiAngleAndScroll({
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
  });

  if (scrollLinksRef.current.length > 0) {
    wireBlockRayConnectors({
      gutter,
      codePane,
      docScrollEl,
      getLinks: () => scrollLinksRef.current,
      probeTopSourceLine1Based: () => probeCodeLine1FromViewport(codePane),
    });
  }

  wireDualPaneCommentrayLocationHash(docScrollEl, () => mutable.mdLines.length);
}

function main(): void {
  wireDocumentedFilesTree();

  const shell = document.getElementById("shell");
  const codePane = document.getElementById("code-pane");
  if (!shell || !codePane) {
    return;
  }

  const layout = shell.getAttribute("data-layout") || "dual";
  if (layout === "stretch") {
    wireStretchLayoutChrome(codePane);
    return;
  }

  wireDualPaneCodeBrowser(shell, codePane);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
