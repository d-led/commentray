import { type CommentaryIndex, CURRENT_SCHEMA_VERSION } from "./model.js";

/** Returns migrated index and whether the file should be rewritten. */
export function migrateIndex(raw: unknown): { index: CommentaryIndex; changed: boolean } {
  if (typeof raw !== "object" || raw === null) {
    return {
      index: { schemaVersion: CURRENT_SCHEMA_VERSION, bySourceFile: {} },
      changed: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  const version = obj.schemaVersion;
  if (version === CURRENT_SCHEMA_VERSION) {
    return { index: obj as CommentaryIndex, changed: false };
  }
  if (version === undefined || version === 0) {
    const next = { ...obj, schemaVersion: CURRENT_SCHEMA_VERSION } as CommentaryIndex;
    return { index: next, changed: true };
  }
  throw new Error(`Cannot migrate from schemaVersion ${String(version)}`);
}
