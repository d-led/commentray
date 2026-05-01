<!-- commentray:block id=readme-lede -->

# Commentray — architecture angle

This **angle** is a second voice on the same `README.md` source: high-level map of the monorepo, not a second README. For **roles** (libraries vs tooling vs static generator), see the **[Main](https://github.com/d-led/commentray/blob/main/.commentray/source/README.md/main.md)** angle.

**Package dependencies** (edges follow `package.json` `dependencies`; [`@commentray/core`](https://www.npmjs.com/package/@commentray/core) has no in-repo package deps):

<!-- commentray:page-break -->

<!-- commentray:block id=readme-why -->

```mermaid
flowchart TB
  core["commentray/core"]
  pkgRender["commentray/render"]
  ccStatic["commentray/code-commentray-static"]
  cli["commentray"]
  vscode["commentray-vscode"]

  core -->|npm dep| pkgRender
  core -->|npm dep| ccStatic
  pkgRender -->|npm dep| ccStatic
  core -->|npm dep| cli
  pkgRender -->|npm dep| cli
  ccStatic -->|npm dep| cli
  core -->|npm dep| vscode
```

<!-- commentray:page-break -->

<!-- commentray:block id=readme-user-guides -->

- **[@commentray/core](https://www.npmjs.com/package/@commentray/core)** — paths, index, config merge, Angles resolution, Git-backed evidence.
- **[@commentray/render](https://www.npmjs.com/package/@commentray/render)** — Markdown → safe HTML, static code browser shell (dual panes, optional multi-angle selector, block-aware scroll when the index agrees).
- **[commentray](https://www.npmjs.com/package/commentray)** — `init`, `validate`, **`migrate-angles`** (flat → per-source folders), `render`, `pages` inputs.
- **[@commentray/code-commentray-static](https://www.npmjs.com/package/@commentray/code-commentray-static)** — thin consumer that feeds `renderCodeBrowserHtml` for GitHub Pages.

Use **Angle** on the static site when this file exists alongside `main.md` and both are listed under `[angles].definitions` in `.commentray.toml`.

<!-- commentray:page-break -->

<!-- commentray:block id=readme-mobile-flip-check -->

## Narrow viewport check

On a narrow viewport, the shell flips between **Source** and **Commentray** instead of showing both columns at once. That mobile flip still needs to keep the currently active README block aligned when you switch panes.

Use this architecture angle to verify the same behavior as the main angle: scroll near the bottom, flip from source to commentary and back, and confirm the visible block stays paired after each flip.
