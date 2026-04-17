import { type CommentaryIndex, CURRENT_SCHEMA_VERSION } from "./model.js";

export function emptyIndex(): CommentaryIndex {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, bySourceFile: {} };
}

export function assertValidIndex(value: unknown): CommentaryIndex {
  if (typeof value !== "object" || value === null) {
    throw new Error("index.json must be a JSON object");
  }
  const obj = value as Record<string, unknown>;
  const schemaVersion = obj.schemaVersion;
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }
  const bySourceFile = obj.bySourceFile;
  if (typeof bySourceFile !== "object" || bySourceFile === null) {
    throw new Error("index.json.bySourceFile must be an object");
  }
  for (const [key, entry] of Object.entries(bySourceFile)) {
    validateSourceEntry(key, entry);
  }
  return obj as CommentaryIndex;
}

function validateSourceEntry(sourcePath: string, entry: unknown): void {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Invalid index entry for ${sourcePath}`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.sourcePath !== "string") throw new Error(`Missing sourcePath for ${sourcePath}`);
  if (typeof e.commentaryPath !== "string") {
    throw new Error(`Missing commentaryPath for ${sourcePath}`);
  }
  if (!Array.isArray(e.blocks)) throw new Error(`blocks must be an array for ${sourcePath}`);
  for (const block of e.blocks) validateBlock(sourcePath, block);
}

function validateBlock(sourcePath: string, block: unknown): void {
  if (typeof block !== "object" || block === null) {
    throw new Error(`Invalid block under ${sourcePath}`);
  }
  const b = block as Record<string, unknown>;
  if (typeof b.id !== "string") throw new Error(`block.id must be a string under ${sourcePath}`);
  if (typeof b.anchor !== "string") {
    throw new Error(`block.anchor must be a string under ${sourcePath}`);
  }
  if (b.lastVerifiedCommit !== undefined && typeof b.lastVerifiedCommit !== "string") {
    throw new Error(`block.lastVerifiedCommit must be a string when present under ${sourcePath}`);
  }
  if (b.lastVerifiedBlob !== undefined && typeof b.lastVerifiedBlob !== "string") {
    throw new Error(`block.lastVerifiedBlob must be a string when present under ${sourcePath}`);
  }
}
