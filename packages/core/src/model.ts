/** Commentary block aligned to a region of a primary source file. */
export type CommentaryBlock = {
  /** Stable id within the commentary file. */
  id: string;
  /** Human or machine anchor string (see anchor grammar in docs). */
  anchor: string;
  /** Last human-verified commit (full SHA) when this block was considered accurate. */
  lastVerifiedCommit?: string;
  /** Git blob id at verification time for the primary file (when known). */
  lastVerifiedBlob?: string;
  /** Optional notes for agents or reviewers. */
  notes?: string;
};

export type SourceFileIndexEntry = {
  /** Repo-relative path to the primary file this commentary belongs to. */
  sourcePath: string;
  /** Repo-relative path to the Markdown commentary file. */
  commentaryPath: string;
  blocks: CommentaryBlock[];
};

/** Root metadata document stored as JSON under `.commentary/metadata/`. */
export type CommentaryIndex = {
  schemaVersion: number;
  bySourceFile: Record<string, SourceFileIndexEntry>;
};

export const CURRENT_SCHEMA_VERSION = 1 as const;
