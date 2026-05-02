import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs";

mermaid.initialize({ startOnLoad: false, securityLevel: "antiscript" });
globalThis.commentrayMermaid = mermaid;
try {
  globalThis.dispatchEvent(new CustomEvent("commentray-mermaid-module-ready"));
} catch (_) {}
const shell = document.getElementById("shell");
const layout = shell && shell.getAttribute("data-layout");
const skipInitial =
  globalThis.matchMedia("(max-width:767px)").matches &&
  shell &&
  shell.getAttribute("data-dual-mobile-pane") === "code" &&
  (layout === "dual" || layout === "stretch");
if (!skipInitial) {
  void mermaid
    .run({ querySelector: "#doc-pane-body pre.mermaid, .stretch-doc-inner pre.mermaid" })
    .then(() => {
      try {
        globalThis.dispatchEvent(new CustomEvent("commentray-mermaid-done"));
      } catch (_) {}
    })
    .catch((err) => {
      console.error("Commentray: mermaid.run failed", err);
    });
}
