# `code-browser.ts` — companion

Emits the **static code browser** shell: code pane + Markdown pane, **draggable splitter**, optional **Mermaid** runtime injection, **Highlight.js** theme class, **line-number gutter** for the code column, and a clear **repo-relative path** label in the toolbar.

## Security posture

Markdown runs through **rehype-sanitize** with an explicit allow-list — treat any change to fenced code or class lists as a security review, not a style tweak.

## Consumer

[`code-commentray-static`](https://github.com/d-led/commentray/tree/main/packages/code-commentray-static) and root **`npm run pages:build`** both call into here; keep the HTML contract stable or bump the static generator in lockstep.
