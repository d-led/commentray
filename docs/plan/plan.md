# Commentray monorepo — implementation plan

This document is the engineering plan for the Commentray ecosystem: product intent, component boundaries, backlog, and CI/testing posture. **Authoritative package names, scripts, and defaults** live in the repo tree and [`README.md`](../../README.md); see §Documentation hierarchy.

## Product metaphor (README opening)

Commentary tracks on DVDs and streaming extras: optional audio where filmmakers explain choices, constraints, and intent **without** altering the film itself.

Commentray applies that metaphor to software and texts: the **primary artifact stays clean** (code, config, generated formats where inline notes are impossible), while explanations, rationale, warnings, and diagrams live beside it in **commentray** (paired Markdown under `.commentray/source/`), synchronized by **blocks** and **anchors** rather than by fragile line numbers alone.

The user-facing README should remain **terse and skimmable**, in the spirit of [chumak’s README](https://raw.githubusercontent.com/zeromq/chumak/refs/heads/master/README.md).

## Documentation hierarchy (avoid duplication)

- **Canonical truth** lives in the **source tree** (`packages/`, `scripts/`, `.github/workflows/`, root `package.json`, extension `package.json`, `.commentray.toml`) and in **normative specs** under [`docs/spec/`](../spec/) plus [`README.md`](../../README.md) and [`CONTRIBUTING.md`](../../CONTRIBUTING.md). When facts disagree, fix those places—not a narrative file.
- **This plan** carries **intent**, boundaries, backlog, and high-level CI/testing posture. It should **link** to README, specs, and workflows instead of growing a second package inventory, command cheat sheet, or full default-config dump.
- **Commentray** under [`.commentray/source/`](../../.commentray/source/) is **optional narrative** beside a primary file: rationale, mental models, pointers. It must **not** restate authoritative lists (workspaces, CI matrix, every `npm run`). Prefer one sentence plus a link to the file on the left or to specs.

## Goals (v0)

- **Out-of-file docs** under `.commentray/` with transparent paths: `.commentray/source/<repo-relative-path>.md` (append `.md` to the original path; normalize separators; reject `..`).
- **Angles** (named perspectives): optional `[angles]` in `.commentray.toml` (`default_angle`, `[[angles.definitions]]`); on disk, multi-angle layout when `{storage}/source/.default` exists → per-source `source/{P}/{angleId}.md` (see [`docs/spec/storage.md`](../spec/storage.md)). **Shipped:** `@commentray/core` path resolution + TOML validation; **VS Code** — **Commentray: Add angle to project (updates .commentray.toml)** (`commentray.addAngleDefinition`) enables layout and registers an angle in TOML; **Commentray: Open commentray beside source (pick angle)** (`commentray.openCommentrayAngle`) opens `source/{P}/{angle}.md` (command titles in [`packages/vscode/package.json`](../../packages/vscode/package.json)). **`@commentray/render` / static HTML:** no Angle switcher and no multi-angle bundle; `[static_site].commentray_markdown` is a single file path until the static viewer ships a switcher.
- **Block model**: commentray segments align to code ranges; UI layout is **code left, commentray right** with **scroll sync** while editing and viewing; on the web, optional **block stretch layout** uses a two-column table with **one paired row per block** (blame-style row height; no `rowspan`) so code and commentary stay vertically aligned; when stretch is off or blocks are missing, **block-aware scroll sync** still uses index + `<!-- commentray:block id=… -->` markers in the Markdown pane.
- **Anchoring & drift**: metadata records evidence (symbol names when available, line ranges, Git blob SHA, commits, timestamps). **Git is the default SCM** behind a pluggable `ScmProvider` interface (`git` CLI first).
- **Staleness**: non-blocking diagnostics for humans and automation (including LLM agents).
- **IDE**: default integration is **VS Code** (extension MVP ships in this repo).
- **Language plugins**: pluggable resolvers per language; v0 focuses on core anchor parsing + TypeScript-friendly workflows, expanding later.
- **Rendering**: `@commentray/render` provides Markdown → HTML with sanitization, highlighting, Mermaid containers, and HTML shells (simple side-by-side plus an interactive **static code browser** page).
- **Static code browser sample**: the `@commentray/code-commentray-static` package emits a self-contained HTML file: highlighted code, rendered Markdown commentray, a **draggable vertical splitter**, and a **line-wrap toggle** for the code pane (client-side persistence via `localStorage`).
- **Manipulation library**: `@commentray/core` owns models, validation, migrations, and staleness helpers.
- **CLI**: `@commentray/cli` provides `init` (full idempotent setup), `init config`, `init scm` (git hooks), `validate`, `doctor`, `migrate`, `render`, and `paths`; **standalone SEA binaries** for Linux (x64, arm64), macOS (x64, arm64), and Windows (x64) are built in [`.github/workflows/binaries.yml`](../../.github/workflows/binaries.yml). CI workflow **artifacts expire** (14-day retention); **`v*`** tags attach binaries to **GitHub Releases** as the long-lived distribution surface (GitHub’s release asset store).
- **Monorepo**: TypeScript, semantic versioning, packages start at **0.0.1**, **MPL-2.0** per published package.
- **Config**: `.commentray.toml` at repo root with sensible defaults.
- **Tooling**: Prettier for TS/JS/JSON/Markdown; ESLint for TS; Vitest at multiple tiers.
- **CI**: GitHub Actions runs quick checks broadly; expensive workflows are opt-in.
- **npm publishing**: **manual** from maintainer machines with **2FA** (not from GitHub Actions for now); prefer **OIDC trusted publishing** + **npm provenance** if automation is added later; avoid long-lived tokens.

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
  binaries.yml
  ci.yml
  ci-expensive.yml
  e2e.yml
  pages.yml
.gitlab-ci.yml
cypress/
  e2e/
  support/
vitest.config.ts
vitest.integration.config.ts
vitest.expensive.config.ts
vitest.coverage.config.ts
vitest.shared.ts
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

This repository keeps **terse** commentray beside selected sources under [`.commentray/source/`](../../.commentray/source/) (path = repo-relative primary + `.md`, e.g. this file → [`plan.md.md`](../../.commentray/source/docs/plan/plan.md.md)). Per §Documentation hierarchy, those files add **narrative only**—they do not replace [`README.md`](../../README.md), specs, or workflow YAML; they link out instead of copying inventories.

## Packages and configuration

- **Packages / workspaces** — See [`README.md` → What’s in this repo](../../README.md#whats-in-this-repo) and root [`package.json`](../../package.json) `workspaces`. Implementation lives under `packages/*/`.
- **`.commentray.toml`** — Key semantics, Angles, and `[static_site]` fields are specified in [`docs/spec/storage.md`](../spec/storage.md) (and related specs). Defaults and comments live in the repo’s [`.commentray.toml`](../../.commentray.toml); parsing and merge rules in [`packages/core/src/config.ts`](../../packages/core/src/config.ts). Dependency: `@iarna/toml` (revisit periodically for maintenance and security).

## Static code browser (`@commentray/code-commentray-static`)

- **Purpose**: dogfood and demo a file-plus-commentray reading experience without a server.
- **Implementation**: `renderCodeBrowserHtml` lives in `@commentray/render`; `@commentray/code-commentray-static` wires fixtures + CLI (`npm run site -w @commentray/code-commentray-static`) and writes to `packages/code-commentray-static/site/` (gitignored).
- **GitHub Pages**: root script `npm run pages:build` reads `.commentray.toml` `[static_site]`, composes commentray content (intro + GitHub link + optional file), and emits `_site/index.html` via `scripts/build-static-pages.mjs`. Workflow `.github/workflows/pages.yml` runs on `main` + `workflow_dispatch` using `actions/upload-pages-artifact` + `actions/deploy-pages` (repository **Settings → Pages → Build: GitHub Actions**).
- **UX**: movable vertical bar (mouse drag), “Wrap code lines” checkbox, **scroll sync**: when `pages:build` finds `index.json` blocks for the configured `(source_file, commentray_markdown)` pair and Markdown has matching `<!-- commentray:block id=… -->` markers, the page can use **block stretch** (single-scroll blame-style table) plus index-backed block scroll links; otherwise panes use **proportional** sync. Highlight.js themes via CDN, Markdown + Mermaid (optional); `<meta name="generator">` records `@commentray/render` + `@commentray/code-commentray-static` versions (override via `buildCommentrayStatic({ generatorLabel })`).
- **Code pane line numbers:** Each **logical** source line is one `.code-line` row: a grid with `.ln` (the number) and a per-line highlighted `<pre><code>` from Highlight.js. **Done (v0):** wrapped rows use **`align-items: start`** (not `baseline`) in [`packages/render/src/code-browser.ts`](../../packages/render/src/code-browser.ts) so numbers stay top-aligned with each row. **Model limit:** one number per **logical** line, not per wrapped visual sub-line; a per-screen-line gutter would need a different layout.
- **Quick search**: client-side whole-source ordered tokens plus per-line fuzzy ranking (bundled client); **Escape** clears search; see `packages/render` implementation.

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

- `ci.yml` (push + PR): `npm ci`, optional `npm audit` (informational), `bash scripts/quality-gate.sh`, `npm run test:integration`. Matrix: Node **20.x** and **22.x**.
- `ci-expensive.yml`: manual **`workflow_dispatch`** or PR labeled **`run-expensive-ci`** → `npm run build` then `npm run test:expensive`.
- `pages.yml`: `npm run pages:build` then deploy `_site/` to **GitHub Pages** (push to `main` or **`workflow_dispatch`**). Repo **Settings → Pages → Build: GitHub Actions**. Includes a step to delete stale `github-pages` artifacts when re-runs collide with `deploy-pages`.
- `binaries.yml`: **`workflow_dispatch`** or push of tag **`v*`** → builds Node **SEA** CLI artifacts per OS/arch; workflow artifacts use short retention; **Release** assets on tags are the durable download surface (see README).

**Browser E2E (Cypress):** **not** part of `ci.yml`. Run locally with **`npm run e2e`** (requires Chrome; see README). **`e2e.yml`** runs after a successful **`ci`** workflow (see [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml)): `cypress/included`, JUnit under `test-results/`, artifacts, and optional Checks reporting—so quick CI stays Node-only while browser coverage still gates merges.

**Local “full” CI (no e2e):** `npm run ci:full` → `scripts/ci-full.sh` runs `quality-gate.sh`, then integration tests, then expensive tests—handy before a large merge; still does not run Cypress.

Maintainers can tighten expensive jobs later using GitHub Environments and required reviewers.

## Licensing

Root `LICENSE` is MPL-2.0 (Mozilla template). Each publishable package includes its own `LICENSE` copy for npm packaging clarity.

## Contribution guide

`CONTRIBUTING.md` states the C4 aspiration (via the chumak reference) and the pragmatic, incremental reality.

## Open technical choices (next iterations)

1. **Language intelligence**: expand beyond minimal anchors using tree-sitter and/or LSP-backed resolvers.
2. **VS Code**: (a) **Synchronized scroll** — tighten the paired-pane experience: bidirectional stability, block-aware jumps with large `index.json`, long files, wrapped editors, and edge cases around `revealRange` / debounced rebuilds (`packages/vscode/src/extension.ts`, `packages/core/src/scroll-sync.ts`). (b) **Extension E2E** — add automated tests **inside VS Code** (e.g. `@vscode/test-electron` or the recommended integration-test harness) that open a fixture workspace, exercise scroll sync, and assert visible ranges or block alignment; this is **separate** from repository **Cypress** E2E for the static HTML site (`cypress/e2e/`, `e2e.yml`). (c) Webview preview parity with `@commentray/render` output and richer block gutter UX.
3. **Angles rollout (remaining)**: static code browser (`build-static-pages.mjs`, client bundle) should load multiple Angle bodies and add a switcher; VS Code already opens the correct `source/{P}/{angle}.md` when Angles layout is on. **Tooling:** add a **flat → Angles** migrator (move/rename Markdown, rewrite `index.json` keys, optional TOML)—today manual only. **Search:** extend Pages nav JSON (and any hub UI) so all angle files for the visible `source_file` are included—today requires **non-empty index** listing each `commentrayPath`, or new on-disk discovery. Forward-looking: `index.json` / scroll-sync keyed by `(sourcePath, angleId)` if metadata needs first-class support beyond separate files.

## Documentation roadmap (pending)

The plan doc, the specs under `docs/spec/`, and README/CONTRIBUTING cover engineering. Two user-facing pieces are still missing and are tracked here:

1. **User docs — terse but usable**: a `docs/user/` tree, each page short and runnable-command-first, in the spirit of the README. **Started:** [`docs/user/keeping-blocks-in-sync.md`](../user/keeping-blocks-in-sync.md) (index, markers, anchors—operational contract).
   - `docs/user/install.md` — install a release binary (macOS quarantine note), or `npm i -g @commentray/cli`, or build from source.
   - `docs/user/quickstart.md` — `commentray init`, write first `.commentray/source/<file>.md`, run `commentray validate`, open pairing in the editor.
   - `docs/user/cli.md` — condensed reference for `init`, `init config`, `init scm`, `validate`, `doctor`, `migrate`, `render`, `paths`; exit codes; env vars (`COMMENTRAY_EDITOR`, `COMMENTRAY_SEA_NODE`).
   - `docs/user/config.md` — every `.commentray.toml` key with a one-line explanation and the default.
   - `docs/user/troubleshooting.md` — short FAQ (operational notes; link from README when added).
   - README links into this tree; each page stays short enough to read in one screen.

2. **Detection matrix doc**: `docs/user/detection.md` — what is caught **where**, and where the gaps are. Outline:
   - **Pre-commit hook (`commentray init scm`)**: runs `commentray validate` against the working tree from the `pre-commit` stage; scope is whatever `validate` scans (full repo today, candidate for staged-files-only in a later pass); exits non-zero on schema errors and broken anchors so the commit is blocked; hook is a marked idempotent block, safe alongside other hooks.
   - **CLI `commentray validate`** (no hook, no editor): schema validation of `.commentray/metadata/index.json`, anchor integrity (symbol present, line range still in file), and staleness evidence via the Git SCM adapter (blob SHA / last-known commit) for every recorded source file. Non-zero exit on errors; warnings do not fail. Run manually or in CI.
   - **CLI `commentray doctor`**: `validate` plus environment checks (`.git` present in the working directory, Git CLI reachable, Node engine acceptable). Intended for pre-flight troubleshooting, not CI gating.
   - **CLI `commentray migrate`**: offline schema migration of the metadata index (e.g. legacy `commentaryPath` → `commentrayPath`); runs without touching SCM.
   - **Editor extension (`commentray-vscode`)**: paired-pane opening, bidirectional scroll sync (block-aware when `index.json` + markers align), “add block from selection”, and workspace validation output channel today; **scroll UX** and **extension E2E** are planned improvements (see §Open technical choices item 2 and gaps **VS Code scroll sync + extension E2E**). Richer live gutter diagnostics are on the roadmap. Catches what you see while editing; does **not** replace hooks or CI.
   - **What is not yet detected (known gaps, linkable to issues when filed)**: cross-file refactors (symbol moved to another file without Git rename), deletions of commentary's source file without matching cleanup, staleness against a non-default branch, and large-scale content drift that needs content hashing beyond blob SHA. Mitigations: run `validate` in CI on PRs, require `run-expensive-ci` for fuzzed/large fixture suites, and plan follow-ups per gap.

Both pieces are documentation-only and can land incrementally (install + quickstart first, then the detection matrix, then the rest).

## Implementation status (living)

**In place today:** monorepo scaffolding; `@commentray/core` (paths, index schema, migrations, Git SCM, anchors, staleness, scroll/block helpers, Angles resolution); `@commentray/render` (sanitize, highlight, Mermaid, static code browser HTML + client search/sync, line-gutter alignment fix for wrapped rows); `@commentray/code-commentray-static`; `@commentray/cli` (init family, validate, doctor, migrate, render, paths, SEA binaries workflow); `commentray-vscode` (paired panes, block-from-selection, validation channel, block-aware scroll when index + markers agree, Angles commands); tiered Vitest; `quality-gate.sh` on every push/PR; optional expensive CI; GitHub Pages via `pages.yml`; **Cypress on GitHub** — [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) runs after a successful [`ci.yml`](../../.github/workflows/ci.yml) `ci` workflow (`pages:build` + Cypress in `cypress/included`); locally **`npm run e2e`** / **`npm run cy`** (see README). **GitLab** still runs `npm run e2e` in [`.gitlab-ci.yml`](../../.gitlab-ci.yml) for teams using that mirror.

**Gaps and follow-ups (engineering, not duplicate of Open technical choices):**

| Area                                    | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dogfood `index.json`**                | This repo’s `.commentray/metadata/index.json` is intentionally minimal (`byCommentrayPath` empty). The live Pages build only enables **block stretch** when the static pair (`source_file`, `commentray_markdown`) has matching `index.json` blocks—today the site relies on **proportional** scroll sync. Populating the index for the README pair would dogfood stretch + index-backed sync on the public demo without changing product code.                                                                      |
| **Static site + Angles**                | [Pages](https://d-led.github.io/commentray/) ships one HTML file: one `commentray_markdown` body, **no** in-page Angle switcher (see Goals).                                                                                                                                                                                                                                                                                                                                                                         |
| **Dogfood Angles**                      | This repo has **no** `source/.default` and no per-source angle folders—nothing exercises multi-angle layout or the VS Code picker against real content in-tree.                                                                                                                                                                                                                                                                                                                                                      |
| **Flat → Angles migration tooling**     | **None.** `commentray migrate` is **index JSON schema** only (`packages/core/src/migrate.ts`), not filesystem layout. Flat → `source/{P}/{angle}.md` + index key updates are manual per [`docs/spec/storage.md`](../spec/storage.md) **Migration**. A future **`commentray migrate angles`** (or similar) would automate move + optional default angle id + `index.json` key rewrites.                                                                                                                               |
| **Hub search and Angles on Pages**      | `buildCommentrayNavSearchDocument` indexes **all** `byCommentrayPath` entries (multiple `commentrayPath` values for one `sourcePath` is fine). **Gap:** if `index.json` is empty, `build-static-pages.mjs` only passes the **`[static_site]`** fallback pair—**no** scan of per-angle paths under `.commentray/source/<primary>/`—so extra angle Markdown files on disk are **not** in `commentray-nav-search.json` until indexed or the builder learns discovery. Pair with static Angle switcher when implemented. |
| **User docs**                           | Most of `docs/user/` from the Documentation roadmap is still missing; only `keeping-blocks-in-sync.md` exists.                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Detection matrix**                    | `docs/user/detection.md` not written; content is outlined in this plan under Documentation roadmap.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Validate scope**                      | Pre-commit / `validate` still scan the full repo (staged-only hook scope remains a later optimization).                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Local static preview + reload**       | No **`commentray serve`** (or equivalent root script) that rebuilds **`pages:build`** on file change and reloads the browser. Today: **`npm run pages:build`**, then **`npm run e2e:server`** (`serve -s _site`, no auto-rebuild). Optional follow-up: watch `.commentray/` + `[static_site]` inputs + `packages/render` and rerun build; pair with **browser-sync** or Vite middleware if we want livereload without pulling a heavy dev server into the default install.                                           |
| **VS Code scroll sync + extension E2E** | Paired-pane **synchronized scroll** is usable but still MVP-level (feel, edge cases, performance on large buffers). There is **no** VS Code–hosted integration/E2E suite yet—only **`@commentray/core`** unit coverage for scroll math and **Cypress** for the **static** code browser. **Next:** improve scroll behavior in `commentray-vscode`, then add extension E2E (fixture workspace + scripted editor APIs) so regressions are caught in CI separately from `e2e.yml`.                                       |

## Next session (handoff)

Use this section to resume work without re-deriving context.

### Read first (~15 minutes)

1. **This doc** — §Goals, §Implementation status, §Gaps, §Open technical choices.
2. **Normative contracts** — [`docs/spec/storage.md`](../spec/storage.md), [`anchors.md`](../spec/anchors.md), [`blocks.md`](../spec/blocks.md).
3. **Contributor flow** — [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (quality gate, scripts policy).
4. **Product voice beside code** — [`.commentray/source/README.md.md`](../../.commentray/source/README.md.md) (skim; overlaps lightly with the plan on purpose).

### Commands (repo root)

| Intent                                                           | Command                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Same checks as GitHub `ci.yml` test lane (unit gate)             | `bash scripts/quality-gate.sh` or `npm run quality:gate`                               |
| Unit tests only (after core/render build)                        | `COMMENTRAY_TEST_MODE=unit bash scripts/test.sh`                                       |
| Integration tests                                                | `npm run test:integration`                                                             |
| Expensive tests                                                  | `npm run test:expensive` (or trigger `ci-expensive.yml` / PR label `run-expensive-ci`) |
| Quality gate + integration + expensive (no Cypress)              | `npm run ci:full`                                                                      |
| Regenerate GitHub Pages artifact locally                         | `npm run pages:build` → `_site/index.html`                                             |
| Serve `_site` only (static, no rebuild; use after `pages:build`) | `npm run e2e:server` (port **4173**)                                                   |
| Static browser E2E (Chrome installed)                            | `npm run e2e` or `npm run e2e:ci`                                                      |
| Full workspace TypeScript build                                  | `npm run build`                                                                        |

### Suggested backlog (pick up tomorrow)

Balances **user-visible docs**, **low-risk dogfood**, and **larger product slices**. Order is a hint only—reorder when a release or incident dictates.

- **User docs (unblocks README links)** — Add `docs/user/install.md` and `docs/user/quickstart.md` per §Documentation roadmap; then add README links when those files exist.
- **Detection matrix** — Add `docs/user/detection.md` (lift the outline from §Documentation roadmap); optionally shorten that outline here once the dedicated page is canonical.
- **Remaining user docs** — `docs/user/cli.md`, `docs/user/config.md`, `docs/user/troubleshooting.md` as short pages; keep each one screen where possible.
- **Dogfood `index.json` (optional, fast)** — Add at least one coherent **block** entry for the Pages pair (`README.md` ↔ `.commentray/source/README.md.md`) so **block stretch** and index-backed scroll run on the public site; validates `build-static-pages.mjs` wiring under real content.
- **Validate hook scope** — Design + implement staged-files-only (or similar) for `commentray validate` from pre-commit when the team wants faster commits on huge trees.
- **Angles on static** — Switcher + multi-body load in `build-static-pages.mjs` / client bundle (§Open technical choices item 3); **dogfood** this repo with `source/.default` + at least two angle files for one primary (e.g. README) once migration exists or paths are hand-migrated.
- **Angles migration + search** — CLI (or scripted) flat→angles migration; Pages `commentray-nav-search.json` includes every indexed angle and/or discovers `source/{P}/*.md` when index is empty.
- **VS Code synchronized scroll + extension E2E** — Polish bidirectional / block-aware scroll in `commentray-vscode`; add VS Code integration tests (not Cypress) for paired panes and scroll alignment; wire into CI when stable (see §Open technical choices item 2 and gaps table).
- **Editor / language depth** — Webview parity with `@commentray/render`; tree-sitter or LSP-backed resolvers (items 1 and 2c under §Open technical choices).
- **Local static dev loop** — `commentray serve` (or `npm run pages:dev`): watch inputs, rerun `pages:build`, optional livereload for `_site` (see gaps table **Local static preview + reload**).

### Parking lot (not scheduled in the list above)

- Metadata richness beyond v0 fields; richer gutter diagnostics in VS Code.
- More integration fixtures as external repos adopt Commentray.
- npm publish automation (OIDC + provenance) if policy changes from manual 2FA publishes.
- Tuning **`e2e.yml`** path filters or required checks if we want stricter merge gating (browser job is already wired).

---

Incremental work continues after the backlog items: anchor plugins, editor diagnostics, and integration coverage grow with adoption.
