# Contributing

Thank you for helping build Commentray.

## Principles (aspiration)

We like the lightweight spirit described in the Collective Code Construction Contract (C4), as linked from the [chumak contributing guide](https://raw.githubusercontent.com/zeromq/chumak/refs/heads/master/CONTRIBUTING.md). We are **not** claiming full C4 compliance yet; we grow conventions **continuously and on demand**.

## Practical process

- Open an issue before very large changes unless you have maintainer alignment.
- Keep pull requests focused; prefer several small PRs over one sweeping refactor.
- Follow existing formatting (`npm run format`) and lint (`npm run lint`).
- **Quality bar:** `npm run lint` already runs a second ESLint pass (refactor metrics: complexity, size, async hygiene). `npm run dupes` runs clone detection (`jscpd`). You can run both in one go with `npm run quality`. CI’s quick path runs lint and dupes with **no relaxations**—fix findings by refactoring or deduplicating code rather than widening ignores or thresholds.
- **CLI init:** `npm run commentray -- init` is idempotent (storage dirs, seed `index.json` and `.commentray.toml` if missing). Use `npm run commentray -- init config` to ensure TOML defaults, or `init config --force` to replace. `npm run commentray -- init scm` installs or refreshes a marked block in `.git/hooks/pre-commit` that runs `commentray validate` when `node_modules/.bin/commentray` exists at the repo root.
- **Standalone CLI binaries:** `npm run binary:build` then `npm run binary:smoke` (see README **Standalone CLI binaries**). CI builds Linux x64/arm64, macOS x64/arm64, and Windows x64 via [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml); tags matching `v*` publish those files to the GitHub Release. On macOS with Homebrew Node, use `COMMENTRAY_SEA_NODE` pointing at an official `node` binary when building locally.
- **GitHub Pages:** configure `[static_site]` in `.commentray.toml` (title, intro Markdown, `github_url`, `source_file`, optional `commentray_markdown`). Run `npm run pages:build` to emit `_site/index.html`. The `pages.yml` workflow deploys on `main` once **Settings → Pages → Build: GitHub Actions** is enabled.
- Run tests locally:
  - `npm run test:unit` (default, fast)
  - `npm run test:integration` (Git-backed checks)
  - `npm run test:expensive` (reserved for heavier suites)
- Coverage (HTML + `lcov` under `./coverage/`, gitignored):
  - `npm run test:coverage` — unit tests only, then opens `coverage/index.html` when possible
  - `npm run test:coverage:all` — unit + integration, then opens the report
  - `COMMENTRAY_COVERAGE_OPEN=0 npm run test:coverage` — run without opening a browser

## Package managers

This repository is developed with **npm** (`package-lock.json` is committed).

**Yarn** is supported as an alternative install path via `.yarnrc.yml` (`nodeLinker: node-modules`). If you use Yarn, you are responsible for keeping `yarn.lock` consistent with the repo policy discussed in PRs.

## Dogfood the `commentray-vscode` extension

From the repo root:

```bash
npm run extension:dogfood
```

This builds `@commentray/core` and the extension, then starts **Cursor** (if `cursor` is on `PATH`) or **VS Code** with `--extension-development-path=packages/vscode`. Override the editor binary with `COMMENTRAY_EDITOR`.

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
