# What Commentray detects (and where)

Commentray spreads checks across **local hooks**, **CLI**, and the **editor**. Each layer catches different failures at different moments. None of them replace the others: use **hooks + CI** for hard guarantees, **validate** for scripts, **doctor** for troubleshooting, and the **extension** for feedback while you type.

## Pre-commit hook (`commentray init scm`)

- **When:** Every `git commit`, at **pre-commit** stage, if the hook block is present and **`commentray`** is on `PATH`.
- **What:** Runs **`commentray validate`** against the working tree (same scope as standalone validate today—**full project** scan, not staged-only yet).
- **Exit:** Non-zero on **errors** (schema, broken anchors, marker pairing, and similar)—the commit is blocked. Warnings do not fail the hook.
- **Coexistence:** The fragment is a **marked, idempotent block** inside `.git/hooks/pre-commit`; it is safe alongside other hook logic if you merge hooks carefully.

## CLI `commentray validate`

- **When:** You run it manually, in CI, or from the pre-commit hook.
- **What:** Schema validation for **`.commentray/metadata/index.json`**, anchor integrity (including symbol presence and line ranges where applicable), marker pairing and uniqueness rules, alignment between index keys and paths, and staleness evidence via the **Git** SCM adapter (blob SHA / last-known commit fields) for recorded sources.
- **Exit:** **0** if there are no **errors**; **1** if any error exists. Warnings print but do not change exit code.
- **Scope:** Full repo scan (staged-files-only optimization is a possible future improvement).

## CLI `commentray doctor`

- **When:** Preflight before filing an issue or onboarding a machine.
- **What:** Everything **`validate`** does, plus light **environment** checks (for example: is **`.git`** present under cwd, can Git be used for SCM-backed checks).
- **Exit:** Same contract as **`validate`** for validation failures; extra environment messages are advisory.

## CLI `commentray migrate`

- **When:** After upgrades when the index **schema** or snippet normalization changes; also applied on many read paths automatically.
- **What:** **Offline** rewrite of **`.commentray/metadata/index.json`** only (for example legacy field renames). Does **not** touch Git state, source files, or **Angles** filesystem layout.

## CLI `commentray migrate-angles`

- **When:** You want to opt into **Angles** on disk from an existing **flat** `.commentray/source/{P}.md` tree.
- **What:** Moves companions to `{storage}/source/{P}/{angle}.md`, writes the **`.default`** sentinel, merges **`[angles]`** into `.commentray.toml`, rewrites **`[static_site].commentray_markdown`** when it pointed at a moved file, and updates **`index.json`** keys. Use **`--dry-run`** first. Normative detail: [`docs/spec/storage.md`](../spec/storage.md).

## Editor extension (`commentray-vscode`)

- **When:** While editing in VS Code or Cursor.
- **What:** Open paired commentray, **bidirectional scroll sync** (block-aware when **index.json** and Markdown markers align), **add block from selection**, workspace validation in an **output channel**.
- **Exit:** N/A—this is interactive. It does **not** replace hooks or CI for blocking bad commits.

## Known gaps (policy, not silent bugs)

These are intentionally **out of scope** for v0 or not implemented yet; track mitigations in your own process:

- **Cross-file refactors:** Symbol moved to another file without a Git rename Commentray understands—anchors may need manual updates.
- **Orphan commentray:** Primary source removed but companion Markdown or index entries left behind—`validate` flags inconsistencies when paths and anchors no longer line up; there is no automatic deletion policy.
- **Non-default branches:** Staleness evidence is oriented around the **Git** checkout you have; comparing against arbitrary remote branches is not the default story.
- **Content beyond blob SHA:** Large narrative drift without line/symbol/marker changes may not surface until humans re-read or you adopt richer review metadata.

**Mitigations:** run **`commentray validate` in CI** on pull requests; use **`commentray doctor`** locally; keep blocks aligned per [Keeping blocks in sync](keeping-blocks-in-sync.md); use the extension for fast feedback.

## Related

- [CLI reference](cli.md) — exit codes and flags.
- [Install](install.md) — hook and editor setup.
