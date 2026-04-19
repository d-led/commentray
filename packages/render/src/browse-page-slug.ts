import { createHash } from "node:crypto";

/** Same slug as `_site/browse/<slug>.html` in `github-pages-site.ts` (nav search + browse pages). */
export function browsePageSlugFromPair(pair: {
  sourcePath: string;
  commentrayPath: string;
}): string {
  return createHash("sha256")
    .update(`${pair.commentrayPath}\0${pair.sourcePath}`, "utf8")
    .digest("base64url")
    .slice(0, 28);
}
