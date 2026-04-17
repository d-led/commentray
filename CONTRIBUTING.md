# Contributing

Thank you for helping build Commentray.

## Principles (aspiration)

We like the lightweight spirit described in the Collective Code Construction Contract (C4), as linked from the [chumak contributing guide](https://raw.githubusercontent.com/zeromq/chumak/refs/heads/master/CONTRIBUTING.md). We are **not** claiming full C4 compliance yet; we grow conventions **continuously and on demand**.

## Practical process

- Open an issue before very large changes unless you have maintainer alignment.
- Keep pull requests focused; prefer several small PRs over one sweeping refactor.
- Before asking for review, follow the **Keeping quality high** section below.
- **CLI init:** `npm run commentray -- init` is idempotent (storage dirs, seed `index.json` and `.commentray.toml` if missing). Use `npm run commentray -- init config` to ensure TOML defaults, or `init config --force` to replace. `npm run commentray -- init scm` installs or refreshes a marked block in `.git/hooks/pre-commit` that runs `commentray validate` when `node_modules/.bin/commentray` exists at the repo root.
- **Standalone CLI binaries:** `npm run binary:build` then `npm run binary:smoke` (see README **Standalone CLI binaries**). CI builds Linux x64/arm64, macOS x64/arm64, and Windows x64 via [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml); tags matching `v*` publish those files to the GitHub Release. On macOS with Homebrew Node, use `COMMENTRAY_SEA_NODE` pointing at an official `node` binary when building locally.
- **GitHub Pages:** configure `[static_site]` in `.commentray.toml` (title, intro Markdown, `github_url`, `source_file`, optional `commentray_markdown`). Run `npm run pages:build` to emit `_site/index.html`. The `pages.yml` workflow deploys on `main` once **Settings → Pages → Build: GitHub Actions** is enabled.

## Keeping quality high

These are not bureaucracy; they are the habits that keep this repo cheap to change.

- **Tests always green, always run.** Before asking for review:
  - `npm run test:unit` (fast, default).
  - `npm run test:integration` if the PR touches the Git SCM adapter, `.commentray/` layout, or any fixture-backed behavior.
  - `npm run test:expensive` on demand for fuzzed / large-repo suites.
  - Red tests are never skipped. Fix the implementation or fix the test — whichever is wrong — but never silence a failure with a conditional, a `try`/`catch`, or an `xit`/`.skip`.
- **Lint never relaxed.** `npm run lint` runs the project ESLint pass **and** a refactor-metrics pass (complexity, size, async hygiene). Treat findings as design feedback: refactor, extract, simplify. Do not widen ignore lists or raise thresholds to hide them.
- **Duplicate detection taken seriously.** `npm run dupes` runs `jscpd`. Address flagged clones by extracting a shared helper, not by bumping the threshold or adding exclusions. `npm run quality` runs lint + dupes together; CI's quick path runs them with **no relaxations**.
- **Dependencies stay fresh.**
  - Watch `npm outdated` periodically; prefer routine, small update PRs over big year-end bumps.
  - `npm audit --audit-level=high` runs informationally in CI; triage real findings instead of muting them. Don't add blanket `--force` upgrades; update the offending package or its parent.
  - `package-lock.json` is committed and authoritative; regenerate it intentionally, not as a side-effect.
  - When adding a new runtime dependency, justify it in the PR description (pick one existing choice over a new transitive surface when reasonable).
- **Format before committing.** `npm run format` (write) and `npm run format:check` (verify). CI runs the check; a failing format gate should never be the reason a PR blocks.
- **Coverage is observed, not gamed.** `npm run test:coverage` (unit) and `npm run test:coverage:all` (unit + integration) write HTML + `lcov` under `./coverage/` (gitignored) and open `coverage/index.html` when possible (`COMMENTRAY_COVERAGE_OPEN=0` to suppress). Treat coverage as a discovery tool: modules trending to zero deserve attention; 100% on trivial files proves nothing.
- **Prefer behavior tests.** Tests should read like `given … when … then …`. If you find yourself asserting implementation details (private calls, concrete types behind interfaces, exact formulas), the test is probably the wrong abstraction — refactor it.
- **Small, reversible changes.** Keep PRs shaped so that a revert is a one-commit operation. Land refactors that don't change behavior in their own PRs so that feature PRs remain easy to review.

## Package managers

This repository is developed with **npm** (`package-lock.json` is committed).

**Yarn** is supported as an alternative install path via `.yarnrc.yml` (`nodeLinker: node-modules`). If you use Yarn, you are responsible for keeping `yarn.lock` consistent with the repo policy discussed in PRs.

## Dogfood the `commentray-vscode` extension

From the repo root:

```bash
npm run extension:dogfood
```

This builds `@commentray/core` and the extension, then starts **Cursor** (if `cursor` is on `PATH`) or **VS Code** with `--extensionDevelopmentPath=packages/vscode`. Override the editor binary with `COMMENTRAY_EDITOR`.

The Extension Development Host runs with an isolated `--user-data-dir` and `--extensions-dir` under `.commentray-dev/` (git-ignored) so you can open this repo in the dev host alongside your normal Cursor window — without the editor's "one folder per profile" rule stealing focus back to your main window.

## Expensive CI

GitHub Actions workflow `ci-expensive.yml` runs on:

- manual `workflow_dispatch`, and
- pull requests labeled `run-expensive-ci`.

Maintainers may additionally protect these jobs with a GitHub Environment (optional) to require approval before secrets-heavy steps are introduced later.

## Publishing to npm (maintainers)

Prefer **OIDC trusted publishing** and **npm provenance** for `@commentray/*` packages:

- npm documentation: [Trusted publishing with OIDC](https://docs.npmjs.com/trusted-publishers)
- GitHub documentation: [OIDC for publishing](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

Avoid long-lived publish tokens in repository secrets unless there is no alternative.

## Security

Please report security issues privately to repository maintainers until a dedicated security policy is published.
