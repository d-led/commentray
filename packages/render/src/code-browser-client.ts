import {
  FuzzySearcher,
  PrefixSearcher,
  Query,
  SearcherFactory,
  SubstringSearcher,
} from "@m31coding/fuzzy-search";
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
} from "./code-browser-search.js";
import { readWebStorageItem, writeWebStorageItem } from "./code-browser-web-storage.js";

type HitKind = "code" | "md" | "path";

type Row = { kind: HitKind; line: number; text: string };

type Hit = {
  kind: HitKind;
  line: number;
  text: string;
  score: number;
  source: "ordered" | "fuzzy";
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
      r.kind === "path" ? `path:${String(r.line)}:${r.text.slice(0, 64)}` : `${r.kind}:${r.line}`;
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
};

function computeMergedSearchHits(input: MergedSearchHitInput): Hit[] {
  const { scope, filePathLabel, commentrayPathLabel, rawCode, rawMd, searcher, queryRaw, tokens } =
    input;
  const pathBlob = [filePathLabel, commentrayPathLabel]
    .filter((s) => s.trim().length > 0)
    .join("\n");
  const orderedCode =
    scope === "commentray-and-paths" ? [] : buildOrderedHits(rawCode, "code", tokens);
  const orderedPath =
    scope === "commentray-and-paths" && pathBlob ? buildOrderedHits(pathBlob, "path", tokens) : [];
  const orderedMd = buildOrderedHits(rawMd, "md", tokens);
  const fuzzyHits = buildFuzzyHits(searcher, queryRaw, 60);
  return mergeHits([...orderedCode, ...orderedPath, ...orderedMd, ...fuzzyHits], 80);
}

function searchResultsInnerHtml(scope: SearchScope, combined: Hit[], tokens: string[]): string {
  if (combined.length === 0) {
    return '<div class="hint">No matches. Try fewer tokens or looser spelling (fuzzy matches per line).</div>';
  }
  const hintIntro =
    scope === "commentray-and-paths"
      ? "Paths + commentray only (no code-body indexing): ordered tokens and per-line fuzzy ranking."
      : "Whole source: whitespace tokens in order (may span lines). Per-line fuzzy ranking for typos.";
  const buf: string[] = [];
  buf.push(`<div class="hint">${hintIntro} ${combined.length} hit(s).</div>`);
  for (const h of combined) {
    const label =
      h.kind === "code"
        ? `Code L${h.line + 1}`
        : h.kind === "path"
          ? `Path L${h.line + 1}`
          : `Commentray L${h.line + 1}`;
    const tag = h.source === "ordered" ? "ordered" : "fuzzy";
    const snippetHtml = escapeHtmlHighlightingSearchTokens(snippet(h.text, 320), tokens);
    buf.push(
      `<button type="button" class="hit" data-kind="${h.kind}" data-line="${String(h.line)}">` +
        `<span class="meta">${label} <span class="src-tag">(${tag})</span></span>` +
        `<div class="snippet">${snippetHtml}</div></button>`,
    );
  }
  return buf.join("");
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
    (e) => `${e.kind}:${e.kind === "path" ? e.text : e.line}`,
    (e) => [e.text],
  );
  return searcher;
}

