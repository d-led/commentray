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

/** `./browse/<slug>.html` or `browse/<slug>.html` from nav JSON (see `github-pages-site.ts`). */
const STATIC_BROWSE_REL = /^(?:\.\/)?browse\/([^/?#]+\.html)$/i;

/** True when `href` is hub-root-relative static browse (not same-dir `./other.html`). */
export function isHubRelativeStaticBrowseHref(href: string): boolean {
  return STATIC_BROWSE_REL.test(href.trim());
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
  const m = STATIC_BROWSE_REL.exec(r);
  if (m?.[1]) {
    const root = siteRootPathnameFromPathname(pathname);
    const path = root === "/" ? `/browse/${m[1]}` : `${root}/browse/${m[1]}`;
    return `${origin}${path}`;
  }
  return new URL(r, `${origin}${pathname}`).href;
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
