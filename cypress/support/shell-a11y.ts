/**
 * Selectors and copy hooks for the static code-browser shell used by accessibility E2E.
 *
 * **When the shell markup or static site config changes**, update this module (and the
 * custom commands under `cypress/support/custom-commands/`) rather than hunting through individual specs.
 *
 * Prefer roles and accessible names over class names; a few IDs stay because they are
 * stable in `packages/render/src/code-browser.ts` and easier to scope than long chains.
 */

/** Substring or pattern for `document.title` — keep aligned with `.commentray.toml` `[static_site].title`. */
export const STATIC_SITE_TITLE_PATTERN = /Commentray/i;

/** Expected primary language of the generated HTML shell. */
export const DOCUMENT_LANG = "en";

export const shellA11y = {
  main: "main#main-content",
  skipToMainLink: 'a[href="#main-content"]',
  /** Banner landmark wrapping toolbar chrome (not the search row below it). */
  banner: "header[role=banner]",
  /** One document title for assistive tech; lives in the banner in the current shell. */
  documentTitleHeading: "header[role=banner] h1",
  contentinfo: "[role=contentinfo]",
  search: {
    region: '[role="region"][aria-label="Search"]',
    /** Prefer scoping by region over bare `#search-q` so IDs can move inside the region. */
    input: '[role="region"][aria-label="Search"] input[type="search"]',
    /** Matches `for` on the search `<input>` id in `code-browser.ts`. */
    label: 'label[for="search-q"]',
    clearButton: "#search-clear",
    results: "#search-results",
  },
  panes: {
    source: '[aria-label="Source code"]',
    commentray: '[aria-label="Commentray"]',
  },
  resizeSplitter: '[role="separator"][aria-label="Resize panes"]',
  wrapLinesCheckbox: "#wrap-lines",
  /** Label wraps the checkbox in the toolbar. */
  wrapLinesLabel: "label:has(#wrap-lines)",
  /** System / light / dark: compact trigger + popover (static code browser client bundle). */
  colorThemeTrigger: "#commentray-theme-trigger",
  colorThemeMenu: "#commentray-theme-menu",
  angleSelect: '[aria-label="Commentray angle"]',
  /** Plain-text Src/Doc path strip above the dual panes (inside `#shell`). */
  documentationPairLandmark: '[aria-label="Current documentation pair"]',
} as const;
