/**
 * Extension point for richer anchor resolution (tree-sitter, LSP, …).
 *
 * v0 ships line- and region-based anchors only; `symbol:` anchors stay diagnostic-only until a
 * resolver is wired here.
 */
export type SymbolResolutionStrategy = "none" | "tree-sitter" | "lsp";

/** Current product choice: no automatic symbol resolution yet. */
export function plannedSymbolResolutionStrategy(): SymbolResolutionStrategy {
  return "none";
}
