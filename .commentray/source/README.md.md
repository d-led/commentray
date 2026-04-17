# Commentray — quick-start

_The companion Markdown for [`README.md`](https://github.com/d-led/commentray/blob/main/README.md). Read the left pane for the project summary; this pane is the shortest path from zero to productive._

## Why

Inline comments can't always live in the code: generated files, tight formats, policy constraints, or commentary long enough to need diagrams. Commentray keeps the source untouched and stores the _why_ next to it, in plain Markdown under `.commentray/source/` — the file you're reading is the companion of `README.md` itself.

## Start in 90 seconds

```bash
git clone https://github.com/d-led/commentray && cd commentray
npm run setup      # install, build, init, doctor — idempotent
```

Then choose how you want to author commentary:

- **In your editor** (Cursor / VS Code): [`npm run extension:install`](https://github.com/d-led/commentray/blob/main/scripts/install-extension.sh) packages and installs the `.vsix`. Open any file, run _Commentray: Open commentray beside source_, and start writing on the right.
- **From the shell**: [`npm run cli:install`](https://github.com/d-led/commentray/blob/main/scripts/install-cli.sh) puts `commentray` on your `PATH`. Run `commentray init` in any repo to scaffold the storage tree.

## You're looking at a generated page

This HTML was produced by [`code-commentray-static`](https://github.com/d-led/commentray/tree/main/packages/code-commentray-static) from [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml) via [`scripts/build-static-pages.mjs`](https://github.com/d-led/commentray/blob/main/scripts/build-static-pages.mjs), and deployed by [`pages.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/pages.yml). The same machinery will render any source + companion pair — point `[static_site].source_file` at your own file and rebuild.

## Cookbook

- **Adopt Commentray in your own repo** — run [`commentray init`](https://github.com/d-led/commentray/blob/main/packages/cli/src/init.ts) once; it's idempotent and lays down `.commentray/`, `.commentray.toml`, and an empty `metadata/index.json`.
- **Install a Git guard-rail** — [`commentray init scm`](https://github.com/d-led/commentray/blob/main/packages/cli/src/scm.ts) writes a `pre-commit` hook that runs [`commentray validate`](https://github.com/d-led/commentray/blob/main/packages/cli/src/validate.ts) so stale commentary can't land quietly.
- **Diagnose a setup** — [`commentray doctor`](https://github.com/d-led/commentray/blob/main/packages/cli/src/cli.ts) runs `validate` plus environment checks.
- **Ship a standalone binary** — no Node install needed; grab one per OS from [Releases](https://github.com/d-led/commentray/releases) or the [`binaries.yml` workflow](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml).
- **Publish a Pages site of your own** — copy [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml), tweak `[static_site]`, and run `npm run pages:build`.

## Architecture, one link each

- [`@commentray/core`](https://github.com/d-led/commentray/tree/main/packages/core/src) — TOML parser, metadata schema, Git SCM adapter, staleness helpers, path safety.
- [`@commentray/render`](https://github.com/d-led/commentray/tree/main/packages/render/src) — Markdown→sanitized HTML (GFM, `rehype-sanitize`), Mermaid containers, the side-by-side shell and the [`code-browser`](https://github.com/d-led/commentray/blob/main/packages/render/src/code-browser.ts) you're looking at.
- [`@commentray/cli`](https://github.com/d-led/commentray/tree/main/packages/cli/src) — every CLI subcommand lives here as its own small module.
- [`commentray-vscode`](https://github.com/d-led/commentray/tree/main/packages/vscode/src) — [`extension.ts`](https://github.com/d-led/commentray/blob/main/packages/vscode/src/extension.ts) opens source + companion in a split view with scroll sync.
- [`code-commentray-static`](https://github.com/d-led/commentray/tree/main/packages/code-commentray-static/src) — the generator that produced this page.

## Reference

- Storage layout: [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md)
- Anchor strategies: [`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md)
- Block grammar: [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
- Roadmap: [`docs/plan/plan.md`](https://github.com/d-led/commentray/blob/main/docs/plan/plan.md)
- Debugging the extension: [`docs/development.md`](https://github.com/d-led/commentray/blob/main/docs/development.md)
- Trust model & parsing guarantees: [`SECURITY.md`](https://github.com/d-led/commentray/blob/main/SECURITY.md)
- Quality gate & contribution flow: [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md)

## What Commentray is not

- Not a replacement for inline comments when those are the right fit.
- Not a blog engine — the companion Markdown travels with the code, in the same commit.
- Not tied to one editor — the CLI does everything the extension does, scriptably.
