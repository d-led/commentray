/**
 * Source delimiters for block anchors:
 *
 * 1. **Region convention** — where editors commonly fold `//#region` /
 *    `//#endregion`, `#region` / `#endregion`, `#pragma region`, etc. (aligned
 *    with [Region Marker](https://marketplace.visualstudio.com/items?itemName=txava.region-marker)),
 *    Commentray uses the region **name** `commentray:<id>`.
 *
 * 2. **Generic comments** — for languages without a shared region idiom, we
 *    use ordinary line or block comments and our own `commentray:start id=<id>` /
 *    `commentray:end id=<id>` tokens (still parsed by {@link parseCommentrayRegionBoundary}).
 *
 * Legacy pairs that only use (2) remain valid everywhere.
 */

const COMMENTRAY_TAG = (id: string) => `commentray:${id.trim().toLowerCase()}`;

/** `//#region commentray:<id>` — JS/TS ecosystem & CSS preprocessors that use `//`. */
const SLASH_REGION_LANGUAGES = new Set([
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "js",
  "jsx",
  "tsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "astro",
  "scss",
  "less",
  "stylus",
]);

/** `#region commentray:<id>` — same shape as Region Marker for these ids. */
const HASH_REGION_LANGUAGES = new Set([
  "ruby",
  "csharp",
  "coffeescript",
  "powershell",
  "perl",
  "raku",
  "crystal",
]);

const PRAGMA_REGION = new Set(["c", "cpp", "cuda-cpp", "objective-c", "objective-cpp"]);

const VB_REGION = new Set(["vb"]);

const LUA_REGION = new Set(["lua"]);

const HTML_FAMILY = new Set(["html", "xml", "handlebars", "vue-html"]);

const PYTHONIC = new Set(["python", "jupyter"]);

/** `# …` line comments for generic markers (no `#region` folding convention). */
const GENERIC_HASH_LANGUAGES = new Set([
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
  "shellscript",
  "bash",
  "sh",
  "zsh",
  "fish",
]);

type RegionConvention =
  | "slash-region"
  | "hash-region"
  | "pragma"
  | "vb"
  | "html"
  | "python"
  | "lua"
  | "generic-line"
  | "generic-hash"
  | "generic-block-css";

function regionConvention(languageId: string): RegionConvention {
  const id = languageId.toLowerCase();
  if (id === "css") return "generic-block-css";
  if (PYTHONIC.has(id)) return "python";
  if (PRAGMA_REGION.has(id)) return "pragma";
  if (VB_REGION.has(id)) return "vb";
  if (HTML_FAMILY.has(id)) return "html";
  if (LUA_REGION.has(id)) return "lua";
  if (HASH_REGION_LANGUAGES.has(id)) return "hash-region";
  if (SLASH_REGION_LANGUAGES.has(id)) return "slash-region";
  if (GENERIC_HASH_LANGUAGES.has(id)) return "generic-hash";
  return "generic-line";
}

/**
 * Line comment leader for **generic** `commentray:start` / `end` markers
 * (`// …`, `# …`, etc.). Not used for `#region` family languages.
 */
export function lineCommentLeaderForLanguage(languageId: string): string {
  const id = languageId.toLowerCase();
  if (GENERIC_HASH_LANGUAGES.has(id)) return "# ";
  if (id === "lua") return "-- ";
  if (id === "vb") return "' ";
  return "// ";
}

/**
 * Insertion fragments for wrapping the selection (apply **end** first, then
 * **start**, so stable offsets). Pass the same indentation string Region Marker
 * uses (leading whitespace of the first selected line).
 */
