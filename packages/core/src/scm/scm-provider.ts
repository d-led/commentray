/** Pluggable SCM integration; Git is the default implementation. */
export type ScmProvider = {
  /** Object id for file at HEAD (Git blob), or null if unknown/untracked. */
  getBlobIdAtHead(repoRoot: string, repoRelativePath: string): Promise<string | null>;
  /** True if `possibleAncestor` is an ancestor of `commit` (inclusive). */
  isAncestor(repoRoot: string, possibleAncestor: string, commit: string): Promise<boolean>;
};
