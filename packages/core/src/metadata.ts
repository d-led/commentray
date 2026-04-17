import { type CommentrayIndex, CURRENT_SCHEMA_VERSION } from "./model.js";

export function emptyIndex(): CommentrayIndex {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, byCommentrayPath: {} };
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
  const byCommentrayPath = obj.byCommentrayPath;
  if (typeof byCommentrayPath !== "object" || byCommentrayPath === null) {
    throw new TypeError("index.json.byCommentrayPath must be an object");
  }
  for (const [key, entry] of Object.entries(byCommentrayPath)) {
    validateCommentrayEntry(key, entry);
  }
  return obj as CommentrayIndex;
}

function validateCommentrayEntry(commentrayPathKey: string, entry: unknown): void {
  if (typeof entry !== "object" || entry === null) {
    throw new TypeError(`Invalid index entry for ${commentrayPathKey}`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.sourcePath !== "string") {
    throw new TypeError(`Missing sourcePath for ${commentrayPathKey}`);
  }
  if (typeof e.commentrayPath !== "string") {
    throw new TypeError(`Missing commentrayPath for ${commentrayPathKey}`);
  }
  if (e.commentrayPath !== commentrayPathKey) {
    throw new TypeError(
      `index key must equal entry.commentrayPath (key=${commentrayPathKey}, entry=${e.commentrayPath})`,
    );
  }
  if (!Array.isArray(e.blocks)) {
    throw new TypeError(`blocks must be an array for ${commentrayPathKey}`);
  }
  for (const block of e.blocks) validateBlock(commentrayPathKey, block);
}

function validateBlock(commentrayPathKey: string, block: unknown): void {
  if (typeof block !== "object" || block === null) {
    throw new TypeError(`Invalid block under ${commentrayPathKey}`);
  }
  const b = block as Record<string, unknown>;
  if (typeof b.id !== "string") {
    throw new TypeError(`block.id must be a string under ${commentrayPathKey}`);
  }
  if (typeof b.anchor !== "string") {
    throw new TypeError(`block.anchor must be a string under ${commentrayPathKey}`);
  }
  if (b.lastVerifiedCommit !== undefined && typeof b.lastVerifiedCommit !== "string") {
    throw new TypeError(
      `block.lastVerifiedCommit must be a string when present under ${commentrayPathKey}`,
    );
  }
  if (b.lastVerifiedBlob !== undefined && typeof b.lastVerifiedBlob !== "string") {
    throw new TypeError(
      `block.lastVerifiedBlob must be a string when present under ${commentrayPathKey}`,
    );
  }
  if (b.markerId !== undefined && typeof b.markerId !== "string") {
    throw new TypeError(`block.markerId must be a string when present under ${commentrayPathKey}`);
  }
  if (b.snippet !== undefined && typeof b.snippet !== "string") {
    throw new TypeError(`block.snippet must be a string when present under ${commentrayPathKey}`);
  }
  if (b.fingerprint !== undefined) {
    throw new TypeError(
      `block.fingerprint is no longer supported under ${commentrayPathKey}; re-open the repo to migrate index.json`,
    );
  }
}
