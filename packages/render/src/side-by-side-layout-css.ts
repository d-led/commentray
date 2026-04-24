/**
 * Inline layout stylesheet for {@link renderSideBySideHtml}.
 * Kept in TypeScript (not a separate `.css` + emit step) so `tsc` and the CLI’s
 * bundled CJS build never depend on `import.meta.url` or filesystem layout.
 */
export const SIDE_BY_SIDE_LAYOUT_CSS = `:root {
  color-scheme: light dark;
}

html {
  background: Canvas;
  color: CanvasText;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  background: Canvas;
  color: CanvasText;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100vh;
}

.pane {
  overflow: auto;
  padding: 16px;
  border-right: 1px solid color-mix(in oklab, CanvasText 20%, Canvas);
}

.pane:last-child {
  border-right: none;
}

.pane h2 {
  margin-top: 0;
  font-size: 14px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 0.8;
}

pre {
  margin: 0;
}

.commentray {
  font-size: 15px;
  line-height: 1.45;
}

.commentray img {
  max-width: 100%;
  height: auto;
}

.commentray :where(table) {
  width: max-content;
  max-width: none;
  border-collapse: collapse;
  margin: 0.85em 0;
}

.commentray :where(th, td) {
  border: 1px solid color-mix(in oklab, CanvasText 22%, Canvas);
  padding: 8px 12px;
  vertical-align: top;
}

.commentray :where(thead th) {
  font-weight: 600;
  background: color-mix(in oklab, CanvasText 7%, Canvas);
}

.commentray tbody tr:nth-child(even) :where(td) {
  background: color-mix(in oklab, CanvasText 3.5%, Canvas);
}
`;
