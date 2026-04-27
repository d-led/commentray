export type { CommentrayBlock, CommentrayIndex, SourceFileIndexEntry } from "./model.js";
export { coerceIndexSchemaVersion, CURRENT_SCHEMA_VERSION } from "./model.js";
export type {
  AddBlockToIndexInput,
  BlockRange,
  CreateBlockForRangeInput,
  CreatedBlock,
  WrapSourceLineRangeWithCommentrayMarkersInput,
  WrapSourceLineRangeWithCommentrayMarkersResult,
} from "./blocks.js";
export {
  addBlockToIndex,
  appendBlockToCommentray,
  createBlockForRange,
  generateBlockId,
  wrapSourceLineRangeWithCommentrayMarkers,
} from "./blocks.js";
export { assertValidAngleId } from "./angles.js";
export {
  applyAnglesFlatMigrationToCommentrayToml,
  ensureAnglesSentinelFile,
  upsertAngleDefinitionInCommentrayToml,
} from "./angles-toml.js";
export type {
  ApplyAnglesFlatMigrationTomlInput,
  UpsertAngleDefinitionInput,
} from "./angles-toml.js";
export {
  defaultAngleIdForOpen,
  FALLBACK_DEFAULT_ANGLE_ID,
  resolveCommentrayMarkdownPath,
} from "./commentray-path-resolution.js";
export type { ResolvedCommentrayMarkdownPath } from "./commentray-path-resolution.js";
export {
  commentrayAnglesLayoutEnabled,
  commentrayAnglesSentinelPath,
  commentrayMarkdownPath,
  commentrayMarkdownPathForAngle,
  defaultMetadataIndexPath,
  normalizeRepoRelativePath,
  resolvePathUnderRepoRoot,
} from "./paths.js";
export { findMonorepoPackagesDir, monorepoLayoutStartDir } from "./monorepo-layout.js";
export type {
  CommentrayStaticBrowsePairPaths,
  CommentrayStaticBrowsePathResolver,
} from "./browse-contract.js";
export { defaultCommentrayStaticBrowsePathResolver } from "./browse-path-default.js";
export { staticBrowseIndexRelPathFromPair } from "./commentray-static-browse-path.js";
export {
  commentrayPairSourceFileExistsOnDisk,
  discoverCommentrayPairsOnDisk,
  pairFromCommentraySourceRel,
} from "./commentray-disk-pairs.js";
export type { DiskCommentrayPair } from "./commentray-disk-pairs.js";
export {
  collectOrphanCompanionMarkdownTargets,
  orphanCompanionCleanupAbsPath,
  pruneOrphanCompanionMarkdown,
} from "./orphan-companion-markdown.js";
export type {
  OrphanCompanionMarkdownTarget,
  PruneOrphanCompanionMarkdownResult,
} from "./orphan-companion-markdown.js";
export type {
  CommentrayToml,
  ResolvedAngleDefinition,
  ResolvedAngles,
  ResolvedCommentrayConfig,
  ResolvedGithubNavLink,
  ResolvedStaticSite,
} from "./config.js";
export { loadCommentrayConfig, mergeCommentrayConfig } from "./config.js";
export { githubRepoBlobFileUrl, parseGithubRepoWebUrl } from "./github-url.js";
export { assertValidIndex, emptyIndex } from "./metadata.js";
export { describeIndexSchemaRemediation } from "./index-schema-messages.js";
export { migrateIndex } from "./migrate.js";
export {
  discoverFlatCompanionMarkdownFiles,
  flatRelToSourcePath,
  planAnglesMigrationFromCompanions,
  rewriteIndexKeysForAnglesMigration,
} from "./migrate-angles-layout.js";
export type {
  AnglesMigrationMove,
  AnglesMigrationPlan,
  FlatCompanionEntry,
} from "./migrate-angles-layout.js";
export type { ParsedAnchor } from "./anchors.js";
export { formatLineRange, parseAnchor } from "./anchors.js";
export type { ScmPathRename, ScmProvider } from "./scm/scm-provider.js";
export { GitScmProvider, parseGitRenameLines } from "./scm/git-scm-provider.js";
export {
  applyPathRenamesToCommentrayIndex,
  inferAngleIdFromCommentrayPath,
} from "./commentray-index-renames.js";
export type { PathRename } from "./commentray-index-renames.js";
export type { BlockDiagnostic } from "./staleness.js";
export { diagnoseBlock } from "./staleness.js";
export type {
  ValidationIssue,
  ValidationResult,
  ValidateProjectOptions,
} from "./validate-project.js";
export {
  readIndex,
  refreshIndexMigrationsOnDisk,
  validateProject,
  writeIndex,
} from "./validate-project.js";
export { plannedSymbolResolutionStrategy } from "./language-intelligence.js";
export type { SymbolResolutionStrategy } from "./language-intelligence.js";
export { relocationHintMessages } from "./relocation-hints.js";
export type { RelocationHintsInput } from "./relocation-hints.js";
export { runCommanderMain } from "./cli-bootstrap.js";
export type { BlockScrollLink } from "./scroll-sync.js";
export {
  buildBlockScrollLinks,
  pickBlockScrollLinkForCommentrayScroll,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
} from "./scroll-sync.js";
export {
  commentrayRegionInsertions,
  lineCommentLeaderForLanguage,
  markerViewportHalfOpen1Based,
  parseCommentrayRegionBoundary,
  sourceLineRangeForMarkerId,
} from "./source-markers.js";
export type {
  RegionMarkerNamingHintStrategy,
  RegionMarkerNamingInput,
  RegionMarkerNamingRange,
  RegionMarkerNamingStrategy,
} from "./region-marker-naming.js";
export {
  CallbackRegionMarkerNamingStrategy,
  CodeStructureHintStrategy,
  CompositeRegionMarkerNamingStrategy,
  defaultRegionMarkerNamingStrategy,
  EnclosingSymbolHintStrategy,
  MarkdownHeadingHintStrategy,
  TomlTableHeaderHintStrategy,
  tryCodeStructureNameHint,
  tryMarkdownHeadingTitleAbove,
  tryNormaliseContextLabelToMarkerId,
  tryTomlTablePathAboveSelection,
} from "./region-marker-naming.js";
export type { CommentrayMarkerPair } from "./region-marker-convert.js";
export {
  convertCommentraySourceMarkersToLanguage,
  findCommentrayMarkerPairs,
  leadingIndentOfLine,
} from "./region-marker-convert.js";
export { MARKER_ID_BODY, assertValidMarkerId, normaliseMarkerSlugOrThrow } from "./marker-ids.js";
export type { MarkerValidationIssue } from "./marker-validation.js";
export {
  extractCommentrayBlockIdsFromMarkdown,
  validateIndexMarkerSemantics,
  validateMarkerBoundariesInSource,
  validateMarkerRegionsAgainstIndexedSources,
  validateOverlappingMarkerInnerRangesInSource,
} from "./marker-validation.js";
