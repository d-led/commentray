import { normalizeRepoRelativePath } from "./paths.js";

/**
 * Parses a GitHub repository web URL into owner + repo name (no API calls).
 * Accepts optional trailing slash and `.git` suffix.
 */
export function parseGithubRepoWebUrl(url: string): { owner: string; repo: string } | null {
  const t = url.trim().replace(/\/+$/, "");
  const m = t.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

/**
 * Builds a `https://github.com/owner/repo/blob/<branch>/path` URL for a repo-relative file path.
 * Used for static-site “open another file” links when only `_site/index.html` is deployed.
 */
export function githubRepoBlobFileUrl(
  owner: string,
  repo: string,
  branch: string,
  repoRelativePath: string,
): string {
  const posix = normalizeRepoRelativePath(repoRelativePath.replace(/\\/g, "/"));
  const tail = posix
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${tail}`;
}
