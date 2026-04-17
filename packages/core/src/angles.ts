/** Allowed characters for an Angle id (folder / file segment). */
const ANGLE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates and returns a trimmed Angle id. Used for TOML `angles.*` keys and path segments.
 * Rejects empty, `.`, `..`, and anything outside `[a-zA-Z0-9_-]` so paths stay predictable and safe.
 */
export function assertValidAngleId(angleId: string): string {
  const t = angleId.trim();
  if (t === "." || t === ".." || !ANGLE_ID_RE.test(t)) {
    throw new Error(
      `Invalid angle id "${angleId}" (use 1–64 characters from [a-zA-Z0-9_-] only; not "." or "..")`,
    );
  }
  return t;
}
