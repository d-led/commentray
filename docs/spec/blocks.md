# Commentray blocks

## Concept

Commentray is authored in **blocks**: segments of Markdown aligned to regions of a primary artifact (usually source code). Blocks are the unit of:

- alignment in side-by-side UI (code left, commentray right),
- staleness review,
- optional future automation (including LLM-assisted maintenance).

## Authoring shape (normative direction)

Blocks are represented in two layers:

1. **Markdown**: human text, diagrams, and narrative.
2. **Metadata** (JSON index): machine-owned fields such as optional **snippets** of anchored source, last verified commits, and diagnostics.

Each block has:

- **`id`**: stable string within the commentray file.
- **`anchor`**: string in the anchor grammar (see `anchors.md`).
- **Optional `snippet`**: a single self-contained string (v1 format, see [`block-snippet.ts`](../../packages/core/src/block-snippet.ts)) — header line `commentray-snippet/v1`, then one line per anchored source line in unified-diff **context** style (each body line is a leading space plus the **trimmed** source text). Used to record what the anchor pointed at and to support human or future tooling review when `lines:` ranges shift. **Not** the legacy nested `fingerprint` object (that shape is rejected; run `commentray migrate` to fold it into `snippet`).
- **Optional `markerId`**: redundant echo of the id inside `marker:<id>` anchors; when the anchor is `marker:…`, the span is resolved from **paired region delimiters** in the source (see below). `markerId` must stay consistent with `marker:` in the anchor string.
- **Optional verification**:
  - `lastVerifiedCommit`: full Git SHA when a human verified the block against the repo.
  - `lastVerifiedBlob`: Git blob id of the primary file at verification time (when known).

## Markdown carrier

To identify a block in the Markdown without redundantly storing metadata in two places, each block is introduced by an **invisible HTML comment marker**:

```md
<!-- commentray:block id=<id> -->

## `<sourcePath>` lines 10–20

_(write commentary here)_
```

- The HTML comment renders to nothing on GitHub, GitHub Pages, and every standards-compliant Markdown renderer, so readers only see the heading and the prose.
- The heading is human-readable shorthand; the authoritative anchor lives in the metadata index keyed by the same `id`.
- Tools locate a block's position in the commentray file by scanning for `<!-- commentray:block id=… -->`; authors should not edit the marker line.

## Source markers (language-dependent)

When the index uses a **`marker:<id>`** anchor, the primary file carries paired delimiters in real comments. Where a **`#region` / `//#region`** style is a widespread editor convention (JavaScript/TypeScript, SCSS, C#, Ruby, C/C++ `#pragma`, Python `# region`, HTML, Lua, VB, …), Commentray follows the same shapes as [Region Marker](https://marketplace.visualstudio.com/items?itemName=txava.region-marker), naming the region **`commentray:<id>`**. For languages **without** that shared idiom (Rust, Java, Kotlin, plain **CSS**, Docker/YAML/Make, …), tools fall back to ordinary **`//` / `#` / `/* … */`** comments and our explicit tokens **`commentray:start id=<id>`** / **`commentray:end id=<id>`**. Both families are understood by `@commentray/core` (`commentrayRegionInsertions`, `parseCommentrayRegionBoundary`).

**Per-language cheat sheet:** [Source region delimiters (by editor language)](../user/source-region-delimiters.md).

To **rewrite** existing markers after you change language or convention, use **`convertCommentraySourceMarkersToLanguage`** (pairs are discovered with `findCommentrayMarkerPairs`, then each span is rebuilt for the target language id). The CLI exposes the same behaviour as **`commentray convert-source-markers --file <repo-relative> --language <vscode-language-id>`** (optional `--dry-run`).

## Metadata index (`index.json`, schema v3)

The workspace index groups blocks by **repo-relative commentray path** (`byCommentrayPath`), not by source path alone. That way each **Angle** file (see `storage.md`) keeps its own `blocks[]` without collisions when several commentrays exist for the same primary file.

Each entry still records both `sourcePath` and `commentrayPath`; the object key must equal `commentrayPath`. Older v1–v2 indexes keyed by `sourcePath` are migrated automatically when read (and rewritten on disk).

## Drift and snippets (informative)

- **`lines:` anchors:** the authoritative span is always the `start`–`end` range in `index.json`. Core **validation does not** silently rewrite those numbers when the file changes. An optional **`snippet`** records the trimmed source lines that the range covered when the block was authored or last normalized—reviewers and UIs can compare it to the current file at the same line numbers to spot stale commentary after edits.
- **`marker:` anchors:** the span is derived from **region delimiters** in the primary file (see [Source markers](#source-markers-language-dependent)). Renumbering lines inside the region does not break the link; renaming the region id requires coordinated edits across index, Markdown marker, and source.

Automated “search the neighbourhood and patch `lines:`” resolvers are intentionally **not** part of strict validation today; they remain a possible future extension on top of the same `snippet` v1 format.

## Staleness (current diagnostics)

The core library computes lightweight diagnostics:

- **Broken anchor**: the anchor string is invalid or cannot be interpreted for the configured strategies.
- **Review needed**:
  - `lastVerifiedCommit` is not an ancestor of `HEAD`, or
  - `lastVerifiedBlob` differs from the current `HEAD:<path>` blob id, or
  - the primary file is not tracked at `HEAD` while verification metadata exists.

These diagnostics are designed to be surfaced in editors and CI without silently rewriting commentray content.

## See also

- [Keeping blocks, regions, and metadata consistent](../user/keeping-blocks-in-sync.md) — checklists, CLI commands, and workflows after renames or refactors.
