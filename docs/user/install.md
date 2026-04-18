# Install Commentray

Pick one path: **release binary** (no Node), **npm global** (needs Node), or **from this monorepo** (contributors and dogfooders).

## Standalone CLI binaries (GitHub Releases)

Official builds ship from [`.github/workflows/binaries.yml`](../../.github/workflows/binaries.yml): one self-contained executable per OS/arch (Node SEA).

1. Open the project’s [GitHub Releases](https://github.com/d-led/commentray/releases) and download the artifact for your platform (for example `commentray-darwin-arm64` on Apple Silicon).
2. Put the file on your `PATH` and mark it executable (`chmod +x …` on Unix).
3. Run `commentray --version`.

**Workflow run artifacts** (not Releases) expire after about two weeks—prefer **Release** assets for anything you rely on.

### macOS Gatekeeper

If macOS blocks a downloaded binary, clear the quarantine extended attribute on that file:

```bash
xattr -d com.apple.quarantine /path/to/commentray-darwin-arm64
```

Broader cleanup (all extended attributes on one file):

```bash
xattr -c /path/to/commentray-darwin-arm64
```

(`xattr -r` is not valid on macOS; use `find … -exec` only if you truly need a tree.)

### Building binaries locally (advanced)

From a clone: `npm ci`, then `npm run binary:build` and `npm run binary:smoke`. If your `node` is from **Homebrew**, the SEA build may need a **nodejs.org**-style Node of the same major as CI—set **`COMMENTRAY_SEA_NODE`** to that binary’s path (the build script logs what it used). See the root [`README.md`](../../README.md#standalone-cli-binaries).

## npm global (`commentray` on PATH)

Requires a supported **Node.js** version (see repo CI matrices).

```bash
npm install -g @commentray/cli
commentray --version
```

Upgrade later with the same `npm install -g` command.

## From a clone of this repository

For extension dogfood, Pages builds, or CLI development:

```bash
git clone https://github.com/d-led/commentray.git
cd commentray
npm ci
npm run setup          # install, build, init, doctor — idempotent
```

Symlink the workspace CLI (rebuilds pick up without reinstalling):

```bash
npm run cli:install    # bash scripts/install-cli.sh
# later: npm run cli:uninstall
```

## VS Code / Cursor extension

**Published:** install [`d-led.commentray-vscode`](https://marketplace.visualstudio.com/items?itemName=d-led.commentray-vscode) from the Marketplace (or your editor’s extensions UI). `commentray init` merges this id into `.vscode/extensions.json` when that file is mergeable JSON.

**From a built `.vsix` in this repo:**

```bash
npm run extension:install    # build, package, install
# or: npm run extension:package   → packages/vscode/dist/*.vsix
```

Dogfood flow (fixture or repo): see **Dogfood the editor extension** in the root [`README.md`](../../README.md#dogfood-the-editor-extension-cursor--vscode).

### Which editor binary?

If both `cursor` and `code` exist on `PATH`, scripts prefer **Cursor**. Override:

```bash
COMMENTRAY_EDITOR=code npm run extension:dogfood
```

## Next steps

- [Quickstart](quickstart.md) — first commentray file and validate.
- [Keeping blocks in sync](keeping-blocks-in-sync.md) — index, markers, anchors.
