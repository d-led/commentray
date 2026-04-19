# Development

Hands-on notes for working on Commentray itself: building, debugging, and
observing the editor extension while dogfooding. If you just want to
install Commentray to use it, see the top-level `README.md`.

## Layout

- `packages/core` — shared library (`.commentray.toml` parsing, path
  normalization, metadata schema, validation, git adapter).
- `packages/render` — Markdown → HTML renderer + client-side bundle for
  the static site.
- `packages/cli` — the `commentray` CLI (also packaged as a standalone
  Node SEA binary).
- `packages/code-commentray-static` (`@commentray/code-commentray-static` on npm) — static-site generator for the
  rendered commentary pages.
- `packages/vscode` — VS Code / Cursor extension.

## Clone and workspace setup

```bash
git clone https://github.com/d-led/commentray.git
cd commentray
npm ci
npm run setup          # install, build, init, doctor — idempotent
```

Symlink the workspace CLI so rebuilds pick up without reinstalling:

```bash
npm run cli:install    # bash scripts/install-cli.sh
# later: npm run cli:uninstall
```

## Quality gate

One command gates every review:

```bash
npm run quality:gate   # format check, actionlint, ESLint x2, shellcheck, jscpd, tsc -b, unit tests
```

Slow lane (integration + expensive suites) on top of the gate:

```bash
npm run ci:full
```

If a check is failing, fix the root cause. Do not widen ignore lists or
raise thresholds to hide it. `CONTRIBUTING.md` states the social contract;
the bullets below are the day-to-day detail.

## Contributor expectations

- **Slow lane:** `npm run ci:full` — quality gate, integration tests, then expensive tests (no Cypress).
- **Tests:** run `npm run test:unit` before every PR; add `npm run test:integration` when you touch the Git SCM adapter, `.commentray/` layout, or fixture-backed behavior; use `npm run test:expensive` for fuzzed / large-repo suites when relevant. Never silence failures with `.skip`, swallowed errors, or widened thresholds — fix code or fix tests.
- **Lint / dupes:** `npm run lint` (ESLint + shellcheck on `scripts/` + refactor metrics); `npm run dupes` (`jscpd`); `npm run quality` runs lint + dupes. Treat findings as design feedback.
- **Dependencies:** preview with `npm run deps:upgrade -- --check`; apply with `npm run deps:upgrade` (`patch` / `minor` / `major` / `latest`). The script re-pins `@commentray/*` via `scripts/sync-workspace-deps.mjs` and refreshes the lockfile — then run `npm run quality:gate`. Triage `npm audit` seriously; avoid blanket `--force`.
- **Format:** `npm run format` (write) or `npm run format:check` (verify).
- **Coverage (discovery, not a score chase):** `npm run test:coverage` (unit) and `npm run test:coverage:all` (unit + integration) emit HTML + `lcov` under `./coverage/` (gitignored). Set `COMMENTRAY_COVERAGE_OPEN=0` to skip opening a browser.
- **Tests read like behavior:** prefer given / when / then; avoid asserting private implementation details.
- **Small, reversible PRs** where practical; land behavior-neutral refactors separately when it keeps review honest.

## Package managers

The repo is developed with **npm**. **Yarn** is an alternative path via `.yarnrc.yml` (`nodeLinker: node-modules`); if you use Yarn, keep `yarn.lock` policy explicit in PRs.

## CLI, binaries, and Pages

