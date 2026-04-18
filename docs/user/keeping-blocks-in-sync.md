# Keeping blocks, regions, and metadata consistent

Commentray ties three surfaces together. If they drift apart, validation fails, scroll sync misaligns, or commentary points at the wrong lines. This guide is the **operational contract**: what must match, how to check it, and what to do when it breaks.

## The three surfaces (and what each owns)

| Surface             | Location                                         | What you must keep aligned                                                                                                                  |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Index**        | `.commentray/metadata/index.json`                | Per companion file: `sourcePath`, `commentrayPath`, and each block’s `id`, `anchor`, optional `snippet` / `markerId` / verification fields. |
| **B. Markdown**     | `.commentray/source/…/*.md` (or per-angle paths) | For each block: a line `<!-- commentray:block id=<id> -->` **with the same `id` as the index**, then prose below it.                        |
| **C. Primary file** | Repo source (e.g. `src/foo.ts`)                  | Depends on anchor type (see below): either **line numbers** implied by `lines:…` or **explicit region comments** for `marker:…`.            |

**Rule of thumb:** the index **`block.id`** and the Markdown **marker id** must always be identical strings. The **`anchor`** in the index describes how to find the span in **C**; it does not replace **B**.

## Anchor types: maintenance cost vs drift resistance

### `lines:<start>-<end>` (line range)

- **Pros:** No comments in source; good for generated or policy-locked files.
- **Cons:** Editing the file moves lines; **`anchor` and optional `snippet` in the index** can become wrong until you update them (or run tooling that refreshes them).
- **Consistency:** After refactors, re-check ranges. Use **`commentray validate`**; fix `anchor` (and snippet if you use it) so they still describe the intended span.

### `marker:<id>` (named region in source)

- **Pros:** Tools resolve the span from **paired delimiters** in the source (`//#region commentray:<id>` … `//#endregion`, or `commentray:start id=<id>` / `commentray:end` where regions are not idiomatic). Renumbering lines **inside** the region does not break the link.
- **Cons:** Markers live in the primary file; reviewers must accept them. **`markerId` in the index** (when present) must stay consistent with **`marker:`** resolution rules (see [anchors.md](../spec/anchors.md)).
- **Consistency:** Never rename a region id in source without updating **`marker:`** / **`markerId`** and the Markdown **`id=`** and index **`id`** to the same new token. Use **`commentray convert-source-markers`** if you change language/comment style.

