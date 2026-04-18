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

**`Unsupported schemaVersion: …`** means the extension’s bundled `@commentray/core`
refuses that `index.json` shape (often: **Marketplace / old `.vsix` install** while
the repo’s CLI wrote a newer schema). **Fix:** from the Commentray repo run
`bash scripts/install-extension.sh`, then **Developer: Reload Window**.

**Dogfood** (`npm run extension:dogfood`) is now the same **install path** as
`bash scripts/install-extension.sh`: build → `.vsix` → uninstall old `d-led.commentray-vscode`
→ `--force` install, then open a **new** editor window on the folder (`-n` / `--new-window`
when supported). Use `npm run extension:dogfood:repo` to open this repo, or
`npm run extension:dogfood -- .` (npm requires `--` before `.`). Reload any tab that was
already on that folder.

**Install from repo** (`bash scripts/install-extension.sh`) is the same packaging and
install steps without opening a window afterward.

When `index.json` has a **higher** `schemaVersion` than the bundled library, opening
the repo now **writes a timestamped backup** next to `index.json`
(`index.schema-<N>-backup-<ms>.json`) and **rewrites** `index.json` to the schema this
build understands (best-effort). Prefer reinstalling from the same git revision so
you do not rely on downgrade.

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
