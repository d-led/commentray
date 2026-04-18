# `code-browser.ts` — commentray

Emits the static **code browser** shell: code pane, Markdown pane, draggable splitter, optional Mermaid injection, Highlight.js theme wiring, line-number gutter for search hits, optional **block stretch** table when index + markers align, and optional dual-pane mode with block anchors for scroll sync without stretch.

**Security** — Markdown runs through **rehype-sanitize** with an explicit allow-list. Any change to fenced-code handling or class allow-lists is a security review, not a style tweak.

**Callers** — [`@commentray/code-commentray-static`](https://github.com/d-led/commentray/tree/main/packages/code-commentray-static) and root **`npm run pages:build`** share the HTML contract; change the DOM shape in one change-set across both.
