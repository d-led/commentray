#!/usr/bin/env node
/**
 * Post-`npm run pages:build` checks for `_site/`:
 * - Toolbar GitHub blob URLs match `https://github.com/<owner>/<repo>/blob/<branch>/…` (no doubled `/blob/`).
 * - Same-site Doc toolbar uses `./browse/<slug>.html` and resolves without `/browse/browse/` stacking.
 *
 * Optional live check (network): `COMMENTRAY_VALIDATE_PAGES_LIVE=1` sends HEAD to the hub source URL.
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

function hrefFor(html, id) {
  const m = new RegExp(`id="${id}"[^>]*href="([^"]+)"`).exec(html);
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

function assertDocToolbarHref(label, href) {
  if (href.startsWith("https://github.com/")) {
    assertGithubBlobUrl(`${label} (GitHub fallback)`, href);
    return;
  }
  if (!BROWSE_HTML_RE.test(href)) {
    fail(`${label}: expected ./browse/<slug>.html or GitHub blob, got: ${href}`);
  }
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

  const srcHref = hrefFor(indexHtml, "toolbar-source-github");
  if (srcHref) {
    assertGithubBlobUrl("hub toolbar-source-github", srcHref);
    await maybeHeadGithub(srcHref);
  }

  const docHubHref = hrefFor(indexHtml, "toolbar-commentray-github");
  if (!docHubHref) {
    fail('hub index.html: missing id="toolbar-commentray-github"');
  }
  assertDocToolbarHref("hub toolbar-commentray-github", docHubHref);

  const origins = ["https://d-led.github.io", "http://127.0.0.1:14173"];
  const slug = /^\.\/browse\/([^/]+\.html)$/.exec(docHubHref)?.[1];
  const pathnames = slug ? [`/browse/${slug}`, `/commentray/browse/${slug}`] : [];
  if (slug) {
    await assertBrowseMatrixResolves(docHubHref, pairNavPath, origins, pathnames);
  }
}

async function validateBrowsePage(name, html) {
  assertNoBrowseStack(html, `browse/${name}`);

  const src = hrefFor(html, "toolbar-source-github");
  if (src) assertGithubBlobUrl(`browse/${name} toolbar-source-github`, src);

  const doc = hrefFor(html, "toolbar-commentray-github");
  if (!doc) fail(`browse/${name}: missing toolbar-commentray-github`);
  assertDocToolbarHref(`browse/${name} toolbar-commentray-github`, doc);

  if (!existsSync(pairNavPath) || !BROWSE_HTML_RE.test(doc)) return;
  const { resolveStaticBrowseHref } = await import(pathToFileURL(pairNavPath).href);
  const slug = /^\.\/browse\/([^/]+\.html)$/.exec(doc)[1];
  const resolved = resolveStaticBrowseHref(doc, `/browse/${slug}`, "http://127.0.0.1:14173");
  if (resolved.includes("/browse/browse/")) {
    fail(`browse/${name}: resolved Doc toolbar → ${resolved}`);
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
