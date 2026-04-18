/** A path Git detected as renamed between two tree-ish objects (`git diff --name-status -M`). */
export type ScmPathRename = { from: string; to: string };

/** Pluggable SCM integration; Git is the default implementation. */
export type ScmProvider = {
  /** Object id for file at HEAD (Git blob), or null if unknown/untracked. */
  getBlobIdAtHead(repoRoot: string, repoRelativePath: string): Promise<string | null>;
  /** True if `possibleAncestor` is an ancestor of `commit` (inclusive). */
  isAncestor(repoRoot: string, possibleAncestor: string, commit: string): Promise<boolean>;
  /**
   * Optional: list file renames Git detected between `fromTreeish` and `toTreeish`
   * (same semantics as `git diff --name-status -M30% fromTreeish toTreeish`).
   */
  listPathRenamesBetweenTreeishes?: (
    repoRoot: string,
    fromTreeish: string,
    toTreeish: string,
  ) => Promise<ScmPathRename[]>;
};
