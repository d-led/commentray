# Development

Hands-on notes for working on Commentray itself: building, debugging, and
observing the editor extension while dogfooding. If you just want to
install Commentray to use it, see the top-level `README.md`.

## Layout

- `packages/core` — shared library (`.commentray.toml` parsing, path
  normalization, metadata schema, validation, git adapter).
- `packages/render` — Markdown → HTML renderer + client-side bundle for
  the static site.
- `packages/cli` — the `commentray` CLI (also packaged as a standalone
  Node SEA binary).
- `packages/code-commentray-static` (`@commentray/code-commentray-static` on npm) — static-site generator for the
  rendered commentary pages.
- `packages/vscode` — VS Code / Cursor extension.

## Quality gate

One command gates every review:

```bash
npm run quality:gate   # format check, ESLint x2, shellcheck, jscpd, tsc -b, unit tests
```

Slow lane (integration + expensive suites) on top of the gate:

```bash
npm run ci:full
```

If a check is failing, fix the root cause. Do not widen ignore lists or
raise thresholds to hide it. See `CONTRIBUTING.md` for the reasoning.

## Editor extension workflows

### 1. Dogfood: install from this repo + open a folder

`npm run extension:dogfood` runs **`scripts/install-extension.sh`** (build, bundle,
package `.vsix`, uninstall old id, `--force` install), then opens a new editor window on
a folder (`-n` / `--new-window` when the CLI supports it).

```bash
npm run extension:dogfood           # fixture workspace
npm run extension:dogfood:repo      # this monorepo root
npm run extension:dogfood -- .      # same; `--` forwards `.` to the script
```

After changing extension sources, re-run dogfood or `npm run extension:install`, then reload
the window if that workspace was already open.

### 2. Install only (no automatic folder launch)

```bash
npm run extension:install      # build + bundle + package + install
npm run extension:package      # build + bundle + package only (no install)
npm run extension:uninstall    # remove it
```

The installer script bundles the extension with esbuild (inlining
`@commentray/core`) before `vsce` packages the `.vsix`.

### 3. Extension Development Host + debugger (F5)

To set breakpoints in `packages/vscode/src/**`, open the `packages/vscode` folder in the
editor and use the **Run and Debug** / **Extension** launch configuration (add
`launch.json` if your editor has not generated one). That path attaches a debugger;
`npm run extension:dogfood` installs the packaged extension into your normal editor instead.

## Scroll sync and paired panes

After **Commentray: Open commentray beside source** (or **Add block from
selection**, which opens the pair for you), the extension wires a scroll
listener on **both** editors:

- **Source → commentray:** the top visible line of the source picks a target
  line in the Markdown. If `index.json` lists `lines:` anchors that match
  `<!-- commentray:block id=… -->` markers in the commentray file, the
  commentary scroll snaps to the block whose source range **contains** that
  top line (or the nearest sensible block when you are in a gap). Without
  blocks, a lightweight proportional scroll is used instead.
- **Commentray → source:** the top visible line in the Markdown maps back to
  the start of the corresponding source range for the same block list.

Edits to either file or saving `index.json` refresh the block map on a short
debounce so markers and metadata edits stay in sync without reloading the
window.

## Observing the extension at runtime

### The `Commentray` output channel

The extension creates an output channel named **Commentray** for
user-facing reports. Today it is only written to by **Commentray:
Validate workspace metadata**, which dumps each validation issue there
and reveals the panel. To view:

- Open the Output panel: **View → Output** (or `Cmd/Ctrl+Shift+U`).
- Pick **Commentray** from the dropdown on the right of the panel.

If you are adding a new command and want visible, structured logging,
reuse that same channel rather than `console.log` — users see Output,
they do not see the Developer Tools console.

### Extension Host log

Activation errors and stack traces from the extension host appear under **Developer: Show Logs… → Extension Host**.

### The Developer Tools console

For extension code paths that touch the webview preview or for any
`console.log` calls in the extension itself:

- Command Palette → **Developer: Toggle Developer Tools**.
- Console tab shows `console.log` output from both the extension host
  and any webviews.

## Debugging

`npm run extension:dogfood` installs the packaged build into your normal editor without a debugger; use **Run and Debug** on the `packages/vscode` workspace to attach one.

If a `Commentray:` command is missing after install, run `npm run extension:install` (or dogfood) and reload the window. After editing extension sources in the **Extension** dev host, run `npm run build -w commentray-vscode` before reloading.

### The `.commentray/` folder did not appear

`commentray init` only creates `.commentray/storage` and
`.commentray/metadata/index.json` — it does _not_ preseed per-file
Markdown. Those are created on demand when you:

- Open a source file and run **Commentray: Open commentray beside
  source**, or
- Run `commentray render --source <file>` to render a file's track.

Also: `storage.dir` inside `.git/` is rejected by design (see
`SECURITY.md`). The CLI will refuse to initialize with a clear error.

### `commentray` not found on PATH after `npm run cli:install`

The global `npm` bin directory might not be on your PATH.
`scripts/install-cli.sh` prints the exact path to add after linking.

## Where changes tend to go

Rough mental map for new contributors:

- Config semantics → `packages/core/src/config.ts` +
  `packages/core/src/paths.ts` (both well-tested; add behavior tests,
  not snapshot tests).
- Git hook wording → `packages/cli/src/git-hooks.ts`.
- CLI command surface → `packages/cli/src/cli.ts`. Keep command
  handlers thin; push logic into the core or a sibling module and
  unit-test that module.
- Rendering pipeline → `packages/render/src`. The sanitize allow-list
  lives near the top of the pipeline — changes there affect security
  posture; read `SECURITY.md` first.
- Extension behavior → `packages/vscode/src/extension.ts`.

## Releasing

See `CONTRIBUTING.md → Publishing to npm (maintainers)` for the
`scripts/bump-version.sh` (version files only), `scripts/tag-version.sh`
(annotated tag after commit), and `scripts/publish.sh` workflow. Do not
hand-edit individual `package.json` versions; `scripts/sync-workspace-deps.mjs`
keeps intra-monorepo pins in lockstep.
