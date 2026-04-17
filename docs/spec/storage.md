# Commentray storage layout

## Repository root

- **Config**: `.commentray.toml` (TOML). Omitted keys use built-in defaults.
- **Storage root**: defaults to `.commentray/` under the repository root.

## Directories

- **`.commentray/source/`**: paired **commentray** (Markdown) for each source file—what you author _in commentray_ (see vocabulary below).
- **`.commentray/metadata/`**: Machine-oriented JSON (indices, fingerprints, diagnostics).

## Vocabulary: Commentray the tool vs commentray the writing

- **Commentray** (capital **C**): the project, CLI, editor extension, and render stack in this repository.
- **commentray** (lowercase, uncountable): the **documentation language**—the practice of keeping narrative, diagrams, and rationale in paired Markdown under `.commentray/source/` instead of bloating the primary file. You _write in commentray_, _review in commentray_, or _onboard through commentray_ alongside the code.

Example: _“We have to document our architecture in commentray so that newcomers can have an effective source code onboarding experience.”_

Implementation detail: each file is still Markdown on disk; the path layout is defined in the next section.

## Commentray file naming

Given a **repo-relative** primary file path `P` (POSIX-style, no `..` segments), the commentray Markdown path is:

```text
.commentray/source/{P}.md
```

Examples:

- `src/server.ts` → `.commentray/source/src/server.ts.md`
- `README.md` → `.commentray/source/README.md.md`

The mapping is intentionally transparent: append `.md` to the original path under a stable prefix.

This is the **single-angle (implicit default)** layout: one commentray Markdown file per primary file.

## Angles (named perspectives on the same source)

Sometimes one source file deserves **more than one** commentray: an **Introduction**, an **Architecture** walkthrough, a **Meeting notes** angle, and so on. Commentray calls these **Angles**.

### Configuration (`.commentray.toml`)

The `[angles]` table is optional:

- **`default_angle`** — Angle id selected by default in tooling and the static viewer when several exist. When `[[angles.definitions]]` is non-empty, this id must match one of the listed definitions (validated at config merge).
- **`[[angles.definitions]]`** — Optional list of `{ id, title? }` rows. Titles are for UI (switcher labels); if omitted, the id is shown.

You can set `default_angle` alone to prefer a disk angle before the definitions table is filled in.

The VS Code extension exposes **Add angle to project** (writes `[angles]` in `.commentray.toml` and creates the sentinel) and **Open commentray beside source (pick angle)** once Angles layout is enabled.

### On-disk layout: sentinel `{storage}/source/.default`

Angles use a **different directory shape** than the flat default. The switch is explicit and file-system driven:

- **No** path `{storage}/source/.default` → only the **flat** layout above (`.commentray/source/{P}.md`).
- **Any** file or directory at `{storage}/source/.default` → the repo opts into **per-source folders** under `source/`. For each repo-relative primary path `P` and Angle id `A` (see `@commentray/core` `assertValidAngleId`: `[a-zA-Z0-9_-]{1,64}`):

```text
{storage}/source/{P}/{A}.md
```

Examples (default `storage.dir = .commentray`):

- `README.md` + angle `architecture` → `.commentray/source/README.md/architecture.md`
- `src/app.ts` + angle `introduction` → `.commentray/source/src/app.ts/introduction.md`

The sentinel `.default` does not by itself pick which Angle is “default” for a file; that remains **`angles.default_angle`** in TOML (and, when definitions are empty, convention in tooling may still treat a primary angle id as configured or as the only file present).

**Migration:** existing flat files like `.commentray/source/README.md.md` do not automatically split into Angles; adopting Angles means creating the sentinel and moving or re-authoring content under `source/{P}/…`.

## GitHub Pages static browser (single `index.html`)

The Pages build emits **one** HTML file: one **code** pane (`static_site.source_file`) and one rendered **commentray** pane (intro + `static_site.commentray_markdown`). There is no built-in router for other source/commentray pairs on the same origin.

- **`[[static_site.related_github_files]]`** — optional rows with repo-relative `path` and optional `label` (defaults to the file’s basename). When `static_site.github_url` is a GitHub **repository home** URL (`https://github.com/owner/repo`), the toolbar gains **Also on GitHub** links to `…/blob/<branch>/path` so readers can jump to other Markdown or code on GitHub. Set **`static_site.github_blob_branch`** when your default branch is not `main`.
- **Search** — **Escape** clears the query and hides hit results (same as the **Clear** control).
- **Generator** — emitted HTML includes `<meta name="generator" content="Commentray @commentray/render@…; code-commentray-static@…">` so the toolchain version is visible in page metadata (omit by passing an empty `generatorLabel` from the static builder API).

## Images and other local assets (static HTML)

When commentray Markdown is rendered to static HTML (GitHub Pages, `commentray render`), `img[src]` and local `a[href]` are rewritten so links work from the output HTML file. Use normal Markdown URL rules with one extension for the **repository root**:

| You write (in commentray, `.md` on disk) | Resolves relative to                                             |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `![](/docs/diagram.svg)`                 | Repository root (`docs/diagram.svg` from the clone root)         |
| `![](./figures/diagram.svg)`             | The commentray file’s directory (usually `.commentray/source/…`) |
| `![](figures/diagram.svg)`               | Same as above (standard Markdown: relative to that file)         |

A leading **`/`** means “from the repository root” (POSIX path after the slash). Paths without a leading slash follow **CommonMark**: they are resolved from the directory that contains the commentray file, so assets can live **next to** that file or in subfolders (for example `.commentray/source/README.md.assets/` or `.commentray/source/figures/`).

**Note:** The built-in VS Code Markdown preview resolves URLs relative to the open `.md` file on disk; it does not run this HTML rewriter. The `/` versus file-relative rules above still match how the preview resolves paths when files exist on disk.

## Metadata

The default index file is:

```text
.commentray/metadata/index.json
```

It is plain JSON with a `schemaVersion` field so migrations remain explicit and auditable.
