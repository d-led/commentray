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