**Permalinks:** the static hub and `_site/browse/` pages are meant to provide **stable, working URLs** for sharing. Policy and constraints are in [`docs/plan/plan.md` § Permalinks and stable URLs](plan/plan.md#permalinks-and-stable-urls-design-intent). When you change URL shape or client navigation, update tests and note breaking changes in the PR.

- **Init:** `npm run commentray -- init` is idempotent (storage, seed `index.json` / `.commentray.toml` when missing). Use `npm run commentray -- init config` for TOML defaults, or `init config --force` to replace. `npm run commentray -- init scm` refreshes the marked `pre-commit` block that runs `commentray validate` when the linked CLI exists at the repo root.
- **Standalone binaries / CI:** [`.github/workflows/binaries.yml`](../.github/workflows/binaries.yml); workflow artifacts expire; **`v*`** tags attach builds to [GitHub Releases](https://github.com/d-led/commentray/releases). Local builds, smoke tests, and macOS quarantine: see subsections below (README **Standalone CLI binaries**).
- **GitHub Pages:** set `[static_site]` in `.commentray.toml`; `npm run pages:build` writes `_site/`. [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) deploys on `main` when **Settings → Pages → Build: GitHub Actions** is enabled.
- **Local Pages preview (watch):** **`npm run serve`** and **`npm run pages:serve`** both run [`scripts/serve.sh`](../scripts/serve.sh), which builds the CLI stack then runs [`scripts/serve-with-package-watch.mjs`](../scripts/serve-with-package-watch.mjs): that layer watches `packages/{core,render,code-commentray-static,cli}/src` (and render's `esbuild-code-browser-client.mjs`), rebuilds affected workspace packages on save, and **automatically restarts** **`commentray serve`** when needed so Node reloads `dist/`—you do **not** need to stop or restart the dev server by hand. Inside the CLI, **`commentray serve`** watches `.commentray.toml`, static-site inputs, companions under `.commentray/`, and `index.json`, rebuilds **`_site/`** on change, and keeps the same HTTP listener; new files are picked up without a manual **`serve` restart** (refresh the browser to load them; there is no built-in browser livereload yet). Default port **4173** (override with `npm run serve -- --port 8080`). Set **`COMMENTRAY_SERVE_NO_PACKAGE_WATCH=1`** to skip the workspace watcher (one-shot package builds only). For native file watching on the workspace tree, set **`COMMENTRAY_SERVE_PACKAGE_WATCH_POLL=0`** (defaults to polling to avoid **EMFILE** with small `ulimit -n`).

### macOS quarantine (standalone CLI)

Apple’s security layer may block a downloaded `commentray-darwin-*` binary until you clear the quarantine extended attribute:

```bash
xattr -d com.apple.quarantine /path/to/commentray-darwin-arm64
```

Broader cleanup (all extended attributes on one file):

```bash
xattr -c /path/to/commentray-darwin-arm64
```

(`xattr -r` is not valid on macOS; use `find … -exec` only if you truly need a tree.)

### Building binaries locally

From the repo root: `npm ci`, then `npm run binary:build` and `npm run binary:smoke`. If your `node` is from **Homebrew**, the SEA build may need a **nodejs.org**-style Node of the same major as CI—set **`COMMENTRAY_SEA_NODE`** to that binary’s path (the build script logs what it used).

## Expensive CI

[`.github/workflows/ci-expensive.yml`](../.github/workflows/ci-expensive.yml) runs on **`workflow_dispatch`** and on pull requests labeled **`run-expensive-ci`**. Maintainers may later gate it with a GitHub Environment.

## GitHub CI (Cypress static site)

On push/PR, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs job **`e2e-static`** after **`quick`**: `pages:build`, **`node scripts/validate-pages-github-links.mjs`** (GitHub blob URL shape, no `/browse/browse/` stacking, optional live HEAD to the hub source URL when `COMMENTRAY_VALIDATE_PAGES_LIVE=1`), Cypress in `cypress/included`, artifact **`e2e-ci-bundle`**. The static server listens on **14173** (not the dev **`commentray serve`** default **4173**). After a local **`npm run pages:build`**, run **`npm run pages:validate`** (set **`COMMENTRAY_VALIDATE_PAGES_LIVE=1`** to also HEAD-check `toolbar-source-github` against `github.com`). [`.github/workflows/e2e-publish-checks.yml`](../.github/workflows/e2e-publish-checks.yml) (`workflow_run` on **`ci`**) downloads that bundle and publishes JUnit to **GitHub Checks** without checking out fork PR SHAs. Ad-hoc runs: [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) (**workflow_dispatch** only). Locally use `npm run e2e` or `npm run e2e:ci`.

## Editor extension workflows

### 1. Dogfood: install from this repo + open a folder

`npm run extension:dogfood` runs **`scripts/install-extension.sh`** (build, bundle,
package `.vsix`, uninstall old id, `--force` install), then opens a new editor window on
a folder (`-n` / `--new-window` when the CLI supports it).

```bash
npm run extension:dogfood           # fixture workspace
npm run extension:dogfood:repo      # this monorepo root
npm run extension:dogfood -- .      # same; `--` forwards `.` to the script
```

After changing extension sources, re-run dogfood or `npm run extension:install`, then reload
the window if that workspace was already open.

### 2. Install only (no automatic folder launch)

```bash
npm run extension:install      # build + bundle + package + install
npm run extension:package      # build + bundle + package only (no install)
npm run extension:uninstall    # remove it
```

The installer script bundles the extension with esbuild (inlining
`@commentray/core`) before `vsce` packages the `.vsix`.

### 3. Extension Development Host + debugger (F5)

To set breakpoints in `packages/vscode/src/**`, open the `packages/vscode` folder in the
editor and use the **Run and Debug** / **Extension** launch configuration (add
`launch.json` if your editor has not generated one). That path attaches a debugger;
`npm run extension:dogfood` installs the packaged extension into your normal editor instead.

## Scroll sync and paired panes

After **Commentray: Open commentray beside source** (or **Add block from
selection**, which opens the pair for you), the extension wires a scroll
listener on **both** editors:

- **Source → commentray:** the top visible line of the source picks a target
  line in the Markdown. If `index.json` lists `lines:` anchors that match
  `<!-- commentray:block id=… -->` markers in the commentray file, the
  commentary scroll snaps to the block whose source range **contains** that
  top line (or the nearest sensible block when you are in a gap). Without
  blocks, a lightweight proportional scroll is used instead.
- **Commentray → source:** the top visible line in the Markdown maps back to
  the start of the corresponding source range for the same block list.

Edits to either file or saving `index.json` refresh the block map on a short
debounce so markers and metadata edits stay in sync without reloading the
window.

## Observing the extension at runtime

### The `Commentray` output channel

The extension creates an output channel named **Commentray** for
user-facing reports. Today it is only written to by **Commentray:
Validate workspace metadata**, which dumps each validation issue there
and reveals the panel. To view:

- Open the Output panel: **View → Output** (or `Cmd/Ctrl+Shift+U`).
- Pick **Commentray** from the dropdown on the right of the panel.

If you are adding a new command and want visible, structured logging,
reuse that same channel rather than `console.log` — users see Output,
they do not see the Developer Tools console.

### Extension Host log

Activation errors and stack traces from the extension host appear under **Developer: Show Logs… → Extension Host**.

### The Developer Tools console

For extension code paths that touch the webview preview or for any
`console.log` calls in the extension itself:

- Command Palette → **Developer: Toggle Developer Tools**.
- Console tab shows `console.log` output from both the extension host
  and any webviews.

## Debugging

`npm run extension:dogfood` installs the packaged build into your normal editor without a debugger; use **Run and Debug** on the `packages/vscode` workspace to attach one.

If a `Commentray:` command is missing after install, run `npm run extension:install` (or dogfood) and reload the window. After editing extension sources in the **Extension** dev host, run `npm run build -w commentray-vscode` before reloading.

### The `.commentray/` folder did not appear

`commentray init` only creates `.commentray/storage` and
`.commentray/metadata/index.json` — it does _not_ preseed per-file
Markdown. Those are created on demand when you:

- Open a source file and run **Commentray: Open commentray beside
  source**, or
- Run `commentray render --source <file>` to render a file's track.

Also: `storage.dir` inside `.git/` is rejected by design (see
`SECURITY.md`). The CLI will refuse to initialize with a clear error.

### `commentray` not found on PATH after `npm run cli:install`

The global `npm` bin directory might not be on your PATH.
`scripts/install-cli.sh` prints the exact path to add after linking.

## Where changes tend to go

Rough mental map for new contributors:

- Config semantics → `packages/core/src/config.ts` +
  `packages/core/src/paths.ts` (both well-tested; add behavior tests,
  not snapshot tests).
- Git hook wording → `packages/cli/src/git-hooks.ts`.
- CLI command surface → `packages/cli/src/cli.ts`. Keep command
  handlers thin; push logic into the core or a sibling module and
  unit-test that module.
- Rendering pipeline → `packages/render/src`. The sanitize allow-list
  lives near the top of the pipeline — changes there affect security
  posture; read `SECURITY.md` first.
- Extension behavior → `packages/vscode/src/extension.ts`.

## Publishing to npm (maintainers)

Release is split so **bumping** and **tagging** stay separate from **publish**.

| Script                    | Role                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/bump-version.sh` | Bumps every workspace `package.json`, runs `scripts/sync-workspace-deps.mjs`, refreshes `package-lock.json`, updates `CHANGELOG.md` when `[Unreleased]` exists. Supports `patch`, `minor`, `major`, `rc`, `release`, `set <version>`, `--dry-run`. Does **not** touch git — safe on a dirty tree. |
| `scripts/tag-version.sh`  | Reads `packages/core/package.json`, requires a **clean** tree, creates annotated `v<version>` at `HEAD`. Run after the bump commit.                                                                                                                                                               |
| `scripts/publish.sh`      | Clean tree + `HEAD` tagged with the canonical version → reproducible `npm ci`, build all workspaces, unit tests, then `npm publish --access public` per public workspace in dependency order. Flags: `--dry-run`, `--otp=…`, `--tag=next` (RCs).                                                  |
| `scripts/release.sh`      | From a **clean** tree: bump → `git commit` → tag (same as `tag-version.sh`) → `git push` / `git push --tags` → `publish.sh`.                                                                                                                                                                      |

Root shortcuts: `npm run version:bump`, `version:tag`, `version:sync`, `publish:all`, `release`.

**All-in-one (clean tree):** `npm run release -- minor` — bump, commit, tag, push, publish.

**Stepwise** (e.g. wait for CI binaries before npm): `npm run version:bump -- minor` → commit → `npm run version:tag` → `git push && git push --tags` → `npm run publish:all`.

The **`commentray-vscode`** package is **private** on npm; ship it with `npm run extension:package` and upload the `.vsix`.

Publishing is **manual** from a maintainer machine with **2FA** / OTP — not from GitHub Actions today. Prefer **OIDC trusted publishing** and **npm provenance** when automation lands: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers), [GitHub OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect). Avoid long-lived npm tokens in repo secrets unless there is no alternative.

Do not hand-edit `@commentray/*` version pins; `scripts/sync-workspace-deps.mjs` keeps them aligned with `packages/core/package.json`.
