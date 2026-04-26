# CLI reference

All commands resolve the **repository root** from the current working directory: nearest **`.commentray.toml`**, else nearest **`.git`**, else **cwd** (so first-time **`commentray init`** can bootstrap a fresh folder).

**How to invoke:** global **`commentray`** (see [Install](install.md)), a project **`node_modules/.bin/commentray`**, or **`npx commentray`** for a one-off run against the published package. **`npx commentray --help`** (or **`commentray --help`** when on `PATH`) prints **`Usage: commentray [options] [command]`** and lists subcommands.

**`commentray <command> --help`** lists flags for that command.

## Commands

| Command                                 | Purpose                                                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`commentray init`**                   | Idempotent setup: storage dirs, `index.json` if missing, `.commentray.toml` if missing, VS Code extension recommendation merge when mergeable, index migrations, then **`validate`**. |
| **`commentray init config`**            | Write commented **`.commentray.toml`** defaults. **`--force`** replaces an existing file.                                                                                             |
| **`commentray init scm`**               | Install or refresh the **pre-commit** block that runs **`commentray validate`** (requires **`.git`**).                                                                                |
| **`commentray validate`**               | Schema, anchors, markers, index keys, SCM-backed checks.                                                                                                                              |
| **`commentray doctor`**                 | **`validate`** plus environment hints (e.g. missing **`.git`**).                                                                                                                      |
| **`commentray migrate`**                | Rewrite **`index.json`** to the current schema / normalization on disk.                                                                                                               |
| **`commentray sync-moved-paths`**       | Rewrite index paths using **Git rename detection** between **`--from`** and **`--to`** tree-ish (defaults `HEAD~1` → `HEAD`). **`--dry-run`** lists without writing.                  |
| **`commentray convert-source-markers`** | Rewrite **`marker:`** region delimiters in a **source** file to match a VS Code **language** id. **`--file`** (repo-relative), **`--language`**, optional **`--dry-run`**.            |
| **`commentray paths <file>`**           | Print conventional **commentray** Markdown path for a repo-relative **source** file.                                                                                                  |
| **`commentray render`**                 | Side-by-side HTML. **`--source`**, **`--markdown`**, **`--out`** default from **`[static_site]`** and conventions; **`--mermaid`** injects runtime.                                   |

## Exit codes

| Code  | When                                                                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Success: no validation **errors** for validate-style commands; nothing to do; dry-run completed.                                                                                                           |
| **1** | Validation **errors**; missing **`index.json`** where required; **`init scm`** without **`.git`**; **`sync-moved-paths`** / **`convert-source-markers`** failures (Git errors, missing file, and similar). |

Warnings from **`validate`** / **`doctor`** do **not** force exit **1**.

## Environment variables

| Variable                  | Used for                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`COMMENTRAY_EDITOR`**   | Repo scripts that launch an editor (`code` vs `cursor`, etc.). See root [`README.md`](../../README.md).                                                                                                         |
| **`COMMENTRAY_SEA_NODE`** | Local **standalone binary** builds: point at a **nodejs.org**-style Node binary when Homebrew’s Node is unsuitable. See [Development → Building binaries locally](../development.md#building-binaries-locally). |

## See also

- [Configuration](config.md) — `.commentray.toml`.
- [What Commentray detects](detection.md) — hook vs CLI vs editor.
