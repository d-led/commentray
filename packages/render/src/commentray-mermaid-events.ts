/**
 * Fired from the inline Mermaid module in {@link ./mermaid-runtime-html.ts} immediately after
 * `globalThis.commentrayMermaid` is assigned — before optional `mermaid.run`. The browser client may
 * enqueue {@link ./code-browser-client.ts} work earlier (e.g. Cypress flips panes right after
 * `load`); this event lets that work run once the module has finished its `import()`.
 */
export const COMMENTRAY_MERMAID_MODULE_READY_EVENT = "commentray-mermaid-module-ready";
