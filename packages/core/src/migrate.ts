import {
  type CommentrayIndex,
  type SourceFileIndexEntry,
  CURRENT_SCHEMA_VERSION,
} from "./model.js";

/** Returns migrated index and whether the file should be rewritten. */
export function migrateIndex(raw: unknown): { index: CommentrayIndex; changed: boolean } {
  if (typeof raw !== "object" || raw === null) {
    return {
      index: { schemaVersion: CURRENT_SCHEMA_VERSION, bySourceFile: {} },
      changed: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  const version = obj.schemaVersion;
  if (version === CURRENT_SCHEMA_VERSION) {
    return { index: obj as CommentrayIndex, changed: false };
  }
  if (version === undefined || version === 0 || version === 1) {
    const bySourceFile = normalizeBySourceFile(obj.bySourceFile);
    const next: CommentrayIndex = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      bySourceFile,
    };
    const before = JSON.stringify({
      schemaVersion: version ?? 0,
      bySourceFile: obj.bySourceFile ?? {},
    });
    const after = JSON.stringify(next);
    const changed = before !== after;
    return { index: next, changed };
  }
  throw new Error(`Cannot migrate from schemaVersion ${String(version)}`);
}

function normalizeBySourceFile(by: unknown): Record<string, SourceFileIndexEntry> {
  if (typeof by !== "object" || by === null) return {};
  const out: Record<string, SourceFileIndexEntry> = {};
  for (const [k, entry] of Object.entries(by as Record<string, unknown>)) {
    out[k] = normalizeEntry(entry);
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
