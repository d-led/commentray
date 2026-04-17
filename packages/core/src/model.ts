/**
 * Content fingerprint of a source range, used to re-resolve the block's
 * anchor after lines drift (insertions or deletions in the source).
 *
 * A fingerprint is intentionally narrow: trimmed text of the first and last
 * lines plus the original line count. Re-resolution is a search, not a
 * guarantee: when the fingerprint still appears uniquely near the old
 * location we silently update the line numbers; otherwise we surface a
 * diagnostic so a human can decide.
 */
export type CommentrayBlockFingerprint = {
  /** Trimmed content of the first line of the original range. */
  startLine: string;
  /** Trimmed content of the last line of the original range. */
  endLine: string;
  /** Number of lines the range originally spanned (end - start + 1). */
  lineCount: number;
};

/** Commentray block aligned to a region of a primary source file. */
export type CommentrayBlock = {
  /** Stable id within the commentray markdown file. */
  id: string;
  /** Human or machine anchor string (see anchor grammar in docs). */
  anchor: string;
  /**
   * Optional drift-resolution fingerprint. Present when the block's range
   * was captured from source content; absent when the anchor is purely a
   * symbol or marker reference that does not need content-based re-sync.
   */
  fingerprint?: CommentrayBlockFingerprint;
  /**
   * Optional marker-based anchor. When set, drift resolution looks for a
   * pair of host-language comments of the form `commentray:start id=<markerId>`
   * and `commentray:end` in the source; the lines between them become the
   * block's effective range. Markers are drift-proof but invasive.
   */
  markerId?: string;
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
