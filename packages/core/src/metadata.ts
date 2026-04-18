import { parseAnchor, type ParsedAnchor } from "./anchors.js";
import { assertValidMarkerId } from "./marker-ids.js";
import { type CommentrayIndex, coerceIndexSchemaVersion, CURRENT_SCHEMA_VERSION } from "./model.js";

export function emptyIndex(): CommentrayIndex {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, byCommentrayPath: {} };
}

export function assertValidIndex(value: unknown): CommentrayIndex {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("index.json must be a JSON object");
  }
  const obj = value as Record<string, unknown>;
  const schemaVersion = coerceIndexSchemaVersion(obj.schemaVersion);
  if (schemaVersion === null) {
    throw new TypeError(
      `index.json schemaVersion must be an integer (got ${String(obj.schemaVersion)})`,
    );
  }
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion: ${String(obj.schemaVersion)} (this build expects ${String(CURRENT_SCHEMA_VERSION)}). ` +
        "If the CLI just migrated your index, reload the editor window and ensure the Commentray extension was built " +
        "from the same revision (dogfood: bash scripts/editor-extension.sh dogfood …; installed: bash scripts/install-extension.sh).",
    );
  }
  const byCommentrayPath = obj.byCommentrayPath;
  if (typeof byCommentrayPath !== "object" || byCommentrayPath === null) {
    throw new TypeError("index.json.byCommentrayPath must be an object");
  }
  for (const [key, entry] of Object.entries(byCommentrayPath)) {
    validateCommentrayEntry(key, entry);
  }
  return { ...obj, schemaVersion: CURRENT_SCHEMA_VERSION } as CommentrayIndex;
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

function parseValidatedMarkerId(commentrayPathKey: string, raw: string): string {
  try {
    return assertValidMarkerId(raw);
  } catch (e) {
    throw new TypeError(
      `block.id invalid under ${commentrayPathKey}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
}

function parseValidatedAnchor(commentrayPathKey: string, raw: string): ParsedAnchor {
  try {
    return parseAnchor(raw);
  } catch (e) {
    throw new TypeError(
      `Invalid block.anchor under ${commentrayPathKey}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
}

function assertBlockMarkerAnchorConsistency(
  commentrayPathKey: string,
  b: Record<string, unknown>,
  bid: string,
  parsedAnchor: ParsedAnchor,
): void {
  if (parsedAnchor.kind === "marker" && parsedAnchor.id !== bid) {
    throw new TypeError(
      `block.id must match marker anchor id (got id=${b.id}, anchor=${b.anchor}) under ${commentrayPathKey}`,
    );
  }
  if (
    parsedAnchor.kind === "marker" &&
    b.markerId !== undefined &&
    typeof b.markerId === "string" &&
    b.markerId.trim() !== "" &&
    assertValidMarkerId(b.markerId) !== parsedAnchor.id
  ) {
    throw new TypeError(
      `block.markerId must match marker anchor id under ${commentrayPathKey} (block ${b.id})`,
    );
  }
}

function validateBlockOptionalFields(commentrayPathKey: string, b: Record<string, unknown>): void {
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

function validateBlock(commentrayPathKey: string, block: unknown): void {
  if (typeof block !== "object" || block === null) {
    throw new TypeError(`Invalid block under ${commentrayPathKey}`);
  }
  const b = block as Record<string, unknown>;
  if (typeof b.id !== "string") {
    throw new TypeError(`block.id must be a string under ${commentrayPathKey}`);
  }
  const bid = parseValidatedMarkerId(commentrayPathKey, b.id);
  if (typeof b.anchor !== "string") {
    throw new TypeError(`block.anchor must be a string under ${commentrayPathKey}`);
  }
  const parsedAnchor = parseValidatedAnchor(commentrayPathKey, b.anchor);
  assertBlockMarkerAnchorConsistency(commentrayPathKey, b, bid, parsedAnchor);
  validateBlockOptionalFields(commentrayPathKey, b);
}
