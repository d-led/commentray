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
- `packages/code-commentray-static` — static-site generator for the
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

## Two ways to run the editor extension

Pick the one that matches your task.

### 1. Extension Development Host (fast feedback loop)

For iterating on extension code. Starts your editor (Cursor preferred,
else VS Code) pointed at a dedicated fixture workspace
(`packages/vscode/fixtures/dogfood/`) with the extension loaded from
source.

```bash
npm run extension:dogfood
```

Why a fixture folder and not the monorepo root? Cursor / VS Code refuse
to open a second window onto a folder that is already open, which means
you cannot both edit Commentray and dogfood it in the same folder. The
fixture sidesteps that and keeps the dev host away from your real login
/ settings.

Reload after rebuilding: **Cmd/Ctrl+R** in the dev host window, or
**Developer: Reload Window** from the Command Palette. Source changes
under `packages/vscode/src/**` need a fresh compile first — run
`npm run build -w commentray-vscode` (or just `npm run build`).

### 2. Packaged `.vsix` installed into your regular editor

For using Commentray against your real projects, or for reproducing bugs
that only show up in a fully installed extension.

```bash
npm run extension:install      # build + bundle + package + install
npm run extension:package      # build + bundle + package only (no install)
npm run extension:uninstall    # remove it
```

The installer script bundles the extension with esbuild (inlining
`@commentray/core`) before `vsce` packages the `.vsix`. This bundling
step matters — see "Common failure modes" below.

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

### The extension host log (for activation failures)

Activation errors (including `Cannot find module '@commentray/core'` in
a broken `.vsix`) surface in the **Extension Host** log rather than in
any user-facing channel. To open it:

- Command Palette → **Developer: Show Logs…** → **Extension Host**.

A failed activation is also why you see the error in the screenshot
below. The command is _declared_ in `package.json` but `activate()`
never finished, so nothing registered it.

> _command 'commentray.openSideBySide' not found_

### The Developer Tools console

For extension code paths that touch the webview preview or for any
`console.log` calls in the extension itself:

- Command Palette → **Developer: Toggle Developer Tools**.
- Console tab shows `console.log` output from both the extension host
  and any webviews.

### Breakpoints

Launching via `npm run extension:dogfood` runs the extension in the
regular extension host, not under a debugger. To step through
extension code:

1. Open `packages/vscode` as a folder in VS Code / Cursor.
2. Run the built-in **Extension** launch configuration (VS Code's
   default for extension projects will be picked up if `launch.json`
   exists, or you can create one).
3. Set breakpoints in `packages/vscode/src/**`.

The standalone `npm run extension:dogfood` script is optimized for fast
reload cycles, not for attaching a debugger.

## Common failure modes

### "command 'commentray.X' not found"

`activate()` threw before it could register the command. Almost always
one of:

- **Stale `.vsix` installed.** The installed extension predates the
  esbuild bundling step, so at runtime Node cannot resolve
  `@commentray/core`. Fix:
  ```bash
  npm run extension:uninstall
  npm run extension:install
  # Command Palette → Developer: Reload Window
  ```
- **Rebuild skipped.** In the dev host, code changes under
  `packages/vscode/src/**` need `npm run build -w commentray-vscode`
  before reloading the window.
- **Real exception in `activate()`.** Check **Developer: Show Logs… →
  Extension Host** for the stack trace.

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
