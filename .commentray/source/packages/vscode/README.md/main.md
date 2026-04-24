# VS Code extension walk-through

These frames are captured from **desktop VS Code** (Extension Development Host + the repo’s dogfood fixture). In the command palette, type **`>`** first so the picker is in **Run Command** mode; then **`Commentray`** matches the extension’s commands (not random files).

## Find Commentray commands

![Command palette — Commentray](./assets/vscode-palette-commentray.png)

## Open paired markdown beside the editor

**Commentray: Open paired markdown beside editor** opens or creates `.commentray/source/<path-to-primary>.md` for the active file and lays it out beside the source (scroll sync is configurable in settings).

![Open paired markdown beside editor](./assets/vscode-open-paired-beside.png)

## Open paired markdown (choose angle)

When multiple [angles](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) apply, **Commentray: Open paired markdown (choose angle)** offers a quick pick so you pick which companion file to open.

![Open paired markdown (choose angle)](./assets/vscode-open-paired-choose-angle.png)

## Add commentary block from selection

**Commentray: Add commentary block from selection** appends a new `<!-- commentray:block … -->` region to the paired Markdown, updates `.commentray/metadata/index.json`, and focuses the placeholder.

![Add commentary block from selection](./assets/vscode-add-block-from-selection.png)

## Add angle to project

**Commentray: Add angle to project…** registers another companion Markdown angle for the workspace (same “active folder” rules as validate).

![Add angle to project](./assets/vscode-add-angle-to-project.png)

## Open Markdown preview for paired file

**Commentray: Open Markdown preview for paired file** uses VS Code’s built-in preview on the paired `.md`.

![Open Markdown preview for paired file](./assets/vscode-markdown-preview.png)

## Validate workspace

**Commentray: Validate workspace** runs the same checks as `commentray validate` and streams results to the **Commentray** output channel (focus output if you want the log in frame).

![Validate workspace + output](./assets/vscode-validate-workspace.png)

---

## Maintainer: refreshing these PNGs

### Commands (repository root)

| Goal                                                                                  | Bash (preferred)                                            | npm alias                                                   |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Regenerate **desktop** `vscode-*.png` here                                            | `bash scripts/refresh-vscode-readme-screenshots-desktop.sh` | `npm run extension:vscode-readme-screenshots:desktop`       |
| Same in a **clean git worktree** (or optional clone), then copy PNGs back             | `bash scripts/commentray-screenshots-in-fresh-worktree.sh`  | `npm run extension:vscode-readme-screenshots:desktop:fresh` |
| **Manual** EDH on monorepo root (you save PNGs)                                       | `bash scripts/refresh-vscode-readme-screenshots-manual.sh`  | `npm run extension:vscode-readme-screenshots`               |
| **Root README** companion (manual, save under `.commentray/source/README.md/assets/`) | `bash scripts/refresh-root-readme-screenshots.sh`           | `npm run extension:commentray-screenshots`                  |

One-time for desktop automation: `npx playwright install chromium`. Optional env: `VSCODE_TEST_VERSION`, `COMMENTRAY_VSCODE_VIEWPORT_WIDTH` / `HEIGHT` (defaults 1200×780), `COMMENTRAY_VSCODE_ZOOM_LEVEL` (default 2), `COMMENTRAY_DESKTOP_SCREENSHOT_SKIP_BUILD=1` if `packages/vscode/dist/extension.js` is already built.

Fresh worktree clone URL (optional): `COMMENTRAY_SCREENSHOT_CLONE_URL` — see header in `scripts/commentray-screenshots-in-fresh-worktree.sh`.

More on asset layout: [storage — images](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md).

### How desktop screenshot **scenarios** are defined

Automation is **not** Cypress: one Node driver script drives a disposable VS Code window.

1. **Workspace** — the Extension Development Host opens **`packages/vscode/fixtures/dogfood`** (see `README.md` there). Primary source for the scripted tour is **`src/sample.ts`**; paired Markdown appears under `.commentray/source/…` when commands run.
2. **Driver** — `scripts/capture-vscode-readme-screenshots-desktop.mjs` launches VS Code (via `@vscode/test-electron`), connects with Playwright CDP, then runs a **fixed sequence**: command palette in **`>`** (run-command) mode, `shot(page, "vscode-….png")` calls, editor focus groups, sleeps. Output files go to **this** directory’s `./assets/`.
3. **Changing or adding a frame** — edit that `.mjs`: extend `main()` after `ensureBuilt()`, reuse `runPaletteQuery` / `openSampleTs` / `dismissOverlays`, match command titles to **`packages/vscode/package.json`** → `contributes.commands` (**`Commentray: …`** strings). Tune `afterEnterMs` if UI lags. Keep filenames aligned with the `![…](./assets/…)` references in this file and in `packages/vscode/README.md`.
4. **Manual scenarios** — use dogfood or your own folder; follow `scripts/refresh-vscode-readme-screenshots-manual.sh` (opens EDH + prints where to save files).
