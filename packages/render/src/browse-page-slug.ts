import { createHash } from "node:crypto";

/**
 * Opaque filename stem for `_site/browse/<slug>.html` (nav search + browse pages).
 * **Stable across rebuilds** while `commentrayPath` and `sourcePath` are unchanged;
 * deterministic from those exact strings. **Rename or move** either file → new
 * strings → **a new slug** (no automatic redirect from old URLs).
 */
export function browsePageSlugFromPair(pair: {
  sourcePath: string;
  commentrayPath: string;
}): string {
  return createHash("sha256")
    .update(`${pair.commentrayPath}\0${pair.sourcePath}`, "utf8")
    .digest("base64url")
    .slice(0, 28);
}
