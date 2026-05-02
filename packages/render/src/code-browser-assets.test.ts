import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMMENTRAY_MERMAID_MODULE_READY_EVENT } from "./commentray-mermaid-events.js";

const renderSrcDir = dirname(fileURLToPath(import.meta.url));

describe("Code browser static assets", () => {
  it("keeps a single intro splice marker in shell CSS", () => {
    const css = readFileSync(join(renderSrcDir, "code-browser-shell.css"), "utf8");
    const marker = "/* __COMMENTRAY_INTRO_CSS__ */";
    expect(css.split(marker).length - 1).toBe(1);
  });

  it("documents the nav rail hub fragment placeholders", () => {
    const html = readFileSync(join(renderSrcDir, "code-browser-nav-rail-doc-hub.html"), "utf8");
    expect(html).toContain('data-nav-json-url="__NAV_JSON_URL__"');
    expect(html).toContain("__TREE_ICON_SVG__");
    expect(html).toContain('id="documented-files-hub"');
  });

  it("keeps Mermaid bootstrap in sync with the module-ready event constant", () => {
    const bootstrap = readFileSync(join(renderSrcDir, "mermaid-runtime-bootstrap.mjs"), "utf8");
    expect(bootstrap).toContain(`new CustomEvent("${COMMENTRAY_MERMAID_MODULE_READY_EVENT}")`);
    expect(bootstrap).toContain("commentray-mermaid-done");
    expect(bootstrap).toContain("cdn.jsdelivr.net/npm/mermaid@11.14.0");
  });
});
