# `blocks.md` — companion

The spec on the left is normative; here we only add **why the split exists**.

Humans own the companion Markdown—headings, tone, diagrams. The machine owns **`index.json`**: ids, **`lines:`** / **`symbol:`** anchors, optional **fingerprints** when we want drift to be diagnosable instead of silent. Keeping those walls up is what lets “validate in CI” mean something without a parser rewriting your prose.

**Staleness (v0)** — Diagnostics only; the same file’s staleness section is the contract. We’re not auto-healing commentary on branch mismatch—that’s a product decision, not an oversight.

**Editor tie-in** — Markers exist so the extension has something grep-stable for **block-aware scroll**. Strip the markers or the index rows and you’re back to **proportional** sync: still usable, just less smug about it.
