/**
 * Static hub: resolve per-pair browse URLs and match search hits to documented pairs.
 * (Keeps path logic testable without a browser.)
 */

export type DocumentedPairNavLike = {
  sourcePath: string;
  commentrayPath: string;
  staticBrowseUrl?: string;
  commentrayOnGithub?: string;
};

export function normPosixPath(s: string): string {
  return s.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

/**
 * Path prefix for the site “root” (where the hub `index.html` lives), even when the current
 * page is under `/browse/*.html`. Used so `./browse/foo.html` does not become `/browse/browse/foo.html`.
 */
export function siteRootPathnameFromPathname(pathname: string): string {
  const idx = pathname.indexOf("/browse/");
  if (idx >= 0) {
    const prefix = pathname.slice(0, idx).replace(/\/+$/, "");
    return prefix === "" ? "/" : prefix;
  }
  const noFile = pathname.replace(/\/[^/]*$/, "");
  if (noFile === "" || noFile === "/") return "/";
  return noFile.replace(/\/+$/, "") || "/";
}

/** Flat canonical page: `./browse/<hash>.html` (opaque slug, one path segment). */
const STATIC_BROWSE_FLAT = /^(?:\.\/)?browse\/([^/?#]+\.html)$/i;

/** Human-readable shim: `./browse/<encoded/source/segments>/index.html` (see `browse-pair-static-url.ts`). */
const STATIC_BROWSE_INDEXED = /^(?:\.\/)?browse\/(.+)\/index\.html$/i;

/** True when `href` is hub-root-relative static browse (not same-dir `./other.html`). */
export function isHubRelativeStaticBrowseHref(href: string): boolean {
  const t = href.trim();
  return STATIC_BROWSE_FLAT.test(t) || STATIC_BROWSE_INDEXED.test(t);
}

/**
 * Resolves `staticBrowseUrl` from nav JSON (typically `./browse/<slug>.html`) to an absolute href.
 */
export function resolveStaticBrowseHref(
  relativeBrowse: string,
  pathname: string,
  origin: string,
): string {
  const r = relativeBrowse.trim();
  if (r.startsWith("/")) return `${origin}${r}`;
  const root = siteRootPathnameFromPathname(pathname);
  const mFlat = STATIC_BROWSE_FLAT.exec(r);
  if (mFlat?.[1]) {
    const path = root === "/" ? `/browse/${mFlat[1]}` : `${root}/browse/${mFlat[1]}`;
    return `${origin}${path}`;
  }
  const mIdx = STATIC_BROWSE_INDEXED.exec(r);
  if (mIdx?.[1]) {
    const inner = mIdx[1];
    const path =
      root === "/" ? `/browse/${inner}/index.html` : `${root}/browse/${inner}/index.html`;
    return `${origin}${path}`;
  }
  return new URL(r, `${origin}${pathname}`).href;
}

/**
 * Value for `#shell` `data-commentray-pair-browse-href`: keep portable `./browse/…` hub-relative
 * URLs when the static site emits them (`*.html` or `…/index.html`); otherwise resolve like
 * {@link resolveStaticBrowseHref} for anchors and odd relative forms.
 */
export function staticBrowseHrefForShellDataAttribute(
  staticBrowseUrl: string,
  pathname: string,
  origin: string,
): string {
  const r = staticBrowseUrl.trim();
  if (r.length === 0) return "";
  const flat = STATIC_BROWSE_FLAT.exec(r);
  if (flat?.[1]) return `./browse/${flat[1]}`;
  const indexed = STATIC_BROWSE_INDEXED.exec(r);
  if (indexed?.[1]) return `./browse/${indexed[1]}/index.html`;
  return resolveStaticBrowseHref(r, pathname, origin);
}

export function findDocumentedPair<T extends DocumentedPairNavLike>(
  pairs: readonly T[],
  commentrayPath: string,
  sourcePath: string,
): T | undefined {
  const cr = normPosixPath(commentrayPath);
  const sp = normPosixPath(sourcePath);
  if (cr.length > 0) {
    const hit = pairs.find((x) => normPosixPath(x.commentrayPath) === cr);
    if (hit) return hit;
  }
  if (sp.length > 0) {
    const hit = pairs.find((x) => normPosixPath(x.sourcePath) === sp);
    if (hit) return hit;
  }
  return undefined;
}

export function isSameDocumentedPair(
  a: DocumentedPairNavLike,
  curSourcePath: string,
  curCommentrayPath: string,
): boolean {
  return (
    normPosixPath(a.sourcePath) === normPosixPath(curSourcePath) &&
    normPosixPath(a.commentrayPath) === normPosixPath(curCommentrayPath)
  );
}
