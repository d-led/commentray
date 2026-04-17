# `scroll-sync.ts` — companion

Pure helpers: **`buildBlockScrollLinks`** joins `index.json` block ids with `<!-- commentray:block id=… -->` lines in the companion Markdown, then **`pickCommentrayLineForSourceScroll`** / **`pickSourceLine0ForCommentrayScroll`** drive editor scroll sync without VS Code imports.

## Behaviour worth remembering

- Prefer the block whose **`lines:`** range **contains** the top visible source line; fall back to nearest earlier block, then ratio scroll if there are no links.
- **0-based** commentray line numbers in the link model; **1-based** line anchors in metadata — the mismatch is intentional (matches VS Code `Range` vs anchor spec).

## Spec

[`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md) · [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
