# `extension.ts` — companion

This is the **handheld camera** version of Commentray: open beside, start a block from selection, validate into an output channel, and lean on the built-in Markdown preview when you want stock rendering.

**Scroll sync** — When a pair is active, visible-range listeners on both editors drive the dance. The block list is rebuilt on document change (debounced) and when **`index.json`** saves—so metadata edits feel live without polling the world. Programmatic `revealRange` is wrapped so the two panes don’t argue in a feedback loop.

**Add block** — Appends marker + heading + placeholder, then **`addBlockToIndex`**. Release tooling (`tag-version.sh`, publish) stays deliberately separate from day-to-day commentary edits.

**Packaging** — `esbuild` inlines `@commentray/core` before `vsce`. A `.vsix` built without that step is the usual “command not found” ghost; root **`npm run extension:install`** is the fix we tell people first.
