import {
  type CommentrayIndex,
  type SourceFileIndexEntry,
  coerceIndexSchemaVersion,
  CURRENT_SCHEMA_VERSION,
} from "./model.js";

const LEGACY_SCHEMA_VERSION = 2 as const;

/** Returns migrated index and whether the file should be rewritten. */
export function migrateIndex(raw: unknown): { index: CommentrayIndex; changed: boolean } {
  if (typeof raw !== "object" || raw === null) {
    return {
      index: { schemaVersion: CURRENT_SCHEMA_VERSION, byCommentrayPath: {} },
      changed: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  const version = coerceIndexSchemaVersion(obj.schemaVersion);
  if (version === null && obj.schemaVersion !== undefined) {
    throw new TypeError(`Invalid index schemaVersion: ${String(obj.schemaVersion)}`);
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    const index = obj as CommentrayIndex;
    return { index, changed: false };
  }

  if (
    version === LEGACY_SCHEMA_VERSION ||
    version === undefined ||
    version === 0 ||
    version === 1
  ) {
    const byCommentrayPath = toByCommentrayPath(obj);
    const next: CommentrayIndex = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath,
    };
    const before = JSON.stringify({
      schemaVersion: version === undefined ? 0 : version,
      bySourceFile: obj.bySourceFile ?? {},
      byCommentrayPath: obj.byCommentrayPath ?? {},
    });
    const after = JSON.stringify(next);
    const changed = before !== after;
    return { index: next, changed };
  }

  throw new Error(`Cannot migrate from schemaVersion ${String(obj.schemaVersion)}`);
}

function toByCommentrayPath(obj: Record<string, unknown>): Record<string, SourceFileIndexEntry> {
  if (
    obj.byCommentrayPath &&
    typeof obj.byCommentrayPath === "object" &&
    obj.byCommentrayPath !== null
  ) {
    const out: Record<string, SourceFileIndexEntry> = {};
    for (const [k, entry] of Object.entries(obj.byCommentrayPath as Record<string, unknown>)) {
      out[k] = normalizeEntry(entry);
    }
    return out;
  }
  const bySourceFile = obj.bySourceFile;
  const out: Record<string, SourceFileIndexEntry> = {};
  if (typeof bySourceFile !== "object" || bySourceFile === null) {
    return out;
  }
  for (const [, entry] of Object.entries(bySourceFile as Record<string, unknown>)) {
    const norm = normalizeEntry(entry);
    const cp = norm.commentrayPath;
    if (out[cp]) {
      throw new Error(`Duplicate commentrayPath in legacy index: ${cp}`);
    }
    out[cp] = norm;
  }
  return out;
}

function normalizeEntry(entry: unknown): SourceFileIndexEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new Error("Invalid index entry");
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.commentrayPath === "string") {
    return e as SourceFileIndexEntry;
  }
  if (typeof e.commentaryPath === "string") {
    const { commentaryPath, ...rest } = e;
    return { ...rest, commentrayPath: commentaryPath } as SourceFileIndexEntry;
  }
  return e as SourceFileIndexEntry;
}
