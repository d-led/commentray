# Commentray monorepo — plan (remaining work)

**Canonical truth** (packages, scripts, CI, defaults, what already ships) lives in the repo tree, [`README.md`](../../README.md), [`CONTRIBUTING.md`](../../CONTRIBUTING.md), and [`docs/spec/`](../spec/). This file holds **design intent** the specs do not replace, plus **backlog and gaps**—not a second README.

## Product metaphor

Commentary on DVDs: optional explanation **without** changing the film. Commentray keeps the **primary artifact clean** while rationale and diagrams live in paired Markdown under `.commentray/`, aligned with **blocks** and **anchors** instead of brittle line numbers alone.

## Documentation hierarchy

- Fix disagreements in **source**, **README**, **specs**, or **workflows**—not here.
- This plan **links** instead of duplicating inventories, command matrices, or full CI graphs.
- Narrative under [`.commentray/source/`](../../.commentray/source/) is optional context; it must not copy authoritative lists.

## Product principles (navigation and linking)

- **Navigation:** consistent mental models and predictable entry points; permalink policy below.
- **Cross-linking:** plain Markdown and repo-relative paths; tooling must not fight them (see [`docs/spec/storage.md`](../spec/storage.md), [`docs/spec/anchors.md` § Cross references](../spec/anchors.md#cross-references)).

## Non-goals (initial iterations)

- Replacing language-native doc systems (Rustdoc, Javadoc, …).
- Fully autonomous AI synchronization before diagnostics and machine-readable reports are solid.
- Every SCM backend on day one (interfaces yes; extra backends later).

## Normative specs

- [`docs/spec/storage.md`](../spec/storage.md) — paths, Angles layout, static site fields
- [`docs/spec/anchors.md`](../spec/anchors.md) — anchor grammar
- [`docs/spec/blocks.md`](../spec/blocks.md) — blocks

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

## Permalinks and stable URLs (design intent)

- Hub (`index.html`), `_site/browse/…`, and location hashes should stay valid across typical rebuilds of the same revision on GitHub Pages.
- Prefer **same-origin** browse/search views over sending readers to raw hosts unless they opt out.
- Changing slug schemes for `(sourcePath, commentrayPath)` is a **breaking** bookmark change—rare, documented, consider redirects.

**Tests:** assert **user-visible navigation** (target page / scroll), not only internals—see Cypress under `cypress/e2e/`.

## Self-contained static site and configurable repository links

- In-site `staticBrowseUrl` and browse HTML should let `_site/` work from a static server **without** requiring `static_site.github_url` for moving between documented pairs.
- Outbound “open in repo” URLs stay **configuration-driven**; today’s fields are GitHub-shaped—evolving to a neutral “repository web base” (or host-specific builders) belongs in config and `@commentray/core` as adoption grows.

## Open engineering work

| Theme            | Follow-ups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code**      | Synchronized scroll: bidirectional stability, large `index.json`, long files, wrapped editors, `revealRange` / debounce edge cases (`packages/vscode/src/extension.ts`, `packages/core/src/scroll-sync.ts`). Extension Host: command surface smoke today; still add **scroll / visible-range** and **Angles quick-pick** scenarios—`bash scripts/test-vscode-extension.sh`, [`packages/vscode/.vscode-test.mjs`](../../packages/vscode/.vscode-test.mjs). **Webview** parity with `@commentray/render` and richer block gutter UX. |
| **Angles & hub** | Richer hub when **unindexed** Angles companions exist on disk (nav search already merges disk + index); browse **Comment-rayed files** tree highlights the **active pair** (incl. multi-angle). Optional: `index.json` keyed by `(sourcePath, angleId)` if metadata needs it.                                                                                                                                                                                                                                                      |
| **Language**     | Resolvers beyond minimal anchors: tree-sitter and/or LSP-backed symbol work. Today’s extension point: `plannedSymbolResolutionStrategy()` → **`none`** (`packages/core/src/language-intelligence.ts`).                                                                                                                                                                                                                                                                                                                             |
| **Dogfood**      | Add `index.json` pairs (marker + Markdown block markers) when new primaries get a Pages or editor spotlight—pattern in [`docs/spec/blocks.md`](../spec/blocks.md).                                                                                                                                                                                                                                                                                                                                                                 |
| **Path churn**   | **Still out of scope for v0:** auto-mutating the index from heuristics; scanning **untracked** or **non-text** files; cross-file **`symbol:`** resolution without tree-sitter/LSP. Relocation hints today: `git-relocation-scan.ts` and validate/init messaging.                                                                                                                                                                                                                                                                   |

## Documentation

- Polish [`docs/user/`](../user/) from real onboarding feedback.
- Editor vs hook vs CLI behavior: [`docs/user/detection.md`](../user/detection.md) is canonical.

## Testing — extensions to today’s matrix

Vitest tiers and coverage live at the repo root (`vitest*.config.ts`, `scripts/test.sh`). **Additional coverage to add:** VS Code scroll / visible-range and scripted Angles flows (see gaps table), still **separate** from **Cypress** static-site E2E (`npm run e2e`, `ci.yml` job **`e2e-static`**).

## Contributor pointers

- Contract: [`CONTRIBUTING.md`](../../CONTRIBUTING.md). Scripts, quality gate, releases: [`docs/development.md`](../development.md).
- **CI / workflows:** [`.github/workflows/`](../../.github/workflows/) (including extension tests: `ci-vscode-extension.yml`).

## Next session (handoff)

Skim the gaps table, then specs under `docs/spec/` as needed. **`bash scripts/quality-gate.sh`** before pushing; see **`docs/development.md`** for the full script matrix (integration, `ci:full`, `e2e`, VS Code extension).

## Parking lot

- Optional: stricter **`validate --staged`** “touched pair” heuristics for huge repos (defaults are conservative).
- Richer metadata fields; VS Code gutter diagnostics beyond today.
- More external-repo integration fixtures.
- npm publish automation (OIDC + provenance) if policy moves off manual 2FA.
- Branch protection (required **`ci`**, **`e2e-static`**, **`e2e-publish-checks`**, extension workflow) and path filters if merge gating should tighten.
