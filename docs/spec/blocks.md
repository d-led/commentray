# Commentray blocks

## Concept

Commentray is authored in **blocks**: segments of Markdown aligned to regions of a primary artifact (usually source code). Blocks are the unit of:

- alignment in side-by-side UI (code left, commentray right),
- staleness review,
- optional future automation (including LLM-assisted maintenance).

## Authoring shape (normative direction)

Blocks are represented in two layers:

1. **Markdown**: human text, diagrams, and narrative.
2. **Metadata** (JSON index): machine-owned fields such as fingerprints, last verified commits, and diagnostics.

Each block has:

- **`id`**: stable string within the commentray file.
- **`anchor`**: string in the anchor grammar (see `anchors.md`).
- **Optional `fingerprint`**: `{ startLine: string; endLine: string; lineCount: number }` capturing the trimmed content of the first and last source lines plus the original line count. Used for content-based drift resolution when source lines shift.
- **Optional `markerId`**: when set, the block's source range is delimited by host-language comments of the form `commentray:start id=<markerId>` / `commentray:end`. Drift-proof but invasive (touches the source). When both `fingerprint` and `markerId` are present, marker resolution wins.
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

## Metadata index (`index.json`, schema v3)

The workspace index groups blocks by **repo-relative commentray path** (`byCommentrayPath`), not by source path alone. That way each **Angle** file (see `storage.md`) keeps its own `blocks[]` without collisions when several commentrays exist for the same primary file.

Each entry still records both `sourcePath` and `commentrayPath`; the object key must equal `commentrayPath`. Older v1–v2 indexes keyed by `sourcePath` are migrated automatically when read (and rewritten on disk).

## Drift resolution (informative)

When a block's `anchor` is a `lines:<start>-<end>` range and a `fingerprint` is present, a drift resolver can re-sync the range after the source changes:

1. Read the source file; compare `sourceLines[start-1].trim()` and `sourceLines[end-1].trim()` against the recorded `fingerprint`.
2. If both still match at the recorded line numbers, the range is **unchanged**.
3. Otherwise search a bounded neighbourhood (±N lines, with N typically proportional to `lineCount`) for the fingerprint pair; if found uniquely, update the anchor. If ambiguous or missing, emit a diagnostic and leave the stored anchor alone.

When `markerId` is set, the resolver instead scans the source for the matching `commentray:start` / `commentray:end` comment pair and uses the lines between them. This mode is drift-proof at the cost of tolerating the marker comments in the source.

## Staleness (v0 rules)

The core library computes lightweight diagnostics:

- **Broken anchor**: the anchor string is invalid or cannot be interpreted for the configured strategies.
- **Review needed**:
  - `lastVerifiedCommit` is not an ancestor of `HEAD`, or
  - `lastVerifiedBlob` differs from the current `HEAD:<path>` blob id, or
  - the primary file is not tracked at `HEAD` while verification metadata exists.

These diagnostics are designed to be surfaced in editors and CI without silently rewriting commentray content.
