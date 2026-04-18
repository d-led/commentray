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
import { findOrderedTokenSpans, lineAtIndex, offsetToLineIndex } from "./code-browser-search.js";

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

function searchResultsInnerHtml(scope: SearchScope, combined: Hit[]): string {
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
    buf.push(
      `<button type="button" class="hit" data-kind="${h.kind}" data-line="${String(h.line)}">` +
        `<span class="meta">${label} <span class="src-tag">(${tag})</span></span>` +
        `<div class="snippet">${escapeHtmlText(snippet(h.text, 200))}</div></button>`,
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

type SearchUiContext = {
  scope: SearchScope;
  filePathLabel: string;
  commentrayPathLabel: string;
  rawCode: string;
  rawMd: string;
  mdLines: string[];
  searcher: ReturnType<typeof SearcherFactory.createDefaultSearcher<Row, string>>;
  searchInput: HTMLInputElement;
  searchClear: HTMLElement;
  searchResults: HTMLElement;
  docPane: HTMLElement;
};

function wireSearchUi(ctx: SearchUiContext): void {
  const {
    scope,
    filePathLabel,
    commentrayPathLabel,
    rawCode,
    rawMd,
    mdLines,
    searcher,
    searchInput,
    searchClear,
    searchResults,
    docPane,
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
      commentrayPathLabel,
      rawCode,
      rawMd,
      searcher,
      queryRaw: searchInput.value,
      tokens,
    });
    searchResults.hidden = false;
    searchResults.innerHTML = searchResultsInnerHtml(scope, combined);
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
      docPane.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const total = mdLines.length;
      if (total <= 0) return;
      const ratio = line / Math.max(1, total - 1);
      const maxScroll = docPane.scrollHeight - docPane.clientHeight;
      docPane.scrollTo({ top: ratio * Math.max(0, maxScroll), behavior: "smooth" });
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
  const wrap = localStorage.getItem(storageWrap) === "1";
  wrapCb.checked = wrap;
  if (wrap) codePane.classList.add("wrap");

  wrapCb.addEventListener("change", () => {
    if (wrapCb.checked) {
      codePane.classList.add("wrap");
      localStorage.setItem(storageWrap, "1");
    } else {
      codePane.classList.remove("wrap");
      localStorage.setItem(storageWrap, "0");
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
  links: BlockScrollLink[],
): void {
  wireBidirectionalScroll(
    codePane,
    docPane,
    () => {
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
    localStorage.setItem(storageSplit, String(lastPct));
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

function main(): void {
  const storageSplit = "commentray.codeCommentrayStatic.splitPct";
  const storageWrap = "commentray.codeCommentrayStatic.wrap";
  const shell = document.getElementById("shell");
  const codePane = document.getElementById("code-pane");
  const docPane = document.getElementById("doc-pane");
  const gutter = document.getElementById("gutter");
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  const searchInput = document.getElementById("search-q") as HTMLInputElement | null;
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");

  if (
    !shell ||
    !codePane ||
    !docPane ||
    !gutter ||
    !wrapCb ||
    !searchInput ||
    !searchClear ||
    !searchResults
  ) {
    return;
  }

  const { rawCodeB64, rawMdB64 } = readEmbeddedRawB64Strings(shell, codePane);
  const rawCode = decodeBase64Utf8(rawCodeB64);
  const rawMd = decodeBase64Utf8(rawMdB64);
  const scrollLinks = parseScrollBlockLinksFromShell(
    shell.getAttribute("data-scroll-block-links-b64") || "",
  );
  const { scope, filePathLabel, commentrayPathLabel } = readSearchScopeFromShell(shell);
  const mdLines = rawMd.split("\n");
  const lineRows = buildIndexedSearchRows(
    scope,
    rawCode,
    rawMd,
    filePathLabel,
    commentrayPathLabel,
  );
  const searcher = indexSearchLineRows(lineRows);

  wireSearchUi({
    scope,
    filePathLabel,
    commentrayPathLabel,
    rawCode,
    rawMd,
    mdLines,
    searcher,
    searchInput,
    searchClear,
    searchResults,
    docPane,
  });

  const pct0 = parseFloat(localStorage.getItem(storageSplit) || "50");
  const pct = clamp(Number.isFinite(pct0) ? pct0 : 50, 15, 85);
  codePane.style.flex = `0 0 ${pct}%`;

  wireWrapToggle(storageWrap, codePane, wrapCb);
  wireSplitter(storageSplit, shell, codePane, gutter, pct);
  if (scrollLinks.length > 0) {
    wireBlockAwareScrollSync(codePane, docPane, scrollLinks);
  } else {
    wireProportionalScrollSync(codePane, docPane);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
