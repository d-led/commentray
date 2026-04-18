# `scroll-sync.ts` — commentray

Pure functions only—no VS Code imports—so the extension stays a thin orchestrator.

**`buildBlockScrollLinks`** joins `index.json` to `<!-- commentray:block id=… -->` in the Markdown file. Without that join, scroll sync is only **proportional** mirroring between panes.

When you scroll the source, the target commentray position prefers the **block whose anchor owns** the top visible line; if markers and index disagree with the buffer, behavior falls back to the nearest earlier block, then to ratio. **0-based** editor lines versus **1-based** anchor lines in metadata match how `Range` and the anchor spec are already defined.

**Spec:** [`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md) · [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
