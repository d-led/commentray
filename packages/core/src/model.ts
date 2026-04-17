/** Commentray block aligned to a region of a primary source file. */
export type CommentrayBlock = {
  /** Stable id within the commentray markdown file. */
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
  /** Repo-relative path to the primary file this commentray belongs to. */
  sourcePath: string;
  /** Repo-relative path to the Markdown commentray file. */
  commentrayPath: string;
  blocks: CommentrayBlock[];
};

/** Root metadata document stored as JSON under `.commentray/metadata/`. */
export type CommentrayIndex = {
  schemaVersion: number;
  bySourceFile: Record<string, SourceFileIndexEntry>;
};

export const CURRENT_SCHEMA_VERSION = 2 as const;
