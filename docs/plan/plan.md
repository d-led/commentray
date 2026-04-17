# Commentray monorepo — implementation plan

This document is the canonical engineering plan for the Commentray ecosystem. It is intentionally detailed: it captures product intent, storage conventions, package boundaries, testing tiers, CI posture, and security/publishing expectations.

## Product metaphor (README opening)

Commentary tracks on DVDs and streaming extras: optional audio where filmmakers explain choices, constraints, and intent **without** altering the film itself.

Commentray applies that metaphor to software and texts: the **primary artifact stays clean** (code, config, generated formats where inline notes are impossible), while explanations, rationale, warnings, and diagrams live beside it in **commentray** (paired Markdown under `.commentray/source/`), synchronized by **blocks** and **anchors** rather than by fragile line numbers alone.

The user-facing README should remain **terse and skimmable**, in the spirit of [chumak’s README](https://raw.githubusercontent.com/zeromq/chumak/refs/heads/master/README.md).

## Goals (v0)

- **Out-of-file docs** under `.commentray/` with transparent paths: `.commentray/source/<repo-relative-path>.md` (append `.md` to the original path; normalize separators; reject `..`).
- **Angles** (named perspectives): optional `[angles]` in `.commentray.toml` (`default_angle`, `[[angles.definitions]]`); on disk, multi-angle layout when `{storage}/source/.default` exists → per-source `source/{P}/{angleId}.md` (see `docs/spec/storage.md`). Static viewer and editor should expose an Angle switcher; core exposes path helpers and config merge validation today.
- **Block model**: commentray segments align to code ranges; UI layout is **code left, commentray right** (GitHub blame–style columns) with **scroll sync** while editing and viewing.
- **Anchoring & drift**: metadata records evidence (symbol names when available, line ranges, Git blob SHA, commits, timestamps). **Git is the default SCM** behind a pluggable `ScmProvider` interface (`git` CLI first).
- **Staleness**: non-blocking diagnostics for humans and automation (including LLM agents).
- **IDE**: default integration is **VS Code** (extension MVP ships in this repo).
- **Language plugins**: pluggable resolvers per language; v0 focuses on core anchor parsing + TypeScript-friendly workflows, expanding later.
- **Rendering**: `@commentray/render` provides Markdown → HTML with sanitization, highlighting, Mermaid containers, and HTML shells (simple side-by-side plus an interactive **static code browser** page).
- **Static code browser sample**: the `code-commentray-static` package emits a self-contained HTML file: highlighted code, rendered Markdown commentray, a **draggable vertical splitter**, and a **line-wrap toggle** for the code pane (client-side persistence via `localStorage`).
- **Manipulation library**: `@commentray/core` owns models, validation, migrations, and staleness helpers.
- **CLI**: `@commentray/cli` provides `init` (full idempotent setup), `init config`, `init scm` (git hooks), `validate`, `doctor`, `migrate`, `render`, and `paths`; **standalone SEA binaries** for Linux (x64, arm64), macOS (x64, arm64), and Windows (x64) are built in [`.github/workflows/binaries.yml`](../../.github/workflows/binaries.yml) and attached to GitHub Releases on `v*` tags.
- **Monorepo**: TypeScript, semantic versioning, packages start at **0.0.1**, **MPL-2.0** per published package.
- **Config**: `.commentray.toml` at repo root with sensible defaults.
- **Tooling**: Prettier for TS/JS/JSON/Markdown; ESLint for TS; Vitest at multiple tiers.
- **CI**: GitHub Actions runs quick checks broadly; expensive workflows are opt-in.
- **npm publishing**: prefer **OIDC trusted publishing** + **npm provenance**; avoid long-lived tokens.

## Non-goals (initial iterations)

- Replacing language-native doc systems (Rustdoc, Javadoc, …).
- Fully autonomous AI synchronization (ship diagnostics and machine-readable reports first).
- Every SCM backend on day one (interfaces yes; extra backends later).

## Repository layout

```text
.commentray.toml
.commentray/
  metadata/
  source/
packages/
  core/
  render/
  code-commentray-static/
  cli/
  vscode/
scripts/
  quality-gate.sh
  ci-full.sh
  format.sh
  format-check.sh
  lint.sh
  test.sh
  test-coverage.sh
  build-static-pages.mjs
docs/
  plan/plan.md
  spec/
.github/workflows/
  ci.yml
  ci-expensive.yml
  pages.yml
```

## Data flow (high level)

```mermaid
flowchart LR
  sourceFile[SourceFile]
  mdFile[CommentrayMd]
  metaJson[MetadataJson]
  scm[ScmProvider]
  lang[LanguagePlugin]
  core[CoreLibrary]
  sourceFile --> scm
  sourceFile --> lang
  mdFile --> core
  metaJson --> core
  scm --> core
  lang --> core
  core --> diagnostics[StaleAndBrokenReports]
```

## Normative specs (docs)

- Storage paths: [`docs/spec/storage.md`](../spec/storage.md)
- Anchor grammar: [`docs/spec/anchors.md`](../spec/anchors.md)
- Blocks: [`docs/spec/blocks.md`](../spec/blocks.md)

## Dogfood commentray

This repository keeps **terse** commentray beside selected sources under [`.commentray/source/`](../../.commentray/source/) (path = repo-relative primary + `.md`, e.g. this file → [`plan.md.md`](../../.commentray/source/docs/plan/plan.md.md)). Those notes are for contributors skimming the tree in an editor or on GitHub; they intentionally overlap only lightly with this plan and link out to specs and workflows.

## Packages

| Package                  | Responsibility                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `@commentray/core`       | Types, JSON validation, migrations, Git SCM adapter, anchor parsing, staleness                       |
| `@commentray/render`     | remark/rehype pipeline, sanitize, highlight, Mermaid, HTML shells (incl. interactive static browser) |
| `code-commentray-static` | Sample static site generator: one HTML file, resizable panes, code wrap toggle                       |
| `@commentray/cli`        | CLI commands and CI-friendly exit codes                                                              |
| `commentray-vscode`      | Editor UX: paired panes, scroll sync prototype, workspace validation output channel                  |

## Configuration (`.commentray.toml`)

Defaults (illustrative):

- `storage.dir = ".commentray"`
- `scm.provider = "git"`
- `render.mermaid = true`
- `render.syntaxTheme = "github-dark"`
- `anchors.defaultStrategy = ["symbol", "lines"]`
- **`[angles]`** (optional): `default_angle`, `[[angles.definitions]]` with `id` / `title` for UI; ids validated; duplicate ids and default not in definitions are errors when definitions is non-empty.
- **`[static_site]`** (optional): drives the GitHub Pages build (`npm run pages:build` → `_site/index.html`):
  - `title` — browser / toolbar title for the static code browser page
  - `intro` — Markdown prepended in the commentray pane (before the GitHub link and optional file body)
  - `github_url` — URL for a “View repository on GitHub” link
  - `source_file` — repo-relative path whose contents fill the **code** pane (default `README.md`)
  - `commentray_markdown` — optional repo-relative path to extra Markdown appended in the commentray pane

Implementation note: configuration parsing uses `@iarna/toml` today; dependency choices should be revisited periodically for maintenance and security posture.

## Static code browser (`code-commentray-static`)

- **Purpose**: dogfood and demo a file-plus-commentray reading experience without a server.
- **Implementation**: `renderCodeBrowserHtml` lives in `@commentray/render`; `code-commentray-static` wires fixtures + CLI (`npm run site -w code-commentray-static`) and writes to `packages/code-commentray-static/site/` (gitignored).
- **GitHub Pages**: root script `npm run pages:build` reads `.commentray.toml` `[static_site]`, composes commentray content (intro + GitHub link + optional file), and emits `_site/index.html` via `scripts/build-static-pages.mjs`. Workflow `.github/workflows/pages.yml` runs on `main` + `workflow_dispatch` using `actions/upload-pages-artifact` + `actions/deploy-pages` (repository **Settings → Pages → Build: GitHub Actions**).
- **UX**: movable vertical bar (mouse drag), “Wrap code lines” checkbox, Highlight.js themes via CDN, Markdown + Mermaid (optional).
- **Quick search**: client-side whole-source ordered tokens plus per-line fuzzy ranking (bundled client); see `packages/render` implementation.

## Markdown rendering stack

- Baseline: **remark** + **GFM** + **rehype** stringify.
- Sanitization: **rehype-sanitize** with an explicit allowlist extension for highlighting classes.
- Highlighting: **rehype-highlight** (lowlight grammar ecosystem).
- Mermaid: fenced `mermaid` blocks become `<pre class="mermaid"><code>…</code></pre>`; optional CDN runtime injection for HTML previews.

## Testing matrix (Vitest)

- **Unit**: `vitest.config.ts` (fast, default local + CI quick path).
- **Integration**: `vitest.integration.config.ts` (Git fixture repos).
- **Expensive**: `vitest.expensive.config.ts` (reserved for fuzz/perf/large-repo simulations).
- **Coverage**: `npm run test:coverage` (unit + HTML/`lcov`/`json-summary` under `./coverage/`, opens `coverage/index.html` when possible); `npm run test:coverage:all` includes integration tests (requires a working `git` CLI).

## Scripts policy

Every recurring workflow exists as:

- an **`npm run …`** task at the repo root, and/or
- a **`scripts/*.sh`** entry that resolves the repo root from the script location and `cd`s there.

## GitHub Actions

- `ci.yml`: `npm ci`, optional `npm audit` (informational), `bash scripts/quality-gate.sh`, `npm run test:integration`.
- `ci-expensive.yml`: `workflow_dispatch` and PR label `run-expensive-ci`, runs `npm run test:expensive`.
- `pages.yml`: `npm run pages:build` then deploy `_site/` to **GitHub Pages** (on `main` and manual dispatch).

Maintainers can tighten expensive jobs later using GitHub Environments and required reviewers.

## Licensing

Root `LICENSE` is MPL-2.0 (Mozilla template). Each publishable package includes its own `LICENSE` copy for npm packaging clarity.

## Contribution guide

`CONTRIBUTING.md` states the C4 aspiration (via the chumak reference) and the pragmatic, incremental reality.

## Open technical choices (next iterations)

1. **Language intelligence**: expand beyond minimal anchors using tree-sitter and/or LSP-backed resolvers.
2. **VS Code**: evolve toward webview preview parity with `@commentray/render` output and richer block gutter UX.
3. **Angles rollout**: static code browser (`build-static-pages.mjs`, client bundle) loads multiple Angle bodies and adds a switcher; VS Code opens/picks the correct `source/{P}/{angle}.md`; `index.json` / scroll-sync may key blocks by `(sourcePath, angleId)` in a forward-compatible migration.

## Documentation roadmap (pending)

The plan doc, the specs under `docs/spec/`, and README/CONTRIBUTING cover engineering. Two user-facing pieces are still missing and are tracked here:

1. **User docs — terse but usable**: a `docs/user/` tree, each page short and runnable-command-first, in the spirit of the README.
   - `docs/user/install.md` — install a release binary (macOS quarantine note), or `npm i -g @commentray/cli`, or build from source.
   - `docs/user/quickstart.md` — `commentray init`, write first `.commentray/source/<file>.md`, run `commentray validate`, open pairing in the editor.
   - `docs/user/cli.md` — condensed reference for `init`, `init config`, `init scm`, `validate`, `doctor`, `migrate`, `render`, `paths`; exit codes; env vars (`COMMENTRAY_EDITOR`, `COMMENTRAY_SEA_NODE`).
   - `docs/user/config.md` — every `.commentray.toml` key with a one-line explanation and the default.
   - `docs/user/troubleshooting.md` — common failure modes (missing `.git`, Homebrew Node + SEA, quarantine, stale metadata after rebase).
   - README links into this tree; each page stays short enough to read in one screen.

2. **Detection matrix doc**: `docs/user/detection.md` — what is caught **where**, and where the gaps are. Outline:
   - **Pre-commit hook (`commentray init scm`)**: runs `commentray validate` against the working tree from the `pre-commit` stage; scope is whatever `validate` scans (full repo today, candidate for staged-files-only in a later pass); exits non-zero on schema errors and broken anchors so the commit is blocked; hook is a marked idempotent block, safe alongside other hooks.
   - **CLI `commentray validate`** (no hook, no editor): schema validation of `.commentray/metadata/index.json`, anchor integrity (symbol present, line range still in file), and staleness evidence via the Git SCM adapter (blob SHA / last-known commit) for every recorded source file. Non-zero exit on errors; warnings do not fail. Run manually or in CI.
   - **CLI `commentray doctor`**: `validate` plus environment checks (`.git` present in the working directory, Git CLI reachable, Node engine acceptable). Intended for pre-flight troubleshooting, not CI gating.
   - **CLI `commentray migrate`**: offline schema migration of the metadata index (e.g. legacy `commentaryPath` → `commentrayPath`); runs without touching SCM.
   - **Editor extension (`commentray-vscode`)**: paired-pane opening, bidirectional scroll sync (block-aware when `index.json` + markers align), “add block from selection”, and workspace validation output channel today; richer live gutter diagnostics are on the roadmap. Catches what you see while editing; does **not** replace hooks or CI.
   - **What is not yet detected (known gaps, linkable to issues when filed)**: cross-file refactors (symbol moved to another file without Git rename), deletions of commentary's source file without matching cleanup, staleness against a non-default branch, and large-scale content drift that needs content hashing beyond blob SHA. Mitigations: run `validate` in CI on PRs, require `run-expensive-ci` for fuzzed/large fixture suites, and plan follow-ups per gap.

Both pieces are documentation-only and can land incrementally (install + quickstart first, then the detection matrix, then the rest).

## Implementation status (living)

This repository contains an initial vertical slice: monorepo scaffolding, core library, renderer, static code browser sample (`code-commentray-static`), CLI, VS Code MVP, tiered Vitest configs, and baseline GitHub Actions.

Next steps are intentionally incremental: expand metadata richness, improve anchor resolution plugins, tighten editor diagnostics, and add more integration coverage as real repositories adopt Commentray.
