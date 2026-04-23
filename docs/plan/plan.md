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

| Theme                | Follow-ups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code**          | Synchronized scroll: bidirectional stability, large `index.json`, long files, wrapped editors, `revealRange` / debounce edge cases (`packages/vscode/src/extension.ts`, `packages/core/src/scroll-sync.ts`). **Extension Host tests:** scroll / visible-range and **Angles** (fixture + scripted quick picks)—`bash scripts/test-vscode-extension.sh`, [`packages/vscode/.vscode-test.mjs`](../../packages/vscode/.vscode-test.mjs). **Webview** parity with `@commentray/render` and richer block gutter UX. |
| **Angles & hub**     | Optional **`commentray` angles add** convenience; when `index.json` is **empty**, Pages build still falls back to **`[static_site]`** only—no discovery scan of `source/{P}/*.md`; richer hub when unindexed angles exist on disk. Optional future: `index.json` keyed by `(sourcePath, angleId)` if metadata needs it.                                                                                                                                                                                       |
| **Language**         | Resolvers beyond minimal anchors: tree-sitter and/or LSP-backed symbol work (Open technical choices §1 below).                                                                                                                                                                                                                                                                                                                                                                                                |
| **Validate**         | Pre-commit / `validate` scan the full repo; **staged-only** (or similar) scope when large trees hurt commit latency.                                                                                                                                                                                                                                                                                                                                                                                          |
| **Local static dev** | No automatic **browser** livereload on `commentray serve` rebuilds. Watcher does not include `packages/render` sources—after render code edits, run **`npm run build`** (or rely on `scripts/serve.sh` initial builds) before seeing changes.                                                                                                                                                                                                                                                                 |
| **Dogfood**          | Add `index.json` pairs (marker + Markdown block markers) when new primaries get a Pages or editor spotlight—pattern in [`docs/spec/blocks.md`](../spec/blocks.md).                                                                                                                                                                                                                                                                                                                                            |
| **Path churn**       | **Still out of scope for v0:** auto-mutating the index from heuristics; scanning **untracked** or **non-text** files; cross-file **`symbol:`** resolution without tree-sitter/LSP. Relocation hints today: `git-relocation-scan.ts` and validate/init messaging.                                                                                                                                                                                                                                              |

## Open technical choices (next iterations)

1. **Language intelligence:** tree-sitter and/or LSP-backed resolvers (see gaps table).
2. **VS Code:** scroll polish; extend `@vscode/test-cli`; webview parity (see gaps table).
3. **Angles / hub:** CLI convenience, empty-index discovery, optional metadata shape (see gaps table).

## Documentation

- Polish [`docs/user/`](../user/) from real onboarding feedback.
- Editor vs hook vs CLI behavior: [`docs/user/detection.md`](../user/detection.md) is canonical.

## Testing — extensions to today’s matrix

Vitest tiers and coverage live at the repo root (`vitest*.config.ts`, `scripts/test.sh`). **Additional coverage to add:** VS Code scenarios above (scroll + Angles in Extension Host), still **separate** from **Cypress** static-site E2E (`npm run e2e`, `ci.yml` job **`e2e-static`**).

## Contributor pointers

- Contract: [`CONTRIBUTING.md`](../../CONTRIBUTING.md). Scripts, quality gate, releases: [`docs/development.md`](../development.md).
- **CI / workflows:** [`.github/workflows/`](../../.github/workflows/) (including extension tests: `ci-vscode-extension.yml`).

## Next session (handoff)

### Read first

1. This doc and the gaps table.
2. [`docs/spec/storage.md`](../spec/storage.md), [`anchors.md`](../spec/anchors.md), [`blocks.md`](../spec/blocks.md).
3. [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`docs/development.md`](../development.md).

### Commands (non-exhaustive)

| Intent                               | Command                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Same unit gate as `ci.yml` **quick** | `bash scripts/quality-gate.sh` or `npm run quality:gate`                   |
| Integration / expensive Vitest       | `npm run test:integration`, `npm run test:expensive`                       |
| Full gate without Cypress            | `npm run ci:full`                                                          |
| Pages artifact                       | `npm run pages:build`                                                      |
| Static browser E2E                   | `npm run e2e` or `npm run e2e:ci`                                          |
| VS Code extension tests              | `bash scripts/test-vscode-extension.sh` or `npm run test:vscode-extension` |

For the full script list, see **`docs/development.md`**.

## Suggested backlog (hints only)

- User docs polish under `docs/user/`.
- More dogfood `index.json` pairs when a new primary gets spotlight.
- Validate hook staged-only scope.
- Angles hub discovery when index is empty; optional CLI ergonomics.
- VS Code scroll + deeper `@vscode/test-cli` coverage.
- Editor depth: webview parity, tree-sitter/LSP.
- Serve loop: livereload; watch `packages/render`.

## Parking lot

- Richer metadata fields; VS Code gutter diagnostics beyond today.
- More external-repo integration fixtures.
- npm publish automation (OIDC + provenance) if policy moves off manual 2FA.
- Branch protection (required **`ci`**, **`e2e-static`**, **`e2e-publish-checks`**, extension workflow) and path filters if merge gating should tighten.
