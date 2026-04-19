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

## Product principles (navigation and linking)

- **Navigation:** We strive to make moving around the system—as an author or reader in the extension, rendered views, static hub and browse tree, and repo documentation—as **easy and understandable** as possible: **consistent mental models**, predictable entry points, and clarity over cleverness. Concrete URL and in-site navigation policy lives under [§ Permalinks and stable URLs (design intent)](#permalinks-and-stable-urls-design-intent) below.
- **Cross-linking:** **Cross-linking must be very easy** for authors and readers: ordinary Markdown links, repo-relative paths wherever practical, stable public URLs where needed, and tooling that does **not** fight those paths in rendered and static output (see [`docs/spec/storage.md`](../spec/storage.md) for static-site link rewriting). Normative authoring conventions are in [`docs/spec/anchors.md` § Cross references](../spec/anchors.md#cross-references). Optional higher-level xref syntax, if added later, stays optional—the common case must stay plain links.

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
- **CLI**: `@commentray/cli` provides `init` (full idempotent setup), `init config`, `init scm` (git hooks), `validate`, `doctor`, `migrate`, `render`, and `paths`; **standalone SEA binaries** for Linux (x64, arm64), macOS (x64, arm64), and Windows (x64) are built in [`.github/workflows/binaries.yml`](../../.github/workflows/binaries.yml). CI workflow **artifacts expire** (14-day retention); **`v*`** tags are meant to attach binaries to **GitHub Releases** as the long-lived distribution surface (none published on that page yet).
- **Monorepo**: TypeScript, coordinated **semver** across **`@commentray/*`** (see each `package.json`), **MPL-2.0** per published package.
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
  serve.sh
  pages-serve.sh
  build-static-pages.mjs
docs/
  plan/plan.md
  spec/
.github/workflows/
  binaries.yml
  ci.yml
  ci-expensive.yml
  codeql.yml
  e2e-publish-checks.yml
  e2e.yml
  pages.yml
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

This repository keeps **terse** commentray beside selected sources under [`.commentray/source/`](../../.commentray/source/) (Angles layout: `source/{primary}/{angle}.md`, e.g. this file → [`main.md`](../../.commentray/source/docs/plan/plan.md/main.md)). Per §Documentation hierarchy, those files add **narrative only**—they do not replace [`README.md`](../../README.md), specs, or workflow YAML; they link out instead of copying inventories.

## Packages and configuration

- **Packages / workspaces** — See [`README.md` → npm packages (library ecosystem)](../../README.md#npm-packages-library-ecosystem) and root [`package.json`](../../package.json) `workspaces`. Implementation lives under `packages/*/`.
- **`.commentray.toml`** — Key semantics, Angles, and `[static_site]` fields are specified in [`docs/spec/storage.md`](../spec/storage.md) (and related specs). Defaults and comments live in the repo’s [`.commentray.toml`](../../.commentray.toml); parsing and merge rules in [`packages/core/src/config.ts`](../../packages/core/src/config.ts). Dependency: `@iarna/toml` (revisit periodically for maintenance and security).

## Static code browser (`@commentray/code-commentray-static`)

- **Purpose**: dogfood and demo a file-plus-commentray reading experience without a server.
- **Implementation**: `renderCodeBrowserHtml` lives in `@commentray/render`; `@commentray/code-commentray-static` wires fixtures + CLI (`npm run site -w @commentray/code-commentray-static`) and writes to `packages/code-commentray-static/site/` (gitignored).
- **GitHub Pages**: root script `npm run pages:build` reads `.commentray.toml` `[static_site]`, composes commentray content (intro + GitHub link + optional file), and emits `_site/index.html` via `scripts/build-static-pages.mjs`. Workflow `.github/workflows/pages.yml` runs on `main` + `workflow_dispatch` using `actions/upload-pages-artifact` + `actions/deploy-pages` (repository **Settings → Pages → Build: GitHub Actions**).
- **UX**: movable vertical bar (mouse drag), “Wrap code lines” checkbox, **scroll sync**: when `pages:build` finds `index.json` blocks for the configured `(source_file, commentray_markdown)` pair and Markdown has matching `<!-- commentray:block id=… -->` markers, the page can use **block stretch** (single-scroll blame-style table) plus index-backed block scroll links; otherwise panes use **proportional** sync. Highlight.js themes via CDN, Markdown + Mermaid (optional); `<meta name="generator">` records `@commentray/render` + `@commentray/code-commentray-static` versions (override via `buildCommentrayStatic({ generatorLabel })`).
- **Code pane line numbers:** Each **logical** source line is one `.code-line` row: a grid with `.ln` (the number) and a per-line highlighted `<pre><code>` from Highlight.js. **Done (v0):** wrapped rows use **`align-items: start`** (not `baseline`) in [`packages/render/src/code-browser.ts`](../../packages/render/src/code-browser.ts) so numbers stay top-aligned with each row. **Model limit:** one number per **logical** line, not per wrapped visual sub-line; a per-screen-line gutter would need a different layout.
- **Quick search**: client-side whole-source ordered tokens plus per-line fuzzy ranking (bundled client); **Escape** clears search; see `packages/render` implementation.

### Permalinks and stable URLs (design intent)

We **design for URLs that work and keep working**—not one-off hacks. Concretely:

- **Shareable links** to the static hub (`index.html`), per-pair **browse** pages under `_site/browse/`, and **location hashes** (e.g. scrolling to a commentray line) should remain **valid across typical rebuilds** of the same repo revision and deployment to GitHub Pages.
- **Same-origin first**: when a site-local HTML view exists for a documented pair (hub search, browse tree, angle toolbar), navigation should prefer that view over bouncing readers to GitHub unless they explicitly want the raw blob.
- **Identity-derived URLs**: browse page slugs are derived from the `(sourcePath, commentrayPath)` pair (see `@commentray/render` / static-site build). **Changing** that pair or the slug scheme is a **breaking change** for old bookmarks and should be rare, documented, and paired with redirects or release notes when unavoidable.
- **Tests**: Cypress and unit tests should assert **user-visible navigation outcomes** (correct target page or scroll), not only implementation details—so regressions in permalink behavior are caught in CI.

### Self-contained static site and configurable repository links

- **Comment-rayed navigation stays on the export**: `pages:build` emits `_site/browse/*.html` and enriches `commentray-nav-search.json` with same-site `staticBrowseUrl` for documented pairs **without** requiring `static_site.github_url`. The hub search UI, the Comment-rayed files tree, and the Doc toolbar **prefer** those in-site pages so `_site/` is fully browsable from a static file server or arbitrary origin (no dependency on `github.com` for moving between pairs).
- **External SCM links are optional and configurable**: `static_site.github_url`, `related_github_files`, and Markdown link rewriting add **optional** outbound links where “open in the repository” is appropriate. Deployments may use **GitHub Enterprise, GitLab, or other hosts**; those URLs **must remain configuration-driven** (not hardcoded to `github.com`). Today the TOML field and helpers assume a GitHub-shaped web URL; evolving toward a neutral “repository web base” (or host-specific URL builders) belongs in config and `@commentray/core` as adoption grows.

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

- `ci.yml` (push + PR): `npm ci`, optional `npm audit` (informational), `bash scripts/quality-gate.sh`, `npm run test:integration`, then job **`e2e-static`** (`cypress/included`, `pages:build`, Cypress, artifact **`e2e-ci-bundle`**). Matrix: Node **20.x** and **22.x** for the **`quick`** job only.
- `e2e-publish-checks.yml`: after a successful **`ci`** run (`workflow_run`), downloads **`e2e-ci-bundle`** and publishes JUnit to **GitHub Checks** — no checkout of PR SHAs (CodeQL-safe).
- `e2e.yml`: **`workflow_dispatch` only** — same Cypress path as **`e2e-static`** for ad-hoc runs (includes Checks locally to that workflow).
- `ci-expensive.yml`: manual **`workflow_dispatch`** or PR labeled **`run-expensive-ci`** → `npm run build` then `npm run test:expensive`.
- `pages.yml`: `npm run pages:build` then deploy `_site/` to **GitHub Pages** (push to `main` or **`workflow_dispatch`**). Repo **Settings → Pages → Build: GitHub Actions**. Includes a step to delete stale `github-pages` artifacts when re-runs collide with `deploy-pages`.
- `binaries.yml`: **`workflow_dispatch`** or push of tag **`v*`** → builds Node **SEA** CLI artifacts per OS/arch; workflow artifacts use short retention; **Release** assets on tags are the durable download surface (see README).
- `codeql.yml`: scheduled + **`main`** push/PR — CodeQL for **Actions** and **JavaScript/TypeScript**.

**Browser E2E (Cypress):** part of **`ci.yml`** as job **`e2e-static`** (after **`quick`**). Run locally with **`npm run e2e`** (requires Chrome; see README). [`.github/workflows/e2e-publish-checks.yml`](../../.github/workflows/e2e-publish-checks.yml) turns the uploaded JUnit bundle into **GitHub Checks** without checking out fork PR code. [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) is **`workflow_dispatch` only** for manual reruns.

**Local “full” CI (no Cypress):** `npm run ci:full` → `scripts/ci-full.sh` runs `quality-gate.sh`, then integration tests, then expensive tests—handy before a large merge; still does not run Cypress.

Maintainers can tighten expensive jobs later using GitHub Environments and required reviewers.

## Licensing

Root `LICENSE` is MPL-2.0 (Mozilla template). Each publishable package includes its own `LICENSE` copy for npm packaging clarity.

## Contribution guide

`CONTRIBUTING.md` is the short contract (principles + `quality:gate` + norms). Operational detail lives in [`docs/development.md`](../development.md).

## Open technical choices (next iterations)

1. **Language intelligence**: expand beyond minimal anchors using tree-sitter and/or LSP-backed resolvers.
2. **VS Code**: (a) **Synchronized scroll** — tighten the paired-pane experience: bidirectional stability, block-aware jumps with large `index.json`, long files, wrapped editors, and edge cases around `revealRange` / debounced rebuilds (`packages/vscode/src/extension.ts`, `packages/core/src/scroll-sync.ts`). (b) **Extension E2E** — add automated tests **inside VS Code** (e.g. `@vscode/test-electron` or the recommended integration-test harness) that open a fixture workspace, exercise scroll sync, and assert visible ranges or block alignment; this is **separate** from repository **Cypress** E2E for the static HTML site (`cypress/e2e/`, `ci` job **`e2e-static`** / `e2e-publish-checks.yml`). (c) Webview preview parity with `@commentray/render` output and richer block gutter UX.
3. **Angles (shipped for static + CLI)**: `commentray migrate-angles`, `build-static-pages.mjs` + client bundle multi-angle selector when two or more angle files exist for `[static_site].source_file`; VS Code opens `source/{P}/{angle}.md` when Angles layout is on. **Remaining:** optional **`commentray` angles add** convenience; richer hub discovery when `index.json` is empty; forward-looking `index.json` keyed by `(sourcePath, angleId)` if metadata needs first-class support beyond separate files.

## Documentation roadmap (pending)

The plan doc, the specs under `docs/spec/`, and README/CONTRIBUTING cover engineering. User-facing guides live under **`docs/user/`** (see README **Using Commentray**).

1. **User docs — terse but usable**: [`docs/user/`](../user/) — short, runnable-command-first pages; incremental polish (examples, screenshots) as adoption surfaces gaps.

2. **Detection matrix**: [`docs/user/detection.md`](../user/detection.md) — what runs in the hook, CLI, and editor, plus known gaps (canonical detail there; avoid duplicating long outlines in this plan).

## Implementation status (living)

**In place today:** monorepo scaffolding; `@commentray/core` (paths, index schema, migrations, Git SCM, anchors, staleness, scroll/block helpers, Angles resolution); `@commentray/render` (sanitize, highlight, Mermaid, static code browser HTML + client search/sync, line-gutter alignment fix for wrapped rows); `@commentray/code-commentray-static`; `@commentray/cli` (init family, validate, doctor, migrate, render, paths, SEA binaries workflow); `commentray-vscode` (paired panes, block-from-selection, validation channel, block-aware scroll when index + markers agree, Angles commands); tiered Vitest; `quality-gate.sh` on every push/PR; optional expensive CI; GitHub Pages via `pages.yml`; **Cypress on GitHub** — [`ci.yml`](../../.github/workflows/ci.yml) job **`e2e-static`** (`pages:build` + Cypress in `cypress/included`, artifact **`e2e-ci-bundle`**), then [`e2e-publish-checks.yml`](../../.github/workflows/e2e-publish-checks.yml) for Checks; [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) is manual-only. Locally **`npm run e2e`** / **`npm run cy`** (`package.json` scripts).

**Gaps and follow-ups (engineering, not duplicate of Open technical choices):**

| Area                                    | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dogfood `index.json`**                | The README ↔ `main.md` pair uses three **`marker:`** blocks with invisible HTML region delimiters in `README.md` (see `docs/spec/blocks.md`) plus Markdown `<!-- commentray:block … -->` markers—**GitHub Pages** uses dual panes + index-backed scroll (multi-angle mode skips stretch). `commentray validate` errors on unresolved `marker:` anchors and warns on orphan regions. Add more entries when other primaries need the same treatment.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Static site + Angles**                | [Pages](https://d-led.github.io/commentray/) ships one HTML file with an **Angle** selector when two or more angle files exist for `static_site.source_file`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Dogfood Angles**                      | This repo uses **`commentray migrate-angles`**, `source/.default`, per-source folders, and a second README angle (`architecture`) for the static switcher.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Flat → Angles migration tooling**     | **`commentray migrate-angles`** automates flat → `source/{P}/{angle}.md`, sentinel, TOML `[angles]`, `index.json` keys, and `[static_site].commentray_markdown` when applicable (see [`docs/spec/storage.md`](../spec/storage.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Hub search and Angles on Pages**      | `buildCommentrayNavSearchDocument` indexes **all** `byCommentrayPath` entries. **Gap:** if `index.json` is **empty**, the build still falls back to **`[static_site]`** only—no scan of unindexed angle files on disk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **User docs**                           | Core `docs/user/` pages from the Documentation roadmap are present; polish as adoption surfaces gaps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Detection matrix**                    | [`docs/user/detection.md`](../user/detection.md) is canonical; this plan’s roadmap outline is a summary only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Validate scope**                      | Pre-commit / `validate` still scan the full repo (staged-only hook scope remains a later optimization).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Local static preview + reload**       | **`npm run serve`** / **`npm run pages:serve`** invoke [`scripts/serve.sh`](../../scripts/serve.sh), which builds the workspace CLI stack then runs **`commentray serve`**: watches `.commentray.toml`, `[static_site]` source + commentray paths, storage companions, `index.json`, rebuilds **`pages:build`** output into `_site/`, and HTTP-serves it (see `packages/cli/src/serve.ts`). [`scripts/pages-serve.sh`](../../scripts/pages-serve.sh) delegates to the same script. **`npm run e2e:server`** remains **serve-only** after a manual **`pages:build`** (Cypress). **Gap:** no automatic **browser** livereload on rebuild (refresh manually, or add browser-sync / dev middleware later). **Gap:** watcher does not include `packages/render` sources — change render code → run **`npm run build`** (or rely on **`scripts/serve.sh`**’s initial package builds) before edits take effect. |
| **VS Code scroll sync + extension E2E** | Paired-pane **synchronized scroll** is usable but still MVP-level (feel, edge cases, performance on large buffers). There is **no** VS Code–hosted integration/E2E suite yet—only **`@commentray/core`** unit coverage for scroll math and **Cypress** for the **static** code browser. **Next:** improve scroll behavior in `commentray-vscode`, then add extension E2E (fixture workspace + scripted editor APIs) so regressions are caught in CI separately from the **Cypress** `ci` / **`e2e-static`** path.                                                                                                                                                                                                                                                                                                                                                                                        |
| **Path churn (rename / move / delete)** | **Previously under-specified here:** what happens when primaries disappear (delete or move without updating `index.json`); whether **Git-only** `sync-moved-paths` is enough; and **heuristic** recovery (marker ids, snippet text, symbols) when Git does not emit an `R` line (e.g. add + delete). **Now:** `commentray validate` / `init` emit **relocation hints** for missing primaries: renames from `HEAD~1`→`HEAD`, **marker:** / **snippet:** matches in other **indexed** primaries **and** a **bounded** read of other **Git-tracked** source-like paths (`git ls-files`, extension allowlist, file count / size caps — see `git-relocation-scan.ts`), plus guidance for **symbol:** / opaque anchors. **Still out of scope for v0:** auto-mutating the index from heuristics; scanning **untracked** or **non-text** files; cross-file **symbol:** resolution (tree-sitter / LSP).           |

## Next session (handoff)

Use this section to resume work without re-deriving context.

### Read first (~15 minutes)

1. **This doc** — §Goals, §Implementation status, §Gaps, §Open technical choices.
2. **Normative contracts** — [`docs/spec/storage.md`](../spec/storage.md), [`anchors.md`](../spec/anchors.md), [`blocks.md`](../spec/blocks.md).
3. **Contributor flow** — [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (contract) and [`docs/development.md`](../development.md) (quality gate detail, scripts, releases).
4. **Product voice beside code** — [`.commentray/source/README.md/main.md`](../../.commentray/source/README.md/main.md) (skim; overlaps lightly with the plan on purpose).

### Commands (repo root)

| Intent                                                           | Command                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Same checks as GitHub `ci.yml` test lane (unit gate)             | `bash scripts/quality-gate.sh` or `npm run quality:gate`                               |
| Unit tests only (after core/render build)                        | `COMMENTRAY_TEST_MODE=unit bash scripts/test.sh`                                       |
| Integration tests                                                | `npm run test:integration`                                                             |
| Expensive tests                                                  | `npm run test:expensive` (or trigger `ci-expensive.yml` / PR label `run-expensive-ci`) |
| Quality gate + integration + expensive (no Cypress)              | `npm run ci:full`                                                                      |
| Regenerate GitHub Pages artifact locally                         | `npm run pages:build` → `_site/index.html`                                             |
| Serve `_site` only (static, no rebuild; use after `pages:build`) | `npm run e2e:server` (port **14173**; override `COMMENTRAY_E2E_PORT`)                  |
| Static browser E2E (Chrome installed)                            | `npm run e2e` or `npm run e2e:ci`                                                      |
| Full workspace TypeScript build                                  | `npm run build`                                                                        |

### Suggested backlog (pick up tomorrow)

Balances **user-visible docs**, **low-risk dogfood**, and **larger product slices**. Order is a hint only—reorder when a release or incident dictates.

- **User docs polish** — Tighten examples in `docs/user/` from real onboarding feedback; keep pages one screen where possible.
- **Dogfood `index.json` (more pairs)** — When another primary gets a public Pages or editor spotlight, add `byCommentrayPath` rows: prefer **`marker:`** regions in the primary (or `lines:` when markers are impossible) plus companion Markdown block markers, like the README pair.
- **Validate hook scope** — Design + implement staged-files-only (or similar) for `commentray validate` from pre-commit when the team wants faster commits on huge trees.
- **Angles on static** — Switcher + multi-body load in `build-static-pages.mjs` / client bundle (§Open technical choices item 3); **dogfood** this repo with `source/.default` + at least two angle files for one primary (e.g. README) once migration exists or paths are hand-migrated.
- **Angles migration + search** — CLI (or scripted) flat→angles migration; Pages `commentray-nav-search.json` includes every indexed angle and/or discovers `source/{P}/*.md` when index is empty.
- **VS Code synchronized scroll + extension E2E** — Polish bidirectional / block-aware scroll in `commentray-vscode`; add VS Code integration tests (not Cypress) for paired panes and scroll alignment; wire into CI when stable (see §Open technical choices item 2 and gaps table).
- **Editor / language depth** — Webview parity with `@commentray/render`; tree-sitter or LSP-backed resolvers (items 1 and 2c under §Open technical choices).
- **Local static dev loop** — **`npm run serve`** is wired; optional **browser livereload** and watching **`packages/render`** (or full `npm run build` on change) remain polish (see gaps table **Local static preview + reload**).

### Parking lot (not scheduled in the list above)

- Metadata richness beyond v0 fields; richer gutter diagnostics in VS Code.
- More integration fixtures as external repos adopt Commentray.
- npm publish automation (OIDC + provenance) if policy changes from manual 2FA publishes.
- Tuning **branch protection** (e.g. required **`ci`** / **`e2e-static`** / **`e2e-publish-checks`**) or path filters if we want stricter merge gating (browser job is already wired).

---

Incremental work continues after the backlog items: anchor plugins, editor diagnostics, and integration coverage grow with adoption.
