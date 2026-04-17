/**
 * Idempotent injection of a Commentary-managed block into `.git/hooks/pre-commit`.
 * Re-running replaces only the marked region.
 */

export const COMMENTARY_HOOK_BEGIN = "# <<<< commentary-cli-hook v1 BEGIN >>>>";
export const COMMENTARY_HOOK_END = "# <<<< commentary-cli-hook v1 END >>>>";

/** Shell fragment: validate from repo root when CLI is installed under `node_modules/.bin`. */
export const COMMENTARY_PRE_COMMIT_BODY = `root=$(git rev-parse --show-toplevel)
commentary_bin="$root/node_modules/.bin/commentary"
if [ -f "$root/.commentary.toml" ] && [ -x "$commentary_bin" ]; then
  "$commentary_bin" validate || exit $?
fi`;

export function commentaryManagedHookBlock(): string {
  return `${COMMENTARY_HOOK_BEGIN}\n${COMMENTARY_PRE_COMMIT_BODY}\n${COMMENTARY_HOOK_END}\n`;
}

/** Normalize newlines for stable merging. */
export function normalizeHookNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

/**
 * Merge or append the Commentary hook block into existing `pre-commit` contents.
 * @param existingContent full file body (may be empty)
 */
export function mergeCommentaryPreCommitHook(existingContent: string): string {
  const block = commentaryManagedHookBlock();
  const trimmed = normalizeHookNewlines(existingContent);
  if (!trimmed.trim()) {
    return `#!/bin/sh\n${block}`;
  }
  if (trimmed.includes(COMMENTARY_HOOK_BEGIN)) {
    const start = trimmed.indexOf(COMMENTARY_HOOK_BEGIN);
    const end = trimmed.indexOf(COMMENTARY_HOOK_END);
    if (end === -1) {
      return `${trimmed.trimEnd()}\n\n${block}`;
    }
    const tail = trimmed.slice(end + COMMENTARY_HOOK_END.length).replace(/^\n+/, "\n");
    return `${trimmed.slice(0, start)}${block}${tail}`;
  }
  return `${trimmed.trimEnd()}\n\n${block}`;
}
