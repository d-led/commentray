/**
 * Host-language **line** comments that delimit a commentray block in source.
 * The anchor lives in the file; index.json stores `marker:<id>` plus an optional
 * `snippet` (see `block-snippet.ts`) for human review and future drift tooling.
 */
export function lineCommentLeaderForLanguage(languageId: string): string {
  const id = languageId.toLowerCase();
  const hash = new Set([
    "python",
    "ruby",
    "shellscript",
    "dockerfile",
    "makefile",
    "cmake",
    "yaml",
    "yml",
    "toml",
    "ini",
    "properties",
    "git-commit",
    "sql",
    "r",
  ]);
  if (hash.has(id)) return "# ";
  if (id === "lua") return "-- ";
  if (id === "vb") return "' ";
  return "// ";
}

export function markerCommentInsertions(markerId: string, lineCommentLeader: string): { start: string; end: string } {
  const leader = lineCommentLeader.endsWith(" ") ? lineCommentLeader : `${lineCommentLeader} `;
  return {
    start: `${leader}commentray:start id=${markerId}\n`,
    end: `\n${leader}commentray:end id=${markerId}`,
  };
}
