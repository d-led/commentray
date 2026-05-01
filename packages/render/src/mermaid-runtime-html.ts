/**
 * Injects Mermaid only when the page is not served from `file:`.
 * Cross-origin `import()` from an opaque `file://` origin is browser-dependent and often
 * breaks or spams the console; the code browser should stay usable when opened locally.
 */
export function mermaidRuntimeScriptHtml(include: boolean | undefined): string {
  if (!include) return "";
  const cdn = "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs";
  const moduleSource = [
    `import mermaid from "${cdn}";`,
    `mermaid.initialize({ startOnLoad: false, securityLevel: "antiscript" });`,
    // Multi-angle swaps replace #doc-pane-body HTML after load; the client calls this to render new .mermaid nodes.
    `globalThis.commentrayMermaid=mermaid;`,
    // Narrow dual-pane + source-only: doc is display:none — skip initial layout; client runs when commentary is shown.
    `const shell=document.getElementById("shell");`,
    `const skipInitial=globalThis.matchMedia("(max-width:767px)").matches&&shell&&shell.getAttribute("data-layout")==="dual"&&shell.getAttribute("data-dual-mobile-pane")==="code";`,
    `if(!skipInitial){`,
    // Only `pre.mermaid` diagram sources; rendered SVG output can still match a broad `.mermaid` selector.
    // Event name must match `MERMAID_DONE_EVENT` in `block-stretch-buffer-sync.ts` (stretch row buffer pass).
    `void mermaid.run({ querySelector: "#doc-pane-body pre.mermaid, .stretch-doc-inner pre.mermaid" }).then(()=>{`,
    `try{globalThis.dispatchEvent(new CustomEvent("commentray-mermaid-done"));}catch(_){}`,
    `}).catch((err)=>{`,
    `console.error("Commentray: mermaid.run failed", err);`,
    `});`,
    `}`,
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
