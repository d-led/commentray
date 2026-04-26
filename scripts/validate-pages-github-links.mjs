#!/usr/bin/env node
/**
 * Post-`npm run pages:build` checks for `_site/`:
 * - Optional GitHub blob URLs match `https://github.com/<owner>/<repo>/blob/<branch>/…` (no doubled `/blob/`).
 * - `#shell` carries `data-commentray-pair-browse-href` (same-site `./browse/<slug>.html`, `./browse/…/index.html`, or GitHub blob) and resolves without `/browse/browse/` stacking.
 * - `_site/serve.json` sets `renderSingle: true` so local `serve` serves lone `index.html` in humane dirs (not directory listings).
 * - Humane browse redirect shims (`_site/browse/…/index.html`, plus small flat `*.html` redirects) use `canonicalHumaneBrowseRedirectHref` so a no-trailing-slash URL never resolves to `/slug.html` off `/browse/`.
 *
 * Optional live check (network): `COMMENTRAY_VALIDATE_PAGES_LIVE=1` sends HEAD to the first GitHub blob URL found in the hub index.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const GITHUB_BLOB_RE =
  /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/blob\/(?<branch>[^/]+)\/(?<path>.+)$/;

const BROWSE_FLAT_RE = /^\.\/browse\/[^/]+\.html$/;
const BROWSE_INDEXED_RE = /^\.\/browse\/.+\/index\.html$/;

function isHubRelativeBrowseHref(href) {
  return BROWSE_FLAT_RE.test(href) || BROWSE_INDEXED_RE.test(href);
}

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const siteDir = join(repoRoot, "_site");
const indexPath = join(siteDir, "index.html");
const pairNavPath = join(repoRoot, "packages", "render", "dist", "code-browser-pair-nav.js");
const browsePairStaticPath = join(
  repoRoot,
  "packages",
  "code-commentray-static",
  "dist",
  "browse-pair-static-url.js",
);

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
  if (!isHubRelativeBrowseHref(href)) {
    fail(
      `${label}: expected ./browse/<slug>.html, ./browse/…/index.html, or GitHub blob, got: ${href}`,
    );
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
  if (!existsSync(pairNav) || !isHubRelativeBrowseHref(docHubHref)) return;
  const { resolveStaticBrowseHref } = await import(pathToFileURL(pairNav).href);
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
  const flatSlug = /^\.\/browse\/([^/]+\.html)$/.exec(docHubHref)?.[1];
  const indexedInner = /^\.\/browse\/(.+)\/index\.html$/.exec(docHubHref)?.[1];
  const pathnames = flatSlug
    ? [`/browse/${flatSlug}`, `/commentray/browse/${flatSlug}`]
    : indexedInner
      ? [`/browse/${indexedInner}/index.html`, `/commentray/browse/${indexedInner}/index.html`]
      : [];
  if (pathnames.length > 0) {
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

  if (!existsSync(pairNavPath) || !isHubRelativeBrowseHref(doc)) return;
  const { resolveStaticBrowseHref } = await import(pathToFileURL(pairNavPath).href);
  const flatSlug = /^\.\/browse\/([^/]+\.html)$/.exec(doc)?.[1];
  const indexedInner = /^\.\/browse\/(.+)\/index\.html$/.exec(doc)?.[1];
  const pathnameProbe = flatSlug
    ? `/browse/${flatSlug}`
    : indexedInner
      ? `/browse/${indexedInner}/index.html`
      : `/browse/${name}`;
  const resolved = resolveStaticBrowseHref(doc, pathnameProbe, "http://127.0.0.1:14173");
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

function validateServeJsonForLocalStaticHost() {
  const p = join(siteDir, "serve.json");
  if (!existsSync(p)) {
    fail(
      `Missing ${p} — humane browse dirs need serve-handler renderSingle locally (see github-pages-site).`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`${p}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  if (parsed?.renderSingle !== true) {
    fail(`${p}: must set "renderSingle": true for local static preview of humane browse paths.`);
  }
}

/**
 * @param {(aliasRelPath: string, slug: string) => string} canonicalHumaneBrowseRedirectHref
 */
