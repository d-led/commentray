# Contributing

Thank you for helping build Commentray.

**Terminology:** **Commentray** (capitalized) is the tool and packages in this repo. **commentray** (lowercase) is also what we call the paired Markdown under `.commentray/source/`—the thing you write _in commentray_ next to a source file (e.g. _“we have to document our architecture in commentray so that newcomers can have an effective source code onboarding experience”_).

## Principles (aspiration)

We like the lightweight spirit described in the Collective Code Construction Contract (C4), as linked from the [chumak contributing guide](https://raw.githubusercontent.com/zeromq/chumak/refs/heads/master/CONTRIBUTING.md). We are **not** claiming full C4 compliance yet; we grow conventions **continuously and on demand**.

## Practical process

- Open an issue before very large changes unless you have maintainer alignment.
- Keep pull requests focused; prefer several small PRs over one sweeping refactor.
- Before asking for review, follow the **Keeping quality high** section below.
- For extension-specific debugging (Output channels, Extension Host logs), see [`docs/development.md`](docs/development.md).
- **CLI init:** `npm run commentray -- init` is idempotent (storage dirs, seed `index.json` and `.commentray.toml` if missing). Use `npm run commentray -- init config` to ensure TOML defaults, or `init config --force` to replace. `npm run commentray -- init scm` installs or refreshes a marked block in `.git/hooks/pre-commit` that runs `commentray validate` when `node_modules/.bin/commentray` exists at the repo root.
- **Standalone CLI binaries:** `npm run binary:build` then `npm run binary:smoke` (see README **Standalone CLI binaries**). CI builds Linux x64/arm64, macOS x64/arm64, and Windows x64 via [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml). Workflow **artifacts expire** (14-day retention); **`v*`** tags attach the same files to a **[GitHub Release](https://github.com/d-led/commentray/releases)** as the durable download location (GitHub’s native release asset store—no separate artifact registry). On macOS with Homebrew Node, use `COMMENTRAY_SEA_NODE` pointing at an official `node` binary when building locally.
- **GitHub Pages:** configure `[static_site]` in `.commentray.toml` (title, intro Markdown, `github_url`, `source_file`, optional `commentray_markdown`). Run `npm run pages:build` to emit `_site/index.html`. The `pages.yml` workflow deploys on `main` once **Settings → Pages → Build: GitHub Actions** is enabled.

## Keeping quality high

These are not bureaucracy; they are the habits that keep this repo cheap to change.

**One command before every review: `npm run quality:gate`.** It runs
`scripts/quality-gate.sh`: format check, project + refactor-metrics
ESLint, `jscpd` duplicate detection, a full `tsc -b` across the
monorepo, and the unit tests. `ci:quick` and the GitHub Actions
`ci.yml` pipeline invoke the same script, so local green ≈ CI green.
For the slow lane (integration + expensive tests) run
`npm run ci:full`.

- **Tests always green, always run.** Before asking for review:
  - `npm run test:unit` (fast, default).
  - `npm run test:integration` if the PR touches the Git SCM adapter, `.commentray/` layout, or any fixture-backed behavior.
  - `npm run test:expensive` on demand for fuzzed / large-repo suites.
  - Red tests are never skipped. Fix the implementation or fix the test — whichever is wrong — but never silence a failure with a conditional, a `try`/`catch`, or an `xit`/`.skip`.
- **Lint never relaxed.** `npm run lint` runs the project ESLint pass, `shellcheck` against every script under `scripts/`, **and** a refactor-metrics pass (complexity, size, async hygiene). Treat findings as design feedback: refactor, extract, simplify. Do not widen ignore lists or raise thresholds to hide them. If `shellcheck` is not installed locally the script skips with a note (CI always runs it).
- **Duplicate detection taken seriously.** `npm run dupes` runs `jscpd`. Address flagged clones by extracting a shared helper, not by bumping the threshold or adding exclusions. `npm run quality` runs lint + dupes together; CI's quick path runs them with **no relaxations**.
- **Dependencies stay fresh.**
  - Preview: `npm run deps:upgrade -- --check` (delegates to `taze` recursively; excludes intra-monorepo packages).
  - Apply: `npm run deps:upgrade` (default: major). Also accepts `minor`, `patch`, `latest`. The script writes package.json changes, re-pins `@commentray/*` via `scripts/sync-workspace-deps.mjs`, and reinstalls to regenerate the lockfile. Follow up with `npm run quality:gate`.
  - Prefer routine, small update PRs over big year-end bumps.
  - `npm audit --audit-level=high` runs informationally in CI; triage real findings instead of muting them. Don't add blanket `--force` upgrades; update the offending package or its parent.
  - `package-lock.json` is committed and authoritative; regenerate it intentionally, not as a side-effect.
  - When adding a new runtime dependency, justify it in the PR description (pick one existing choice over a new transitive surface when reasonable).
- **Format before committing.** `npm run format` (write) and `npm run format:check` (verify). CI runs the check; a failing format gate should never be the reason a PR blocks.
- **Coverage is observed, not gamed.** `npm run test:coverage` (unit) and `npm run test:coverage:all` (unit + integration) write HTML + `lcov` under `./coverage/` (gitignored) and open `coverage/index.html` when possible (`COMMENTRAY_COVERAGE_OPEN=0` to suppress). Treat coverage as a discovery tool: modules trending to zero deserve attention; 100% on trivial files proves nothing.
- **Prefer behavior tests.** Tests should read like `given … when … then …`. If you find yourself asserting implementation details (private calls, concrete types behind interfaces, exact formulas), the test is probably the wrong abstraction — refactor it.
- **Small, reversible changes.** Keep PRs shaped so that a revert is a one-commit operation. Land refactors that don't change behavior in their own PRs so that feature PRs remain easy to review.
- **Automate multi-step invocations.** If a task needs more than two commands run in sequence, add a script to `scripts/` and wire an `npm run …` entry — do not bury the sequence in documentation where it will rot. Docs cite the script; the script is the source of truth. Menus of alternative single commands (e.g. `extension:install`, `extension:package`, `extension:uninstall`) are fine as lists; _sequences_ are not. Current examples: `scripts/setup.sh` (install → build → init → doctor), `scripts/release.sh` (bump → commit → tag → push → publish), `scripts/quality-gate.sh` (format → lint × 2 → shellcheck → dupes → typecheck → unit tests).

## Package managers

This repository is developed with **npm** (`package-lock.json` is committed).

**Yarn** is supported as an alternative install path via `.yarnrc.yml` (`nodeLinker: node-modules`). If you use Yarn, you are responsible for keeping `yarn.lock` consistent with the repo policy discussed in PRs.

## Dogfood the `commentray-vscode` extension

### `npm run extension:dogfood` (install from this repo + open a folder)

Dogfood runs the **same** steps as `bash scripts/install-extension.sh` (build `@commentray/core`,
esbuild the extension, `vsce package`, uninstall any old `d-led.commentray-vscode`,
`--force` install the new `.vsix`), then opens a **new** editor window on a folder.

From the repo root:

```bash
npm run extension:dogfood              # install + open packages/vscode/fixtures/dogfood
npm run extension:dogfood:repo           # install + open this repo (repo root)
npm run extension:dogfood -- .           # install + open this repo (`--` forwards `.` to npm scripts)
npm run extension:dogfood -- /path/to/project
```

Override the editor CLI with `COMMENTRAY_EDITOR` (same as the install script).

Reload the editor window if that workspace was already open so it picks up the new install.

### `npm run extension:install` (install only, no folder launch)

Same build/package/install as dogfood, without opening a window afterward:

```bash
npm run extension:install       # build, bundle, package, install the .vsix
npm run extension:uninstall     # remove it
```

After install, reload the target window so `Commentray:` commands are registered.

## Expensive CI

GitHub Actions workflow `ci-expensive.yml` runs on:

- manual `workflow_dispatch`, and
- pull requests labeled `run-expensive-ci`.

Maintainers may additionally protect these jobs with a GitHub Environment (optional) to require approval before secrets-heavy steps are introduced later.

## Publishing to npm (maintainers)

Release scripts are split on purpose: **bumping** versions is not the same
as **tagging** a release.

- `scripts/bump-version.sh` — bumps every workspace `package.json` in
  lockstep, runs `scripts/sync-workspace-deps.mjs` so intra-monorepo
  `@commentray/*` pins follow along, refreshes `package-lock.json`, and
  updates `CHANGELOG.md` when an `[Unreleased]` section exists. Supports
  `patch`, `minor`, `major`, `rc`, `release`, `set <version>`, and
  `--dry-run`. Does **not** run git: you can run it on a dirty tree, commit
  the result with your other work, then tag when ready.
- `scripts/tag-version.sh` — reads `packages/core/package.json`, requires a
  **clean** working tree, and creates the annotated `v<version>` tag at
  `HEAD`. Use after the version bump is committed.
- `scripts/publish.sh` — verifies the working tree is clean and that
  HEAD is tagged with the canonical version, runs a reproducible
  `npm ci`, builds all workspaces, runs unit tests, then
  `npm publish --access public` for each public workspace in dependency
  order. Supports `--dry-run`, `--otp=…`, and `--tag=next` (for RCs).
- `scripts/release.sh` — from a **clean** tree: runs bump, then `git
commit`, then `tag-version.sh`-equivalent tagging, then `git push` /
  `git push --tags`, then `publish.sh`.

Convenience scripts are wired at the repo root: `npm run version:bump`,
`npm run version:tag`, `npm run version:sync`, `npm run publish:all`, and
`npm run release`.

Typical flow (all-in-one, clean tree):

```bash
npm run release -- minor        # bump → commit → tag → push → publish
```

If you need to bump versions while other files are still dirty, or to
pause between steps (e.g. wait for CI binary builds before publishing):

```bash
npm run version:bump -- minor   # file edits only
git add -A && git commit -m "Bump version to …"
npm run version:tag
git push && git push --tags     # CI builds SEA binaries
npm run publish:all             # publish to npm
```

The `commentray-vscode` extension is private on npm and is released by
packaging a `.vsix` (`npm run extension:package`) and uploading it.

**npm publishing** is **manual** from a maintainer machine (`npm run publish:all`, with **2FA** / OTP as required by npm)—we do **not** publish from GitHub Actions today so no publish token lives in CI. That may change later (e.g. OIDC trusted publishing).

When automating in the future, prefer **OIDC trusted publishing** and **npm provenance** for `@commentray/*` packages:

- npm documentation: [Trusted publishing with OIDC](https://docs.npmjs.com/trusted-publishers)
- GitHub documentation: [OIDC for publishing](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

Avoid long-lived publish tokens in repository secrets unless there is no alternative.

## Security

Please report security issues privately to repository maintainers until a dedicated security policy is published.
