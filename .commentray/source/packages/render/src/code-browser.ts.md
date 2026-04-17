# `code-browser.ts` — companion

This is the **wide shot**: code pane, Markdown pane, draggable splitter, optional Mermaid injection, Highlight.js theme wiring, and the line-number gutter so in-page search can land on a real row. The toolbar’s repo-relative label is the subtitle card—viewers should always know which reel they’re on.

**Security** — Markdown goes through **rehype-sanitize** with an explicit allow-list. Treat any change to fenced-code handling or class allow-lists as a security review, not a style pass.

**Callers** — [`code-commentray-static`](https://github.com/d-led/commentray/tree/main/packages/code-commentray-static) and root **`npm run pages:build`** share the HTML contract; if you change the DOM shape, bump both consumers in the same breath.
