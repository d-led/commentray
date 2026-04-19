import { normalizeRepoRelativePath } from "./paths.js";

function trimTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === "/") end--;
  return s.slice(0, end);
}

/**
 * Parses a GitHub repository web URL into owner + repo name (no API calls).
 * Accepts optional trailing slash and `.git` suffix.
 */
export function parseGithubRepoWebUrl(url: string): { owner: string; repo: string } | null {
  const t = trimTrailingSlashes(url.trim());
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== "github.com") return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const owner = segments[0];
  let repo = segments[1];
  if (repo.toLowerCase().endsWith(".git")) repo = repo.slice(0, -4);
  return { owner, repo };
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
  const posix = normalizeRepoRelativePath(repoRelativePath.replaceAll("\\", "/"));
  const tail = posix
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${tail}`;
}
