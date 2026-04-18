# Commentray for VS Code / Cursor

Side-by-side authoring for [Commentray](https://github.com/d-led/commentray):
out-of-file Markdown "commentary tracks" for any source file in your
workspace.

## Commands

- `Commentray: Open commentray beside source` — opens (or creates) the
  commentray Markdown file that is paired with the active source file,
  side-by-side. While the pair is active, **scroll sync** keeps the two panes
  aligned: scrolling the source updates the commentray view, and scrolling
  the commentray snaps the source to the block you are reading. When you have
  [blocks](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
  (metadata index + `<!-- commentray:block id=… -->` markers), sync prefers
  those anchors; otherwise it falls back to a simple proportional map.
- `Commentray: Add block from selection` — appends a new block for the current
  selection (or current line) to the paired Markdown, updates
  `.commentray/metadata/index.json`, opens the pair, and selects the
  placeholder so you can type immediately. Default keybinding: **Cmd+Alt+K**
  (macOS) / **Ctrl+Alt+K** (Windows/Linux). Also available from the editor
  context menu under the same commands as _Open commentray beside source_.
- `Commentray: Open Markdown preview for commentray file` — opens VS Code's
  built-in Markdown preview for the active `.md` file.
- `Commentray: Validate workspace metadata` — runs the same validation as
  `commentray validate` and prints issues to the _Commentray_ output channel.

## Metadata vs Markdown

Commentray keeps **block records** (anchor, optional snippet, verification fields) in
`.commentray/metadata/index.json` under each companion file path. The Markdown
track holds **`<!-- commentray:block id=… -->`** markers so tools know **where**
each block’s prose lives and can scroll-sync; `commentray init` / `migrate` update
**shape** (e.g. legacy fingerprint → snippet), they do **not** move the canonical
block list out of the index.

## Troubleshooting

**`Unsupported schemaVersion: …`** — the extension’s bundled `@commentray/core` does not accept the current `index.json` shape. From the Commentray repo run `bash scripts/install-extension.sh`, then reload the editor window.

**Dogfood** (`npm run extension:dogfood`) matches `bash scripts/install-extension.sh` (build, package `.vsix`, install), then opens a new editor window on a folder. Use `npm run extension:dogfood:repo` for this repo, or `npm run extension:dogfood -- .` (use `--` so npm forwards `.`). Reload the window if that workspace was already open.

**Install from repo** (`bash scripts/install-extension.sh`) performs the same packaging and install steps without opening a folder afterward.

When `index.json` has a **higher** `schemaVersion` than the bundled library, the extension writes a timestamped backup next to `index.json` (`index.schema-<N>-backup-<ms>.json`) and rewrites `index.json` to a schema this build understands.

## Pairing convention

For a source file at repo-relative path `src/foo.ts`, the paired commentray
file is `.commentray/source/src/foo.ts.md`. Missing files are created on
demand (with a `# Commentray` placeholder) the first time you invoke
_Open commentray beside source_.

## Install

From a release `.vsix`:

```bash
code --install-extension commentray-vscode-<version>.vsix
# or: cursor --install-extension commentray-vscode-<version>.vsix
```

From the monorepo (builds + bundles + installs into your editor):

```bash
npm run extension:install
```

## License

[MPL-2.0](https://github.com/d-led/commentray/blob/main/LICENSE)
