# Plan — commentray

The plan on the left is the engineering checklist; this file is the short voice-over: intent, boundaries, and what v0 deliberately does not claim.

```mermaid
flowchart LR
  A[edit source] --> B["Extension paired panes + scroll"]
  C[git commit] --> D["hook or CI validate"]
  B -.->|writes| E[".commentray/source"]
  D --> F["schema + anchors"]
```

**Metaphor** — Commentary on a film: extra audio without splicing new frames into the picture.

**Goals / non-goals** — v0 stays small; deferred work (LSP, every SCM, …) is named so absence reads as policy, not neglect.

**Angles** — Core + VS Code handle multi-file Angles when `source/.default` exists. The static Pages build still uses one `commentray_markdown` path until a switcher ships.

**Block stretch** — Renderer uses **row-per-block** paired rows, not `rowspan`, when index and markers line up.

**Packages** — Read the table as a stack: core at the bottom, render above, CLI / VS Code / static sample on top.

**Anchors (v0)** — `lines:…` and `symbol:…` are the committed dialects; blocks hang prose off those hooks (plus `marker:` where regions exist).

**Automation** — Hooks: `commentray init scm`. Local/CI gate: **`npm run quality:gate`** → `scripts/quality-gate.sh`.
