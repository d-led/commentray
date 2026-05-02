import { COMMENTRAY_MERMAID_MODULE_READY_EVENT } from "./commentray-mermaid-events.js";

/**
 * Injects Mermaid only when the page is not served from `file:`.
 * Cross-origin `import()` from an opaque `file://` origin is browser-dependent and often
 * breaks or spams the console; the code browser should stay usable when opened locally.
 */
export function mermaidRuntimeScriptHtml(include: boolean | undefined): string {
  if (!include) return "";
  const cdn = "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs";
  const moduleReadyEvent = JSON.stringify(COMMENTRAY_MERMAID_MODULE_READY_EVENT);
  const moduleSource = [
    `import mermaid from "${cdn}";`,
    `mermaid.initialize({ startOnLoad: false, securityLevel: "antiscript" });`,
    // Multi-angle swaps replace #doc-pane-body HTML after load; the client calls this to render new .mermaid nodes.
    `globalThis.commentrayMermaid=mermaid;`,
    `try{globalThis.dispatchEvent(new CustomEvent(${moduleReadyEvent}));}catch(_){}`,
    // Narrow + source-only (dual or stretch): commentary/doc column is display:none — skip initial
    // `mermaid.run` (hidden layout yields parse/error DOM that still contains `<svg>`, so a later
    // flip would not re-run and Cypress would see "Syntax error in text"). Client runs when doc is shown.
    `const shell=document.getElementById("shell");`,
    `const layout=shell&&shell.getAttribute("data-layout");`,
    `const skipInitial=globalThis.matchMedia("(max-width:767px)").matches&&shell&&shell.getAttribute("data-dual-mobile-pane")==="code"&&(layout==="dual"||layout==="stretch");`,
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