function assertHumaneRedirectShimMatchesCanonical(
  label,
  aliasRelPath,
  html,
  canonicalHumaneBrowseRedirectHref,
) {
  if (!isBrowseRedirectShimHtml(html)) return;
  const m = html.match(/content="0;url=([^"]+)"/i);
  if (!m) fail(`${label}: humane redirect shim missing meta refresh url`);
  const target = m[1].trim();
  const tail = target.split("/").pop() ?? "";
  const slug = tail.replace(/\.html$/i, "");
  if (!slug) fail(`${label}: could not parse slug from redirect target ${JSON.stringify(target)}`);
  const expected = canonicalHumaneBrowseRedirectHref(aliasRelPath, slug);
  if (target !== expected) {
    fail(
      `${label}: redirect must match canonicalHumaneBrowseRedirectHref(${JSON.stringify(aliasRelPath)}, ${JSON.stringify(slug)}); expected ${JSON.stringify(expected)}, got ${JSON.stringify(target)}`,
    );
  }
  const fakeOrigin = "http://127.0.0.1:14173";
  const noSlashDoc = `${fakeOrigin}/browse/${aliasRelPath}`;
  const resolvedPath = new URL(target, noSlashDoc).pathname;
  if (!resolvedPath.startsWith("/browse/")) {
    fail(
      `${label}: resolving ${JSON.stringify(target)} against ${noSlashDoc} → ${resolvedPath} (must stay under /browse/; regressions often land at /${slug}.html)`,
    );
  }
  const depth = resolvedPath.split("/").filter(Boolean).length;
  if (depth < 2) {
    fail(`${label}: resolved path too shallow: ${resolvedPath}`);
  }
}

/**
 * @param {(aliasRelPath: string, slug: string) => string} canonicalHumaneBrowseRedirectHref
 */
function validateHumaneBrowseRedirectShims(canonicalHumaneBrowseRedirectHref) {
  const browseDir = join(siteDir, "browse");
  if (!existsSync(browseDir)) return;

  function walkForIndexHtml(absDir, relUnderBrowse) {
    const out = [];
    for (const ent of readdirSync(absDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const childAbs = join(absDir, ent.name);
      const nextRel = relUnderBrowse ? `${relUnderBrowse}/${ent.name}` : ent.name;
      const idx = join(childAbs, "index.html");
      if (existsSync(idx)) {
        out.push({ indexPath: idx, aliasRelPath: nextRel });
      }
      out.push(...walkForIndexHtml(childAbs, nextRel));
    }
    return out;
  }

  for (const { indexPath: idxPath, aliasRelPath } of walkForIndexHtml(browseDir, "")) {
    const html = readFileSync(idxPath, "utf8");
    const rel = relative(siteDir, idxPath).replaceAll("\\", "/");
    assertHumaneRedirectShimMatchesCanonical(
      rel,
      aliasRelPath,
      html,
      canonicalHumaneBrowseRedirectHref,
    );
  }

  for (const name of readdirSync(browseDir)) {
    if (!name.endsWith(".html")) continue;
    const abs = join(browseDir, name);
    if (!statSync(abs).isFile()) continue;
    const html = readFileSync(abs, "utf8");
    if (!isBrowseRedirectShimHtml(html) || /id="shell"/i.test(html)) continue;
    const aliasRelPath = name.slice(0, -".html".length);
    assertHumaneRedirectShimMatchesCanonical(
      `browse/${name}`,
      aliasRelPath,
      html,
      canonicalHumaneBrowseRedirectHref,
    );
  }
}

async function loadCanonicalHumaneBrowseRedirectHref() {
  if (!existsSync(browsePairStaticPath)) {
    fail(
      `Missing ${browsePairStaticPath} — run npm run build -w @commentray/code-commentray-static before pages:validate.`,
    );
  }
  const mod = await import(pathToFileURL(browsePairStaticPath).href);
  if (typeof mod.canonicalHumaneBrowseRedirectHref !== "function") {
    fail(`${browsePairStaticPath}: missing export canonicalHumaneBrowseRedirectHref`);
  }
  return mod.canonicalHumaneBrowseRedirectHref;
}

async function main() {
  if (!existsSync(indexPath)) {
    fail(`Missing ${indexPath} — run npm run pages:build first.`);
  }
  const canonicalHumaneBrowseRedirectHref = await loadCanonicalHumaneBrowseRedirectHref();
  validateServeJsonForLocalStaticHost();
  const indexHtml = readFileSync(indexPath, "utf8");
  await validateHubIndex(indexHtml);
  await validateBrowseHtmlFiles();
  validateHumaneBrowseRedirectShims(canonicalHumaneBrowseRedirectHref);
  console.log(
    "pages:validate — OK (GitHub blob shapes, no /browse/browse/ stacking, serve.json, humane redirects).",
  );
}

await main();
