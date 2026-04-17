# Commentary - a Side-By-Side Documentation Ecosystem

Have you ever wished a “commentary track” for code the way DVD extras let filmmakers talk over a film **without** changing the picture? When looking at code, that might answer the whys, reveal the intent **besides** the code itself.

## Why

Inline comments are not always possible (generated files, tight formats, policy). Commentary keeps the primary artifact clean while storing rationale, warnings, and diagrams in companion Markdown under `.commentary/`.

## What’s in this repo

- `@commentary/core`: models, TOML config, JSON metadata validation, Git SCM adapter, staleness helpers.
- `@commentary/render`: Markdown → HTML (GFM), syntax highlighting (rehype-highlight / lowlight), Mermaid containers, HTML shells (side-by-side + interactive static code browser with token-in-line search and jump).
- `code-commentary-static`: sample generator for a single static HTML “code + commentary” page (draggable splitter, code line-wrap toggle). Run `npm run code-commentary-static:build` (builds `@commentary/render` + this package, then writes `packages/code-commentary-static/site/index.html`). **GitHub Pages:** `[static_site]` in [`.commentary.toml`](.commentary.toml) drives `npm run pages:build` → `_site/index.html`; workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys on `main` (enable Pages → “GitHub Actions” in repo settings).
- `@commentary/cli`: `commentary` command for `init` (idempotent workspace setup), `init config`, `init scm` (git pre-commit hook), validate/doctor/migrate/render.
- `commentary-vscode`: VS Code / Cursor extension MVP (open paired commentary + basic scroll sync + workspace validation output; richer gutter UX is planned).

## Quickstart

```bash
npm install
npm run build
npm run commentary -- init
npm run commentary -- doctor
```

Coverage (opens HTML report on macOS/Linux when possible):

```bash
npm run test:coverage
npm run test:coverage:all
```

## Layout

- Config: [`.commentary.toml`](.commentary.toml)
- Storage: [`.commentary/`](.commentary/)
- Spec: [`docs/spec/storage.md`](docs/spec/storage.md), [`docs/spec/anchors.md`](docs/spec/anchors.md), [`docs/spec/blocks.md`](docs/spec/blocks.md)
- Plan: [`docs/plan/plan.md`](docs/plan/plan.md)

## License

Packages in this monorepo are licensed under **MPL-2.0** (see `LICENSE` and per-package copies).

## Dogfood the editor extension (Cursor / VS Code)

Build `@commentary/core` + the extension, then launch your editor with the extension loaded from `packages/vscode` (no `.vsix` required):

```bash
npm run extension:dogfood
```

Open another folder:

```bash
npm run extension:dogfood -- /path/to/project
```

If both `cursor` and `code` exist on `PATH`, **Cursor wins**; override with:

```bash
COMMENTARY_EDITOR=code npm run extension:dogfood
```

Packaging a self-contained `.vsix` from this monorepo needs a small bundling step (so `@commentary/core` ships inside the extension). Until that exists, **dogfood mode is the supported workflow**.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).
