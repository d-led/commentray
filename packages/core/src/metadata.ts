import { type CommentrayIndex, CURRENT_SCHEMA_VERSION } from "./model.js";

export function emptyIndex(): CommentrayIndex {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, bySourceFile: {} };
}

export function assertValidIndex(value: unknown): CommentrayIndex {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("index.json must be a JSON object");
  }
  const obj = value as Record<string, unknown>;
  const schemaVersion = obj.schemaVersion;
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }
  const bySourceFile = obj.bySourceFile;
  if (typeof bySourceFile !== "object" || bySourceFile === null) {
    throw new TypeError("index.json.bySourceFile must be an object");
  }
  for (const [key, entry] of Object.entries(bySourceFile)) {
    validateSourceEntry(key, entry);
  }
  return obj as CommentrayIndex;
}

function validateSourceEntry(sourcePath: string, entry: unknown): void {
  if (typeof entry !== "object" || entry === null) {
    throw new TypeError(`Invalid index entry for ${sourcePath}`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.sourcePath !== "string") {
    throw new TypeError(`Missing sourcePath for ${sourcePath}`);
  }
  if (typeof e.commentrayPath !== "string") {
    throw new TypeError(`Missing commentrayPath for ${sourcePath}`);
  }
  if (!Array.isArray(e.blocks)) {
    throw new TypeError(`blocks must be an array for ${sourcePath}`);
  }
  for (const block of e.blocks) validateBlock(sourcePath, block);
}

function validateBlock(sourcePath: string, block: unknown): void {
  if (typeof block !== "object" || block === null) {
    throw new TypeError(`Invalid block under ${sourcePath}`);
  }
  const b = block as Record<string, unknown>;
  if (typeof b.id !== "string") {
    throw new TypeError(`block.id must be a string under ${sourcePath}`);
  }
  if (typeof b.anchor !== "string") {
    throw new TypeError(`block.anchor must be a string under ${sourcePath}`);
  }
  if (b.lastVerifiedCommit !== undefined && typeof b.lastVerifiedCommit !== "string") {
    throw new TypeError(
      `block.lastVerifiedCommit must be a string when present under ${sourcePath}`,
    );
  }
  if (b.lastVerifiedBlob !== undefined && typeof b.lastVerifiedBlob !== "string") {
    throw new TypeError(`block.lastVerifiedBlob must be a string when present under ${sourcePath}`);
  }
  if (b.markerId !== undefined && typeof b.markerId !== "string") {
    throw new TypeError(`block.markerId must be a string when present under ${sourcePath}`);
  }
  if (b.fingerprint !== undefined) validateFingerprint(sourcePath, b.fingerprint);
}

function validateFingerprint(sourcePath: string, fp: unknown): void {
  if (typeof fp !== "object" || fp === null) {
    throw new TypeError(`block.fingerprint must be an object under ${sourcePath}`);
  }
  const f = fp as Record<string, unknown>;
  if (typeof f.startLine !== "string") {
    throw new TypeError(`block.fingerprint.startLine must be a string under ${sourcePath}`);
  }
  if (typeof f.endLine !== "string") {
    throw new TypeError(`block.fingerprint.endLine must be a string under ${sourcePath}`);
  }
  if (typeof f.lineCount !== "number" || !Number.isInteger(f.lineCount) || f.lineCount < 1) {
    throw new TypeError(
      `block.fingerprint.lineCount must be a positive integer under ${sourcePath}`,
    );
  }
}