See [blocks.md — Source markers](../spec/blocks.md#source-markers-language-dependent) for delimiter shapes.

## Single checklist: “is this block still coherent?”

For each block, all of the following must hold:

1. **Index** `blocks[].id` equals the Markdown `<!-- commentray:block id=… -->` id (same string).
2. **Index** `entry.sourcePath` and `entry.commentrayPath` match the files you think you paired; the JSON object key must equal `commentrayPath`.
3. **`anchor`** parses (see [anchors.md](../spec/anchors.md)).
4. If **`marker:`** anchor: source contains a well-formed pair for that id; **`commentray validate`** must not report marker pairing errors for that file.
5. If **`lines:`** anchor: `start`–`end` are within the file and describe the intended lines; update after line insert/delete if the commentary should move with different lines.
6. Optional **`snippet`**: records trimmed source lines for `lines:` anchors; update when you intentionally change the anchored span (see [blocks.md](../spec/blocks.md) — “Drift and snippets”).

## Commands and when to run them

Run these from the **repository root** (or ensure `commentray` resolves paths the same way your workspace does).

| Command                                                               | Purpose                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`commentray init`**                                                 | Ensures dirs + `index.json`, creates `.commentray.toml` if missing, runs migrations/normalization, merges **`d-led.commentray-vscode`** into `.vscode/extensions.json` when that file is valid mergeable JSON, then **validate**. Safe to repeat. |
| **`commentray validate`**                                             | Schema, index keys, marker pairing, marker uniqueness across files, marker/source alignment. **Use in CI** (exit `1` on errors).                                                                                                                  |
| **`commentray doctor`**                                               | `validate` plus environment hints (e.g. missing `.git`).                                                                                                                                                                                          |
| **`commentray migrate`**                                              | Rewrites `index.json` when schema or snippet normalization changes (also applied automatically on read in many tools).                                                                                                                            |
| **`commentray sync-moved-paths`**                                     | After **Git renames/moves**, rewrites `sourcePath` / `commentrayPath` in the index using `git diff` rename detection. Does not fix anchors inside files—you still need to adjust `lines:` or regions if logic moved.                              |
| **`commentray convert-source-markers --file <path> --language <id>`** | Rewrites **source** region delimiter style to match a VS Code language id (dry-run first if unsure).                                                                                                                                              |

**Editor:** “Commentray: Validate workspace metadata” runs the same validation as the CLI and prints issues to the output channel.

**Git hook:** `commentray init scm` installs a **pre-commit** fragment that runs **`commentray validate`** when the CLI is on `PATH`. That catches index/markdown/source mistakes before they land on `main`.

## Workflows after common edits

### You moved or renamed a source or commentray file (Git)

1. **`commentray sync-moved-paths`** (optionally `--dry-run` first) to fix index paths.
2. **`commentray validate`** — fix any remaining path or anchor issues.

### You edited line numbers only (`lines:` anchors)

1. Open the source; decide the new first/last line of the documented span.
2. Update **`anchor`** in `index.json` for that block (and **`snippet`** if you rely on drift tooling).
3. Optionally adjust the Markdown heading text for humans—it is not authoritative for the span.
4. **`commentray validate`**.

### You renamed a `marker:` id or merged regions

1. Update **source** delimiters, **index** `anchor` / `markerId`, **Markdown** marker `id=`, and **index** `id` so they all use the **same** new id.
2. **`commentray convert-source-markers`** if only the comment _syntax_ changed.
3. **`commentray validate`**.

### You added a new block

1. Add **`<!-- commentray:block id=newid -->`** in the Markdown (new id must satisfy [anchors.md](../spec/anchors.md) id rules).
2. Append a **`blocks[]`** entry with the same **`id`**, correct **`anchor`**, and matching **`sourcePath`** / file key under **`byCommentrayPath`**.
3. **`commentray validate`**.

Using the VS Code command **“Add block from selection”** creates the marker, index entry, and opens the pair—prefer that for fewer copy-paste mistakes.

### You deleted a block

1. Remove the Markdown section (including its `<!-- commentray:block … -->` line).
2. Remove the **`blocks[]`** entry (and remove **source** region markers if `marker:` was used).
3. **`commentray validate`**.

## Staleness metadata (`lastVerifiedCommit` / `lastVerifiedBlob`)

These fields are **optional signals** for “a human checked this block against Git.” They do not auto-fix anchors. When you complete a review:

- Set **`lastVerifiedCommit`** to the full SHA of `HEAD` (or the commit you verified against).
- Set **`lastVerifiedBlob`** when you want the tool to compare the current blob of `sourcePath` at `HEAD`.

If you do not use them, leave them unset; validation will not treat that as an error.

## When metadata feels “not tenable”

If maintaining **`lines:`** ranges after every edit is painful:

1. Prefer **`marker:`** anchors + regions in source for the hot spots, **or**
2. Keep **`lines:`** but run **`commentray validate`** in **pre-commit** and CI so mistakes are caught immediately, **or**
3. Use the **VS Code** flow to add blocks and validate from the editor.

Commentray does **not** silently rewrite your primary source to match stale `lines:` anchors—that is intentional. The **tenable** path is: pick an anchor strategy that matches your team’s tolerance for source markers vs line churn, then **automate validation** so inconsistency never accumulates.

## Canonical spec links

- [blocks.md](../spec/blocks.md) — block model, Markdown markers, markers, drift, staleness.
- [anchors.md](../spec/anchors.md) — `lines:`, `marker:`, `symbol:` grammar and validation rules.
- [storage.md](../spec/storage.md) — paths, Angles, where files live.

## See also (user guides)

- [Install](install.md), [Quickstart](quickstart.md), [What Commentray detects](detection.md), [CLI reference](cli.md), [Configuration](config.md), [Troubleshooting](troubleshooting.md)