type MutableSearchFields = {
  rawMd: string;
  mdLines: string[];
  commentrayPathLabel: string;
  searcher: ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>>;
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
    });
    searchResults.hidden = false;
    searchResults.innerHTML = searchResultsInnerHtml(scope, combined, tokens);
  }

  searchResults.addEventListener("click", (ev: MouseEvent) => {
    let t = ev.target as HTMLElement | null;
    while (t && t !== searchResults && (!t.classList || !t.classList.contains("hit"))) {
      t = t.parentElement;
    }
    if (!t || !t.classList || !t.classList.contains("hit")) return;
    const kind = t.getAttribute("data-kind");
    const line = parseInt(t.getAttribute("data-line") || "0", 10);
    if (kind === "code") {
      const el = document.getElementById(`code-line-${String(line)}`);
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (kind === "path") {
      docScrollEl.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const total = mutable.mdLines.length;
      if (total <= 0) return;
      const ratio = line / Math.max(1, total - 1);
      const maxScroll = docScrollEl.scrollHeight - docScrollEl.clientHeight;
      docScrollEl.scrollTo({ top: ratio * Math.max(0, maxScroll), behavior: "smooth" });
    }
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
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

type DocumentedPairNav = {
  sourcePath: string;
  commentrayPath: string;
  sourceOnGithub: string;
  commentrayOnGithub: string;
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
    typeof o.commentrayOnGithub === "string"
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
      for (const pr of ch.pairs) {
        lis.push(
          `<li><div class="tree-file">` +
            `<span class="tree-file-name">${escapeHtmlText(pr.sourcePath)}</span>` +
            `<span class="tree-file-links">` +
            `<a href="${escapeHtmlText(pr.sourceOnGithub)}" target="_blank" rel="noopener noreferrer">source</a>` +
            `<a href="${escapeHtmlText(pr.commentrayOnGithub)}" target="_blank" rel="noopener noreferrer">commentray</a>` +
            `</span></div></li>`,
        );
      }
    }
  }
  return `<ul>${lis.join("")}</ul>`;
}

function setDocumentedPanelOpen(btn: HTMLButtonElement, panel: HTMLElement, open: boolean): void {
  panel.hidden = !open;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function renderDocumentedPairsIntoHost(treeHost: HTMLElement, pairs: DocumentedPairNav[]): void {
  if (pairs.length === 0) {
    treeHost.innerHTML =
      '<p class="documented-files-panel__hint">No <code class="documented-files-panel__code">documentedPairs</code> in this export (build with a GitHub repo URL).</p>';
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
  const btn = document.getElementById("documented-files-toggle");
  const panel = document.getElementById("documented-files-panel");
  const treeHost = document.getElementById("documented-files-tree");
  const shell = document.getElementById("shell");
  if (
    !(btn instanceof HTMLButtonElement) ||
    !(panel instanceof HTMLElement) ||
    !(treeHost instanceof HTMLElement)
  ) {
    return;
  }

  const panelEl: HTMLElement = panel;
  const treeMount: HTMLElement = treeHost;

  const jsonUrl = btn.getAttribute("data-nav-json-url")?.trim() ?? "";
  const embeddedB64 = shell?.getAttribute("data-documented-pairs-b64")?.trim() ?? "";
  if (jsonUrl.length === 0 && embeddedB64.length === 0) return;

  const ensureLoaded = loadDocumentedPairs(jsonUrl, embeddedB64);

  async function hydrateTree(): Promise<void> {
    try {
      const pairs = await ensureLoaded();
      renderDocumentedPairsIntoHost(treeMount, pairs);
    } catch {
      treeMount.innerHTML =
        '<p class="documented-files-panel__hint">Could not load the file list. Check the browser network tab.</p>';
    }
  }

  setDocumentedPanelOpen(btn, panelEl, true);
  void hydrateTree();

  btn.addEventListener("click", () => {
    const next = panelEl.hidden !== false;
    setDocumentedPanelOpen(btn, panelEl, next);
    if (!next) return;
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

function wireDualPaneCodeBrowser(shell: HTMLElement, codePane: HTMLElement): void {
  const docPane = document.getElementById("doc-pane");
  const gutter = document.getElementById("gutter");
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  const searchInput = document.getElementById("search-q") as HTMLInputElement | null;
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");

  if (!docPane || !gutter || !wrapCb || !searchInput || !searchClear || !searchResults) {
    return;
  }

  const docBody = document.getElementById("doc-pane-body");
  const docScrollEl = docBody instanceof HTMLElement ? docBody : docPane;

  const { rawCodeB64, rawMdB64 } = readEmbeddedRawB64Strings(shell, codePane);
  const rawCode = decodeBase64Utf8(rawCodeB64);
  const rawMd = decodeBase64Utf8(rawMdB64);
  const scrollLinks = parseScrollBlockLinksFromShell(
    shell.getAttribute("data-scroll-block-links-b64") || "",
  );
  const { scope, filePathLabel, commentrayPathLabel } = readSearchScopeFromShell(shell);
  const lineRows = buildIndexedSearchRows(
    scope,
    rawCode,
    rawMd,
    filePathLabel,
    commentrayPathLabel,
  );
  const mutable: MutableSearchFields = {
    rawMd,
    mdLines: rawMd.split("\n"),
    commentrayPathLabel,
    searcher: indexSearchLineRows(lineRows),
  };

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

  const pct0 = parseFloat(readWebStorageItem(localStorage, STORAGE_SPLIT_PCT) || "50");
  const pct = clamp(Number.isFinite(pct0) ? pct0 : 50, 15, 85);
  codePane.style.flex = `0 0 ${pct}%`;

  wireWrapToggle(STORAGE_WRAP_LINES, codePane, wrapCb);
  wireSplitter(STORAGE_SPLIT_PCT, shell, codePane, gutter, pct);

  const multiScript = document.getElementById("commentray-multi-angle-b64");
  const multiPayload = parseMultiAnglePayload(multiScript);
  let activeLinks: BlockScrollLink[] = scrollLinks;

  if (multiPayload) {
    wireBlockAwareScrollSync(codePane, docScrollEl, () => activeLinks);
    const angleSel = document.getElementById("angle-select") as HTMLSelectElement | null;
    if (angleSel && docBody) {
      angleSel.addEventListener("change", () => {
        const a = multiPayload.angles.find((x) => x.id === angleSel.value);
        if (!a) return;
        docBody.innerHTML = decodeBase64Utf8(a.docInnerHtmlB64);
        mutable.rawMd = decodeBase64Utf8(a.rawMdB64);
        mutable.mdLines = mutable.rawMd.split("\n");
        mutable.commentrayPathLabel = a.commentrayPathForSearch;
        mutable.searcher = indexSearchLineRows(
          buildIndexedSearchRows(
            scope,
            rawCode,
            mutable.rawMd,
            filePathLabel,
            mutable.commentrayPathLabel,
          ),
        );
        activeLinks = parseScrollBlockLinksFromShell(a.scrollBlockLinksB64);
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
  } else if (scrollLinks.length > 0) {
    wireBlockAwareScrollSync(codePane, docScrollEl, () => scrollLinks);
  } else {
    wireProportionalScrollSync(codePane, docScrollEl);
  }
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
