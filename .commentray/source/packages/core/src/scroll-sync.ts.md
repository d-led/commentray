# `scroll-sync.ts` — companion

This file is the **math behind the sway**: no VS Code imports, just pure functions so the extension can stay thin.

**`buildBlockScrollLinks`** stitches `index.json` to the `<!-- commentray:block id=… -->` markers in the companion—without that join, scroll sync is only proportional scrolling and nobody feels clever.

When you scroll the source, we try to land the commentary on the **block that actually owns** the top visible line; if the index and markers disagree with reality, we degrade gracefully (nearest earlier block, then ratio). The **0-based** commentray lines versus **1-based** anchor lines in metadata look like a footgun on paper; in the editor it lines up with how `Range` and the anchor spec already think.

**Spec:** [`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md) · [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
