/**
 * Stable contract between index / nav JSON / static HTML and browse URL + on-disk layout.
 * Default resolution mirrors `{storageDir}/source/…` under `_site/browse/…/index.html`
 * ({@link staticBrowseIndexRelPathFromPair}); implement {@link CommentrayStaticBrowsePathResolver}
 * only if a repo needs a different mapping.
 */

/** Same shape as index entries and nav `documentedPairs` browse inputs. */
export type CommentrayStaticBrowsePairPaths = {
  readonly sourcePath: string;
  readonly commentrayPath: string;
};

/** Injectable browse path strategy (tests or alternate storage layouts). */
export interface CommentrayStaticBrowsePathResolver {
  browseIndexRelPathFromPair(pair: CommentrayStaticBrowsePairPaths, storageDir: string): string;
}
