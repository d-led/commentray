# Commentray — a side-by-side documentation ecosystem

Have you ever wished a “commentary track” for code the way DVD extras let filmmakers talk over a film **without** changing the picture? When looking at code, that might answer the whys, reveal the intent **besides** the code itself.

## Why

Inline comments are not always possible (generated files, tight formats, policy). Commentray keeps the primary artifact clean while storing rationale, warnings, and diagrams in companion Markdown under `.commentray/`.

## What’s in this repo

- `@commentray/core`: models, TOML config, JSON metadata validation, Git SCM adapter, staleness helpers.
- `@commentray/render`: Markdown → HTML (GFM), syntax highlighting (rehype-highlight / lowlight), Mermaid containers, HTML shells (side-by-side + interactive static code browser with token-in-line search and jump).
- `code-commentray-static`: sample generator for a single static HTML “code + commentray” page (draggable splitter, code line-wrap toggle). Run `npm run code-commentray-static:build` (builds `@commentray/render` + this package, then writes `packages/code-commentray-static/site/index.html`). **GitHub Pages:** `[static_site]` in [`.commentray.toml`](.commentray.toml) drives `npm run pages:build` → `_site/index.html`; workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys on `main` (enable Pages → “GitHub Actions” in repo settings).
- `@commentray/cli`: `commentray` command for `init` (idempotent workspace setup), `init config`, `init scm` (git pre-commit hook), validate/doctor/migrate/render. **Standalone executables** (Node SEA, no separate Node install) are built per OS/arch in [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml) and attached to GitHub Releases on version tags; see **Standalone CLI binaries** below.
- `commentray-vscode`: VS Code / Cursor extension MVP (open paired commentray + basic scroll sync + workspace validation output; richer gutter UX is planned).

## Quickstart

```bash
npm install
npm run build
npm run commentray -- init
npm run commentray -- doctor
```

To get a global `commentray` on your `PATH` (symlinked to the local workspace build — no reinstall needed after rebuilds):

```bash
npm run cli:install      # bash scripts/install-cli.sh
# ...later:
npm run cli:uninstall    # bash scripts/install-cli.sh --unlink
```

Coverage (opens HTML report on macOS/Linux when possible):

```bash
npm run test:coverage
npm run test:coverage:all
```

## Standalone CLI binaries

The workflow [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml) produces one self-contained binary per row (uploaded as workflow artifacts on every run; on `v*` tags they are also attached to the GitHub Release):

| Runner                      | Artifact name (example)      |
| --------------------------- | ---------------------------- |
| Linux x64                   | `commentray-linux-x64`       |
| Linux arm64                 | `commentray-linux-arm64`     |
| macOS x64 (Intel)           | `commentray-darwin-x64`      |
| macOS arm64 (Apple Silicon) | `commentray-darwin-arm64`    |
| Windows x64                 | `commentray-windows-x64.exe` |

Local build (from repo root, after `npm ci`): `npm run binary:build` then `npm run binary:smoke`. On macOS, if your `node` is from **Homebrew**, set `COMMENTRAY_SEA_NODE` to a **nodejs.org**-style `node` binary (same major as CI, e.g. 22.x); the build script prints which binary it used.

**macOS quarantine (downloads):** if Gatekeeper blocks a downloaded binary, remove the quarantine attribute (pick one):

```bash
xattr -d com.apple.quarantine /path/to/commentray-darwin-arm64
```

To drop **all** extended attributes on that file (broader than quarantine only):

```bash
xattr -c /path/to/commentray-darwin-arm64
```

(`xattr -r` is not valid on macOS; use `find` with `-exec xattr -c` if you ever need a directory tree.)

## Layout

- Config: [`.commentray.toml`](.commentray.toml)
- Storage: [`.commentray/`](.commentray/)
- Spec: [`docs/spec/storage.md`](docs/spec/storage.md), [`docs/spec/anchors.md`](docs/spec/anchors.md), [`docs/spec/blocks.md`](docs/spec/blocks.md)
- Plan: [`docs/plan/plan.md`](docs/plan/plan.md)

## License

Packages in this monorepo are licensed under **MPL-2.0** (see `LICENSE` and per-package copies).

## Dogfood the editor extension (Cursor / VS Code)

Build `@commentray/core` + the extension, then launch your editor with the extension loaded from `packages/vscode` (no `.vsix` required):

```bash
npm run extension:dogfood
```

Open another folder:

```bash
npm run extension:dogfood -- /path/to/project
```

If both `cursor` and `code` exist on `PATH`, **Cursor wins**; override with:

```bash
COMMENTRAY_EDITOR=code npm run extension:dogfood
```

Packaging a self-contained `.vsix` from this monorepo needs a small bundling step (so `@commentray/core` ships inside the extension). Until that exists, **dogfood mode is the supported workflow**.

## On the Name

**Repository:** [github.com/d-led/commentray](https://github.com/d-led/commentray). The name **Commentray** avoids collision with the unrelated VSX id [`jaredhughes.commentary`](https://marketplace.cursorapi.com/items/?itemName=jaredhughes.commentary) on Open VSX.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).
