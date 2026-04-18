# Quickstart

Goal: a **clean primary file** stays in place; **commentray** (Markdown under `.commentray/source/`) holds the narrative, tied together by config and optional **blocks** in the metadata index.

## Prerequisites

- A **Git** checkout (recommended): hooks and many diagnostics assume `.git` exists.
- The **CLI** installed one of the ways described in [Install](install.md).

Commands below assume your **shell’s current directory** is the **repository root** (or a subdirectory—Commentray walks up for `.commentray.toml`, then `.git`, then falls back to cwd for first-time `init`).

## 1. Initialize the workspace

```bash
commentray init
```

This is **idempotent**: it ensures `.commentray/`, a starter **`.commentray/metadata/index.json`** if missing, **`.commentray.toml`** if missing, refreshes index migrations, merges the **Commentray** VS Code extension into `.vscode/extensions.json` when safe, and runs **`commentray validate`**. Exit code **1** means validation reported **errors** (fix them before relying on CI or hooks).

Optional: install the **pre-commit** fragment so commits run validate when `commentray` is on `PATH`:

```bash
commentray init scm
```

## 2. Open the paired commentray path for a source file

Convention: **flat** layout (no `{storage}/source/.default`): repo-relative primary path `P` → **`.commentray/source/{P}.md`** (append `.md` to `P`; POSIX slashes; no `..`). **Angles** layout (sentinel present): **`.commentray/source/{P}/{angle}.md`**. Examples (flat):

- `README.md` → `.commentray/source/README.md.md`
- `src/app.ts` → `.commentray/source/src/app.ts.md`

To move an existing flat tree to Angles folders and `[angles]` in one step: **`commentray migrate-angles`** (use `--dry-run` first; see [storage spec](../spec/storage.md)).

Print the path for any file:

```bash
commentray paths src/app.ts
```

Create the Markdown file (empty is fine to start). Write prose under optional **`<!-- commentray:block id=… -->`** markers when you use blocks; see [Keeping blocks in sync](keeping-blocks-in-sync.md).

## 3. Validate

```bash
commentray validate
```

**0** = no errors (warnings may still print). **1** = schema, anchors, markers, or other **errors**—see messages on stderr.

For environment hints (e.g. missing `.git`):

```bash
commentray doctor
```

## 4. Edit in the editor

Install **`d-led.commentray-vscode`** ([Install](install.md)). Use commands such as **Open commentray beside source** and **Add block from selection** where available; validation output appears in a **Commentray** output channel.

## Where to go next

| Topic                              | Doc                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Blocks, index, anchors             | [Keeping blocks in sync](keeping-blocks-in-sync.md)                                                                |
| What runs where (hook, CI, editor) | [What Commentray detects](detection.md)                                                                            |
| All CLI commands                   | [CLI reference](cli.md)                                                                                            |
| `.commentray.toml` keys            | [Configuration](config.md)                                                                                         |
| Normative detail                   | [`docs/spec/storage.md`](../spec/storage.md), [`anchors.md`](../spec/anchors.md), [`blocks.md`](../spec/blocks.md) |
