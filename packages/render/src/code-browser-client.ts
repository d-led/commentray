import {
  FuzzySearcher,
  PrefixSearcher,
  Query,
  SearcherFactory,
  SubstringSearcher,
} from "@m31coding/fuzzy-search";
import { findOrderedTokenSpans, lineAtIndex, offsetToLineIndex } from "./code-browser-search.js";

type HitKind = "code" | "md";

type Row = { kind: HitKind; line: number; text: string };

type Hit = { kind: HitKind; line: number; text: string; score: number; source: "ordered" | "fuzzy" };

function tokenizeQuery(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function decodeB64(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try {
      return atob(b64);
    } catch {
      return "";
    }
  }
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
    const key = `${r.kind}:${r.line}`;
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

type SearchUiContext = {
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
  const { rawCode, rawMd, mdLines, searcher, searchInput, searchClear, searchResults, docPane } = ctx;

  function runSearch(): void {
    const tokens = tokenizeQuery(searchInput.value);
    if (tokens.length === 0) {
      searchResults.hidden = true;
      searchResults.innerHTML = "";
      return;
    }

    const orderedCode = buildOrderedHits(rawCode, "code", tokens);
    const orderedMd = buildOrderedHits(rawMd, "md", tokens);
    const fuzzyHits = buildFuzzyHits(searcher, searchInput.value, 60);
    const combined = mergeHits([...orderedCode, ...orderedMd, ...fuzzyHits], 80);

    searchResults.hidden = false;
    if (combined.length === 0) {
      searchResults.innerHTML =
        '<div class="hint">No matches. Try fewer tokens or looser spelling (fuzzy matches per line).</div>';
      return;
    }
    const buf: string[] = [];
    buf.push(
      `<div class="hint">Whole source: whitespace tokens in order (may span lines). Per-line fuzzy ranking for typos. ${combined.length} hit(s).</div>`,
    );
    for (const h of combined) {
      const label = h.kind === "code" ? `Code L${h.line + 1}` : `Commentary L${h.line + 1}`;
      const tag = h.source === "ordered" ? "ordered" : "fuzzy";
      buf.push(
        `<button type="button" class="hit" data-kind="${h.kind}" data-line="${String(h.line)}">` +
          `<span class="meta">${label} <span class="src-tag">(${tag})</span></span>` +
          `<div class="snippet">${escapeHtmlText(snippet(h.text, 200))}</div></button>`,
      );
    }
    searchResults.innerHTML = buf.join("");
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
    } else {
      const total = mdLines.length;
      if (total <= 0) return;
      const ratio = line / Math.max(1, total - 1);
      const maxScroll = docPane.scrollHeight - docPane.clientHeight;
      docPane.scrollTo({ top: ratio * Math.max(0, maxScroll), behavior: "smooth" });
    }
  });

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
  });
  searchClear.addEventListener("click", () => {
    clearTimeout(debounceTimer);
    searchInput.value = "";
    searchResults.innerHTML = "";
    searchResults.hidden = true;
  });
}

function wireWrapToggle(storageWrap: string, codePane: HTMLElement, wrapCb: HTMLInputElement): void {
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
  const storageSplit = "commentary.codeCommentaryStatic.splitPct";
  const storageWrap = "commentary.codeCommentaryStatic.wrap";
  const shell = document.getElementById("shell");
  const codePane = document.getElementById("code-pane");
  const docPane = document.getElementById("doc-pane");
  const gutter = document.getElementById("gutter");
  const wrapCb = document.getElementById("wrap-lines") as HTMLInputElement | null;
  const searchInput = document.getElementById("search-q") as HTMLInputElement | null;
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");

  if (!shell || !codePane || !docPane || !gutter || !wrapCb || !searchInput || !searchClear || !searchResults) {
    return;
  }

  const rawCode = decodeB64(codePane.getAttribute("data-raw-code-b64") || "");
  const rawMd = decodeB64(codePane.getAttribute("data-raw-md-b64") || "");
  const mdLines = rawMd.split("\n");
  const codeLines = rawCode.split("\n");

  const lineRows: Row[] = [
    ...codeLines.map((text, line) => ({ kind: "code" as const, line, text })),
    ...mdLines.map((text, line) => ({ kind: "md" as const, line, text })),
  ];
  const searcher = SearcherFactory.createDefaultSearcher<Row, string>();
  searcher.indexEntities(lineRows, (e) => `${e.kind}:${e.line}`, (e) => [e.text]);

  wireSearchUi({
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
