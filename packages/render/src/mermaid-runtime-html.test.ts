import { describe, expect, it } from "vitest";

import { COMMENTRAY_MERMAID_MODULE_READY_EVENT } from "./commentray-mermaid-events.js";
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
    expect(html).toContain("cdn.jsdelivr.net/npm/mermaid@11.14.0");
    expect(html).toContain("mermaid.initialize");
    expect(html).toMatch(/globalThis\.commentrayMermaid\s*=\s*mermaid/);
    expect(html).toContain(COMMENTRAY_MERMAID_MODULE_READY_EVENT);
    expect(html).toContain("skipInitial");
    expect(html).toMatch(/skipInitial[\s\S]*\\"dual\\"[\s\S]*\\"stretch\\"/);
    expect(html).toContain("commentray-mermaid-done");
    expect(html).not.toContain('<script type="module">');
  });
});
