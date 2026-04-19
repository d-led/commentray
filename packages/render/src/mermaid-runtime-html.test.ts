import { describe, expect, it } from "vitest";

import { mermaidRuntimeScriptHtml } from "./mermaid-runtime-html.js";

describe("Optional Mermaid runtime script injection", () => {
  it("returns empty when Mermaid is disabled", () => {
    expect(mermaidRuntimeScriptHtml(false)).toBe("");
    expect(mermaidRuntimeScriptHtml(undefined)).toBe("");
  });

  it("emits a loader that skips file: and otherwise injects a module script", () => {
    const html = mermaidRuntimeScriptHtml(true);
    expect(html).toContain('location.protocol==="file:"');
    expect(html).toContain('s.type="module"');
    expect(html).toContain("cdn.jsdelivr.net/npm/mermaid@11");
    expect(html).toContain("mermaid.initialize");
    expect(html).toContain("globalThis.commentrayMermaid=mermaid");
    expect(html).not.toContain('<script type="module">');
  });
});
