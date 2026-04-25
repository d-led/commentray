import { browsePageSlugFromPair } from "@commentray/render";

/** Normalise repo-relative paths for browse alias and URL construction. */
export function normPosixPath(s: string): string {
  return s.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Dot-leading segments (`/.env`, `/.github/…`) break many static servers, which decode `%2E` to `.` in the path. */
function sourcePathHasDotLeadingSegment(sourcePath: string): boolean {
  return normPosixPath(sourcePath)
    .split("/")
    .filter(Boolean)
    .some((seg) => seg.startsWith("."));
}

export function commentrayFileStem(commentrayPath: string): string {
  const norm = normPosixPath(commentrayPath);
  const last = norm.split("/").filter(Boolean).at(-1) ?? "commentray";
  return last.replace(/\.md$/i, "");
}

/**
 * One path segment under `_site/browse/…`. `encodeURIComponent` does not escape `.`, so a
 * **leading** dot is spelled `%2E` plus encoding of the rest (same as the hub client’s humane
 * browse paths), so emitted dirs are not dot-hidden on static hosts.
 */
function browseAliasSegment(sourceSegment: string): string {
  if (sourceSegment.startsWith(".")) {
    return `%2E${encodeURIComponent(sourceSegment.slice(1))}`;
  }
  return encodeURIComponent(sourceSegment);
}

export function sourceBrowseAliasPath(sourcePath: string): string {
  const sourceSegments = normPosixPath(sourcePath)
    .split("/")
    .filter(Boolean)
    .map((seg) => browseAliasSegment(seg));
  return sourceSegments.length > 0 ? sourceSegments.join("/") : "pair";
}

export function humanBrowseAliasPathFromPair(
  pair: { sourcePath: string; commentrayPath: string },
  sourcePathDuplicateCount: number,
): string {
  const sourceAlias = sourceBrowseAliasPath(pair.sourcePath);
  if (sourceAlias === "pair") {
    return sourcePathDuplicateCount > 1
      ? `pair@${encodeURIComponent(commentrayFileStem(pair.commentrayPath))}`
      : "pair";
  }
  if (sourcePathDuplicateCount <= 1) return sourceAlias;
  return `${sourceAlias}@${encodeURIComponent(commentrayFileStem(pair.commentrayPath))}`;
}

/**
 * Hub-relative URL for opening a pair in the static code browser (same targets as the redirect
 * shims under `_site/browse/…`). Prefer this in nav JSON over opaque hash filenames.
 */
export function browsePairStaticBrowseRelUrl(
  pair: { sourcePath: string; commentrayPath: string },
  sourcePathDuplicateCount: number,
): string {
  if (sourcePathHasDotLeadingSegment(pair.sourcePath)) {
    return `./browse/${browsePageSlugFromPair(pair)}.html`;
  }
  const aliasRelPath = humanBrowseAliasPathFromPair(pair, sourcePathDuplicateCount);
  if (sourcePathDuplicateCount > 1) {
    return `./browse/${aliasRelPath}.html`;
  }
  return `./browse/${aliasRelPath}/index.html`;
}
