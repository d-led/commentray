# `extension.ts` — companion

VS Code / Cursor surface: **open beside**, **add block from selection**, **validate workspace** output channel, **Markdown preview** passthrough.

## Scroll sync (dogfood feature)

When a pair is active: visible-range listeners on **both** editors; block list rebuilt on document change (debounced) and when **`index.json`** is saved. Programmatic `revealRange` is wrapped so source ↔ commentray does not fight itself.

## Authoring affordance

**Add block** appends an HTML marker + heading + placeholder, then **`addBlockToIndex`** — after commit, **`tag-version.sh`** / publish flow stay separate from day-to-day commentary edits.

## Packaged extension

`esbuild` inlines `@commentray/core` before `vsce`; a stale `.vsix` without that step is the usual “command not found” failure — reinstall via root `npm run extension:install`.
