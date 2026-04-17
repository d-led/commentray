export type { CommentaryBlock, CommentaryIndex, SourceFileIndexEntry } from "./model.js";
export { CURRENT_SCHEMA_VERSION } from "./model.js";
export {
  commentaryMarkdownPath,
  defaultMetadataIndexPath,
  normalizeRepoRelativePath,
} from "./paths.js";
export type { CommentaryToml, ResolvedCommentaryConfig } from "./config.js";
export { loadCommentaryConfig, mergeCommentaryConfig } from "./config.js";
export { assertValidIndex, emptyIndex } from "./metadata.js";
export { migrateIndex } from "./migrate.js";
export type { ParsedAnchor } from "./anchors.js";
export { formatLineRange, parseAnchor } from "./anchors.js";
export type { ScmProvider } from "./scm/scm-provider.js";
export { GitScmProvider } from "./scm/git-scm-provider.js";
export type { BlockDiagnostic } from "./staleness.js";
export { diagnoseBlock } from "./staleness.js";
export type { ValidationIssue, ValidationResult } from "./validate-project.js";
export { readIndex, validateProject } from "./validate-project.js";
export { runCommanderMain } from "./cli-bootstrap.js";
