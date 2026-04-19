/**
 * Injects Mermaid only when the page is not served from `file:`.
 * Cross-origin `import()` from an opaque `file://` origin is browser-dependent and often
 * breaks or spams the console; the code browser should stay usable when opened locally.
 */
export function mermaidRuntimeScriptHtml(include: boolean | undefined): string {
  if (!include) return "";
  const cdn = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  const moduleSource = [
    `import mermaid from "${cdn}";`,
    `mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });`,
    // Multi-angle swaps replace #doc-pane-body HTML after load; the client calls this to render new .mermaid nodes.
    `globalThis.commentrayMermaid=mermaid;`,
    `mermaid.run({ querySelector: ".mermaid" });`,
  ].join("");
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
