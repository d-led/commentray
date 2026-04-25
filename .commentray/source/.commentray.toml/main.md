# `.commentray.toml` — commentray

<!-- commentray:block id=toml-lede -->

This commentray does not duplicate the keys already documented in [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) or spelled out in comments in the real [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml) on the left—only orientation. The TOML on disk uses **`# commentray:start id=…` / `# commentray:end id=…`** around each logical section (same pairing contract as the root **README**’s `<!-- #region commentray:… -->` / `<!-- #endregion … -->`, but in TOML line comments so parsers stay happy).

This file on disk is the **contract** the tools read first: storage root, SCM backend, how Markdown is rendered, anchor defaults, optional Angles, and optional GitHub Pages input. Everything else in `.commentray/` follows paths implied here.

`[storage]` — `dir` is repo-relative; must not sit under `.git/` (enforced so Git and tooling do not fight over the tree).

<!-- commentray:page-break -->

<!-- commentray:block id=toml-scm -->

`[scm]` — Only **`git`** is supported for **`provider`** today (see [Configuration → `[scm]`](https://github.com/d-led/commentray/blob/main/docs/user/config.md#scm)); core exposes a small **`ScmProvider`** abstraction, and the Git adapter supplies blob SHA and commit metadata used in staleness checks.

<!-- commentray:page-break -->

<!-- commentray:block id=toml-render -->

`[render]` — Mermaid on/off, Highlight.js theme, and optional rewriting of `https://github.com/…/blob/…` links to repo-relative URLs in static HTML when `[static_site].github_url` parses.

<!-- commentray:page-break -->

<!-- commentray:block id=toml-anchors -->

`[anchors]` — Default resolution order (`symbol`, `lines`, …) for tooling that resolves spans.

<!-- commentray:page-break -->

<!-- commentray:block id=toml-angles -->

`[angles]` (commented in this repo) — After you add `{storage}/source/.default`, each primary file can own a folder of `angleId.md` files; TOML lists ids and titles and picks `default_angle`. VS Code can enable this layout and open a chosen angle; Pages still use a single `commentray_markdown` path until the static viewer grows a switcher.

<!-- commentray:page-break -->

<!-- commentray:block id=toml-static-site -->

`[static_site]` — Feeds `npm run pages:build`: which source fills the code pane, which Markdown file (and optional intro) fills the commentray pane, toolbar GitHub links, and related file shortcuts. Normative detail: [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) and the plan’s Static code browser section.

**Custom publish URL / context path (important):**

- Keep `[static_site].github_url` as the **repository home** URL (for example, `https://github.com/acme/project`) so toolbar and blob-link derivation stay correct.
- Do **not** put your deployed docs URL into `[static_site].github_url`. A publish URL like `https://example.com/some_context_path/<commentray-root>/` is an app hosting concern, not a repo identity.
- The generated site uses relative links and computes site-root navigation from the current page path (`/browse/...` aware), so it works under a context path without extra TOML keys.
- For rendered **source-markdown** links that point to files outside `_site/`, use `[static_site].source_link_prefix` (for example `https://github.com/acme/project/blob/main` or `/src`) so links resolve instead of 404ing.
- If `[render].relative_github_blob_links = true` and `[static_site].github_url` is parseable, Pages builds also derive a safe default source-link prefix to GitHub blob URLs.
- If you host under a custom prefix, validate by opening both:
  - `https://example.com/some_context_path/<commentray-root>/`
  - `https://example.com/some_context_path/<commentray-root>/browse/<pair>.html`
    and ensure home/pair links do not stack `browse/browse`.

**Rule of thumb:** repo identity in TOML (`[static_site].github_url`), deploy base in hosting config (Pages/reverse proxy/CDN).

<!-- commentray:page-break -->

<!-- commentray:block id=toml-pointers -->

**Pointers:** [`docs/user/source-region-delimiters.md`](https://github.com/d-led/commentray/blob/main/docs/user/source-region-delimiters.md) (delimiter table by VS Code `languageId`) · [`packages/core/src/config.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.ts) · [`packages/core/src/config.test.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.test.ts)
