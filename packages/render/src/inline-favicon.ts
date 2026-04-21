/**
 * Tab icon as a single `<link rel="icon" …>` using an inline SVG data URL.
 * Avoids relying on `/favicon.ico` (often missing under `_site/`) and works when the site is
 * served from a subpath on GitHub Pages.
 *
 * Geometry matches `docs/logos/1.svg` (film strip + speech bubble); keep in sync if the logo changes.
 */
const COMMENTRAY_LOGO_SVG_FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">' +
  '<rect x="7" y="13" width="31" height="41" rx="4" fill="#1e2937" stroke="#334155" stroke-width="3.5"/>' +
  '<rect x="12.5" y="18" width="10" height="7.5" fill="#475569"/>' +
  '<rect x="12.5" y="28.5" width="10" height="7.5" fill="#475569"/>' +
  '<rect x="12.5" y="39" width="10" height="7.5" fill="#475569"/>' +
  '<rect x="8.5" y="16.5" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="8.5" y="26" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="8.5" y="35.5" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="8.5" y="45" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="31" y="16.5" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="31" y="26" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="31" y="35.5" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<rect x="31" y="45" width="2.5" height="2.5" fill="#fbbf24"/>' +
  '<path d="M36 20 Q36 14.5 43 14.5 H57.5 Q63 14.5 63 20 V34 Q63 39 57.5 39 H48.5 L44 46 L43 39 Q36 39 36 34 Z" fill="#fcd34d" stroke="#1e2937" stroke-width="3.5"/>' +
  '<path d="M44 39 L46.5 44.5 L48.5 39 Z" fill="#fcd34d" stroke="#1e2937" stroke-width="3" stroke-linejoin="round"/>' +
  "</svg>";

export const COMMENTRAY_FAVICON_LINK_HTML = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  COMMENTRAY_LOGO_SVG_FAVICON,
)}" />`;
