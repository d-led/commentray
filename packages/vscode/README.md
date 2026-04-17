# Commentray for VS Code / Cursor

Side-by-side authoring for [Commentray](https://github.com/d-led/commentray):
out-of-file Markdown "commentary tracks" for any source file in your
workspace.

## Commands

- `Commentray: Open commentray beside source` — opens (or creates) the
  commentray Markdown file that is paired with the active source file,
  side-by-side, with scroll sync from the code editor to the Markdown.
- `Commentray: Open Markdown preview for commentray file` — opens VS Code's
  built-in Markdown preview for the active `.md` file.
- `Commentray: Validate workspace metadata` — runs the same validation as
  `commentray validate` and prints issues to the _Commentray_ output channel.

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
