# Install Commentray

Pick one path: **release binary** (no Node — assets on [GitHub Releases](https://github.com/d-led/commentray/releases) under **`v*`** tags), **npm global** (needs Node), or **clone the repo** for extension packaging / full development ([Development → Clone and workspace setup](../development.md#clone-and-workspace-setup)).

## Standalone CLI binaries (GitHub Releases)

Official builds ship from [`.github/workflows/binaries.yml`](../../.github/workflows/binaries.yml): one self-contained executable per OS/arch (Node SEA).

**[GitHub Releases](https://github.com/d-led/commentray/releases)** publishes standalone CLI assets on **`v*`** tags. To install:

1. Open the [releases page](https://github.com/d-led/commentray/releases) and download the binary for your platform (for example `commentray-darwin-arm64` on Apple Silicon).
2. Put the file on your `PATH` and mark it executable (`chmod +x …` on Unix).
3. Run `commentray --version`.

You can still use [npm global](#npm-global-commentray-on-path) or work from a [clone](../development.md#clone-and-workspace-setup). A local **SEA** binary from source is a maintainer-style build—see [Building binaries locally](../development.md#building-binaries-locally).

**Workflow run artifacts** (not Releases) expire after about two weeks—prefer **Release** assets for anything you rely on long term.

If macOS blocks a downloaded binary (quarantine), see [Development → macOS quarantine](../development.md#macos-quarantine-standalone-cli).

## npm global (`commentray` on PATH)

Requires a supported **Node.js** version (see repo CI matrices).

```bash
npm install -g commentray
commentray --version
```

Upgrade later with the same `npm install -g` command.

## VS Code / Cursor extension

**Published:** install [`d-led.commentray-vscode`](https://marketplace.visualstudio.com/items?itemName=d-led.commentray-vscode) from the Marketplace (or your editor’s extensions UI). `commentray init` merges this id into `.vscode/extensions.json` when that file is mergeable JSON.

**From a built `.vsix` in this repo:**

```bash
npm run extension:install    # build, package, install
# or: npm run extension:package   → packages/vscode/dist/*.vsix
```

Dogfood flow (fixture or repo): see **Editor extension workflows** in [`docs/development.md`](../development.md#editor-extension-workflows).

### Which editor binary?

If both `cursor` and `code` exist on `PATH`, scripts prefer **Cursor**. Override:

```bash
COMMENTRAY_EDITOR=code npm run extension:dogfood
```

## Next steps

- [Quickstart](quickstart.md) — first commentray file and validate.
- [Keeping blocks in sync](keeping-blocks-in-sync.md) — index, markers, anchors.
