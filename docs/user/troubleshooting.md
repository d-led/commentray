# Troubleshooting

Short answers for the most common friction. For the **operational contract** on blocks and anchors, see [Keeping blocks in sync](keeping-blocks-in-sync.md).

## `commentray validate` fails after I “only” edited prose

- **Markdown marker ↔ index:** Every **`<!-- commentray:block id=… -->`** must match **`blocks[].id`** in **`.commentray/metadata/index.json`** for that companion file.
- **`lines:` anchors:** Line insertions or deletions in the **source** file can invalidate stored ranges—update **`anchor`** (and optional **`snippet`**) or switch to **`marker:`** regions for moving targets.

## `commentray init scm` says there is no `.git`

Initialize Git first (`git init`) or run the command from the **repository root** that contains **`.git`**.

## Pre-commit never runs Commentray

- Confirm **`commentray`** is on **`PATH`** in the same environment Git uses for hooks (GUI clients sometimes differ).
- Open **`.git/hooks/pre-commit`** and verify the **Commentray** block is present and not short-circuited by an earlier **`exit`**.

## macOS blocks the downloaded CLI binary

See [Install → macOS Gatekeeper](install.md#macos-gatekeeper).

## `COMMENTRAY_SEA_NODE` / binary build complaints

Local **SEA** builds want a Node layout compatible with the bundling step. Point **`COMMENTRAY_SEA_NODE`** at a **nodejs.org**-style binary matching CI’s major version. Details: root [`README.md` → Standalone CLI binaries](../../README.md#standalone-cli-binaries).

## Extension does not open the file I expect

- **Angles:** If **`.commentray/source/.default`** exists, paths are **`source/{primaryPath}/{angle}.md`**—not the flat **`{primaryPath}.md`** layout. See [`docs/spec/storage.md`](../spec/storage.md).
- Run **`commentray paths my/file.ts`** to print the conventional flat path; compare with your **`.commentray.toml`** and on-disk layout.

## Still stuck

Run **`commentray doctor`** from the repo root and read the combined **`validate`** + environment messages. For behavior definitions, see [What Commentray detects](detection.md) and the specs linked from [Quickstart](quickstart.md).
