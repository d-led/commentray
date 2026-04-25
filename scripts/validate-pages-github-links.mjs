#!/usr/bin/env node
/**
 * Post-`npm run pages:build` checks for `_site/`:
 * - Optional GitHub blob URLs match `https://github.com/<owner>/<repo>/blob/<branch>/…` (no doubled `/blob/`).
 * - `#shell` carries `data-commentray-pair-browse-href` (same-site `./browse/<slug>.html` or GitHub blob) and resolves without `/browse/browse/` stacking.
 *
 * Optional live check (network): `COMMENTRAY_VALIDATE_PAGES_LIVE=1` sends HEAD to the first GitHub blob URL found in the hub index.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const GITHUB_BLOB_RE =
  /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/blob\/(?<branch>[^/]+)\/(?<path>.+)$/;

const BROWSE_HTML_RE = /^\.\/browse\/[^/]+\.html$/;

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const siteDir = join(repoRoot, "_site");
const indexPath = join(siteDir, "index.html");
const pairNavPath = join(repoRoot, "packages", "render", "dist", "code-browser-pair-nav.js");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/** Reads a `name="…"` attribute from the opening tag of `#shell`. */
function shellAttr(html, attrName) {
  // Do not use a trailing `\b` after `id="shell"`: the closing `"` and the next
  // character are often both non-word (e.g. `"` then space), so `\b` fails and
  // the whole tag match is lost on long static shells.
  const m = /<div\b[^>]*\bid="shell"(?=\s|>)[^>]*>/.exec(html);
  if (!m) return null;
  const tag = m[0];
  const am = new RegExp(`\\b${attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}="([^"]*)"`).exec(
    tag,
  );
  return am?.[1] ?? null;
}

function firstGithubBlobHrefIn(html) {
  const m = /href="(https:\/\/github\.com\/[^"]+\/blob\/[^"]+)"/.exec(html);
  return m?.[1] ?? null;
}

function assertNoBrowseStack(html, label) {
  if (html.includes("/browse/browse/")) {
    fail(`${label}: emitted HTML contains /browse/browse/`);
  }
}

function assertGithubBlobUrl(label, href) {
  if (!href) fail(`${label}: missing href`);
  const m = GITHUB_BLOB_RE.exec(href);
  if (!m?.groups) fail(`${label}: not a GitHub blob URL: ${href}`);
  return m.groups;
}

function assertDocPairHref(label, href) {
  if (href.startsWith("https://github.com/")) {
    assertGithubBlobUrl(`${label} (GitHub fallback)`, href);
    return;
  }
  if (!BROWSE_HTML_RE.test(href)) {
    fail(`${label}: expected ./browse/<slug>.html or GitHub blob, got: ${href}`);
  }
}

function isBrowseRedirectShimHtml(html) {
  const hasRefresh = /<meta\s+http-equiv="refresh"\s+content="0;url=[^"]+\.html"\s*\/?>/i.test(
    html,
  );
  const hasRedirectTitle = /<title>\s*Redirecting…\s*<\/title>/i.test(html);
  const hasReplaceCall = /window\.location\.replace\(/i.test(html);
  return hasRefresh && hasRedirectTitle && hasReplaceCall;
}

async function maybeHeadGithub(url) {
  if (process.env.COMMENTRAY_VALIDATE_PAGES_LIVE !== "1") return;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ac.signal });
    if (res.status < 200 || res.status >= 400) {
      fail(`Live HEAD ${url} → HTTP ${String(res.status)}`);
    }
    console.log(`OK live HEAD ${url} → ${String(res.status)}`);
  } finally {
    clearTimeout(t);
  }
}

async function assertBrowseMatrixResolves(docHubHref, pairNav, origins, pathnames) {
  if (!existsSync(pairNav) || !BROWSE_HTML_RE.test(docHubHref)) return;
  const { resolveStaticBrowseHref } = await import(pathToFileURL(pairNav).href);
  const m = /^\.\/browse\/([^/]+\.html)$/.exec(docHubHref);
  const slug = m[1];
  for (const origin of origins) {
    for (const pathname of pathnames) {
      const resolved = resolveStaticBrowseHref(docHubHref, pathname, origin);
      if (resolved.includes("/browse/browse/")) {
        fail(`resolveStaticBrowseHref(${docHubHref}, ${pathname}, ${origin}) → ${resolved}`);
      }
    }
  }
}

async function validateHubIndex(indexHtml) {
  assertNoBrowseStack(indexHtml, "hub index.html");

  const srcHref = firstGithubBlobHrefIn(indexHtml);
  if (srcHref) {
    assertGithubBlobUrl("hub (first GitHub blob link in HTML)", srcHref);
    await maybeHeadGithub(srcHref);
  }

  const docHubHref = shellAttr(indexHtml, "data-commentray-pair-browse-href");
  if (!docHubHref) {
    fail('hub index.html: missing data-commentray-pair-browse-href on id="shell"');
  }
  assertDocPairHref("hub shell data-commentray-pair-browse-href", docHubHref);

  const origins = ["https://d-led.github.io", "http://127.0.0.1:14173"];
  const slug = /^\.\/browse\/([^/]+\.html)$/.exec(docHubHref)?.[1];
  const pathnames = slug ? [`/browse/${slug}`, `/commentray/browse/${slug}`] : [];
  if (slug) {
    await assertBrowseMatrixResolves(docHubHref, pairNavPath, origins, pathnames);
  }
}

async function validateBrowsePage(name, html) {
  assertNoBrowseStack(html, `browse/${name}`);
  const doc = shellAttr(html, "data-commentray-pair-browse-href");
  if (!doc) {
    if (isBrowseRedirectShimHtml(html)) return;
    fail(`browse/${name}: missing data-commentray-pair-browse-href on #shell`);
  }

  const src = firstGithubBlobHrefIn(html);
  if (src) assertGithubBlobUrl(`browse/${name} (first GitHub blob link)`, src);
  assertDocPairHref(`browse/${name} shell data-commentray-pair-browse-href`, doc);

  if (!existsSync(pairNavPath) || !BROWSE_HTML_RE.test(doc)) return;
  const { resolveStaticBrowseHref } = await import(pathToFileURL(pairNavPath).href);
  const slug = /^\.\/browse\/([^/]+\.html)$/.exec(doc)[1];
  const resolved = resolveStaticBrowseHref(doc, `/browse/${slug}`, "http://127.0.0.1:14173");
  if (resolved.includes("/browse/browse/")) {
    fail(`browse/${name}: resolved pair browse → ${resolved}`);
  }
}

async function validateBrowseHtmlFiles() {
  const browseDir = join(siteDir, "browse");
  if (!existsSync(browseDir)) {
    console.log("No _site/browse/ — skipping browse HTML checks.");
    return;
  }
  const files = readdirSync(browseDir).filter((f) => f.endsWith(".html"));
  for (const name of files) {
    const p = join(browseDir, name);
    const html = readFileSync(p, "utf8");
    await validateBrowsePage(name, html);
  }
}

async function main() {
  if (!existsSync(indexPath)) {
    fail(`Missing ${indexPath} — run npm run pages:build first.`);
  }
  const indexHtml = readFileSync(indexPath, "utf8");
  await validateHubIndex(indexHtml);
  await validateBrowseHtmlFiles();
  console.log("pages:validate — OK (GitHub blob shapes + no /browse/browse/ stacking).");
}

await main();
