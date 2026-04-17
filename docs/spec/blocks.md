# Commentary blocks

## Concept

Commentary is authored in **blocks**: segments of Markdown aligned to regions of a primary artifact (usually source code). Blocks are the unit of:

- alignment in side-by-side UI (code left, commentary right),
- staleness review,
- optional future automation (including LLM-assisted maintenance).

## Authoring shape (normative direction)

Blocks are represented in two layers:

1. **Markdown**: human text, diagrams, and narrative.
2. **Metadata** (JSON index): machine-owned fields such as fingerprints, last verified commits, and diagnostics.

Each block has:

- **`id`**: stable string within the commentary file.
- **`anchor`**: string in the anchor grammar (see `anchors.md`).
- **Optional verification**:
  - `lastVerifiedCommit`: full Git SHA when a human verified the block against the repo.
  - `lastVerifiedBlob`: Git blob id of the primary file at verification time (when known).

## Staleness (v0 rules)

The core library computes lightweight diagnostics:

- **Broken anchor**: the anchor string is invalid or cannot be interpreted for the configured strategies.
- **Review needed**:
  - `lastVerifiedCommit` is not an ancestor of `HEAD`, or
  - `lastVerifiedBlob` differs from the current `HEAD:<path>` blob id, or
  - the primary file is not tracked at `HEAD` while verification metadata exists.

These diagnostics are designed to be surfaced in editors and CI without silently rewriting commentary.