export function commentrayRegionInsertions(
  languageId: string,
  markerId: string,
  indent = "",
): { start: string; end: string } {
  const id = markerId.trim().toLowerCase();
  const tag = COMMENTRAY_TAG(id);
  const ind = indent;
  const conv = regionConvention(languageId);
  switch (conv) {
    case "slash-region":
      return {
        start: `${ind}//#region ${tag}\n`,
        end: `\n${ind}//#endregion ${tag}`,
      };
    case "hash-region":
      return {
        start: `${ind}#region ${tag}\n`,
        end: `\n${ind}#endregion ${tag}`,
      };
    case "pragma":
      return {
        start: `${ind}#pragma region ${tag}\n`,
        end: `\n${ind}#pragma endregion ${tag}`,
      };
    case "vb":
      return {
        start: `${ind}#Region ${tag}\n`,
        end: `\n${ind}#End Region ${tag}`,
      };
    case "html":
      return {
        start: `${ind}<!-- #region ${tag} -->\n`,
        end: `\n${ind}<!-- #endregion ${tag} -->`,
      };
    case "python":
      return {
        start: `${ind}# region ${tag}\n`,
        end: `\n${ind}# endregion ${tag}`,
      };
    case "lua":
      return {
        start: `${ind}--#region ${tag}\n`,
        end: `\n${ind}--#endregion ${tag}`,
      };
    case "generic-block-css":
      return {
        start: `${ind}/* commentray:start id=${id} */\n`,
        end: `\n${ind}/* commentray:end id=${id} */`,
      };
    case "generic-hash":
    case "generic-line": {
      const leader = lineCommentLeaderForLanguage(languageId);
      return {
        start: `${ind}${leader}commentray:start id=${id}\n`,
        end: `\n${ind}${leader}commentray:end id=${id}`,
      };
    }
  }
}

export type RegionBoundaryKind = "start" | "end";

/** Detect a Commentray region, generic marker, or legacy marker line; id is lower-case. */
export function parseCommentrayRegionBoundary(line: string): { kind: RegionBoundaryKind; id: string } | null {
  const probe = line.trim();
  const startPatterns: RegExp[] = [
    /^\/\/#region\s+commentray:([a-z0-9]+)\s*$/i,
    /^#region\s+commentray:([a-z0-9]+)\s*$/i,
    /^#pragma\s+region\s+commentray:([a-z0-9]+)\s*$/i,
    /^#Region\s+commentray:([a-z0-9]+)\s*$/i,
    /^#\s*region\s+commentray:([a-z0-9]+)\s*$/i,
    /^<!--\s*#region\s+commentray:([a-z0-9]+)\s*-->\s*$/i,
    /^--#region\s+commentray:([a-z0-9]+)\s*$/i,
    /^\/\*\s*commentray:start\s+id=([a-z0-9]+)\s*\*\/\s*$/i,
    /commentray:start\s+id=([a-z0-9]+)\b/i,
  ];
  const endPatterns: RegExp[] = [
    /^\/\/#endregion\s+commentray:([a-z0-9]+)\s*$/i,
    /^#endregion\s+commentray:([a-z0-9]+)\s*$/i,
    /^#pragma\s+endregion\s+commentray:([a-z0-9]+)\s*$/i,
    /^#End\s+Region\s+commentray:([a-z0-9]+)\s*$/i,
    /^#\s*endregion\s+commentray:([a-z0-9]+)\s*$/i,
    /^<!--\s*#endregion\s+commentray:([a-z0-9]+)\s*-->\s*$/i,
    /^--#endregion\s+commentray:([a-z0-9]+)\s*$/i,
    /^\/\*\s*commentray:end\s+id=([a-z0-9]+)\s*\*\/\s*$/i,
    /commentray:end\s+id=([a-z0-9]+)\b/i,
  ];
  for (const re of startPatterns) {
    const m = re.exec(probe);
    if (m) return { kind: "start", id: m[1].toLowerCase() };
  }
  for (const re of endPatterns) {
    const m = re.exec(probe);
    if (m) return { kind: "end", id: m[1].toLowerCase() };
  }
  return null;
}

/**
 * 1-based inclusive source lines **between** paired region / generic / legacy marker lines.
 */
export function sourceLineRangeForMarkerId(sourceText: string, markerId: string): {
  start: number;
  end: number;
} | null {
  const id = markerId.trim().toLowerCase();
  const lines = sourceText.split("\n");
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const hit = parseCommentrayRegionBoundary(lines[i]);
    if (hit?.id !== id) continue;
    if (hit.kind === "start" && startIdx < 0) startIdx = i;
    else if (hit.kind === "end" && startIdx >= 0 && endIdx < 0) endIdx = i;
  }
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx + 2) return null;
  const start = startIdx + 2;
  const end = endIdx;
  if (end < start) return null;
  return { start, end };
}
