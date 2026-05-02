import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findMonorepoPackagesDir, monorepoLayoutStartDir } from "@commentray/core";

/**
 * Injects Mermaid only when the page is not served from `file:`.
 * Cross-origin `import()` from an opaque `file://` origin is browser-dependent and often
 * breaks or spams the console; the code browser should stay usable when opened locally.
 */
export function mermaidRuntimeScriptHtml(include: boolean | undefined): string {
  if (!include) return "";
  const moduleSource = loadMermaidBootstrapModuleSource();
  const asTextContent = JSON.stringify(moduleSource);
  return (
    `<script>` +
    `(function(){` +
    `if(typeof location!=="undefined"&&location.protocol==="file:")return;` +
    `var s=document.createElement("script");` +
    `s.type="module";` +
    `s.textContent=${asTextContent};` +
    `document.body.appendChild(s);` +
    `})();` +
    `</script>`
  );
}

let cachedMermaidBootstrapSource: string | undefined;

function loadMermaidBootstrapModuleSource(): string {
  if (cachedMermaidBootstrapSource === undefined) {
    const packagesDir = findMonorepoPackagesDir(monorepoLayoutStartDir(import.meta.url));
    const renderDistDir = join(packagesDir, "render", "dist");
    const inDist = join(renderDistDir, "mermaid-runtime-bootstrap.mjs");
    const fromSrc = join(packagesDir, "render", "src", "mermaid-runtime-bootstrap.mjs");
    for (const tryPath of [inDist, fromSrc]) {
      if (existsSync(tryPath)) {
        cachedMermaidBootstrapSource = readFileSync(tryPath, "utf8");
        break;
      }
    }
    if (cachedMermaidBootstrapSource === undefined) {
      throw new Error("Missing mermaid-runtime-bootstrap.mjs under render/src or render/dist.");
    }
  }
  return cachedMermaidBootstrapSource;
}
