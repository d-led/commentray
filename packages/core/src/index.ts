export type {
  CommentrayBlock,
  CommentrayBlockFingerprint,
  CommentrayIndex,
  SourceFileIndexEntry,
} from "./model.js";
export { CURRENT_SCHEMA_VERSION } from "./model.js";
export type {
  AddBlockToIndexInput,
  BlockRange,
  CreateBlockForRangeInput,
  CreatedBlock,
} from "./blocks.js";
export {
  addBlockToIndex,
  appendBlockToCommentray,
  createBlockForRange,
  generateBlockId,
} from "./blocks.js";
export { assertValidAngleId } from "./angles.js";
export {
  commentrayAnglesLayoutEnabled,
  commentrayAnglesSentinelPath,
  commentrayMarkdownPath,
  commentrayMarkdownPathForAngle,
  defaultMetadataIndexPath,
  normalizeRepoRelativePath,
} from "./paths.js";
export type {
  CommentrayToml,
  ResolvedAngleDefinition,
  ResolvedAngles,
  ResolvedCommentrayConfig,
  ResolvedStaticSite,
} from "./config.js";
export { loadCommentrayConfig, mergeCommentrayConfig } from "./config.js";
export { parseGithubRepoWebUrl } from "./github-url.js";
export { assertValidIndex, emptyIndex } from "./metadata.js";
export { migrateIndex } from "./migrate.js";
export type { ParsedAnchor } from "./anchors.js";
export { formatLineRange, parseAnchor } from "./anchors.js";
export type { ScmProvider } from "./scm/scm-provider.js";
export { GitScmProvider } from "./scm/git-scm-provider.js";
export type { BlockDiagnostic } from "./staleness.js";
export { diagnoseBlock } from "./staleness.js";
export type { ValidationIssue, ValidationResult } from "./validate-project.js";
export { readIndex, validateProject, writeIndex } from "./validate-project.js";
export { runCommanderMain } from "./cli-bootstrap.js";
export type { BlockScrollLink } from "./scroll-sync.js";
export {
  buildBlockScrollLinks,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./scroll-sync.js";
