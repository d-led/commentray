/**
 * Maps a configured Highlight.js base name to the pair of CDN themes used for
 * `media="(prefers-color-scheme: light)"` vs `dark`.
 *
 * Dark themes (heuristic: name contains `"dark"`) must not be linked for the
 * light color-scheme slot — that forces dark code blocks while the rest of the
 * page still follows the light system palette (`Canvas` / `CanvasText`).
 */
export function hljsStylesheetThemes(configured?: string): { hljsLight: string; hljsDark: string } {
  const t = configured?.trim();
  if (!t) {
    return { hljsLight: "github", hljsDark: "github-dark" };
  }
  if (t.toLowerCase().includes("dark")) {
    return { hljsLight: "github", hljsDark: t };
  }
  return { hljsLight: t, hljsDark: "github-dark" };
}
