# `.commentray.toml` — commentray

This commentray does not duplicate the keys already documented in [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) or spelled out in comments in the real [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml) on the left—only orientation.

This file on disk is the **contract** the tools read first: storage root, SCM backend, how Markdown is rendered, anchor defaults, optional Angles, and optional GitHub Pages input. Everything else in `.commentray/` follows paths implied here.

**`[storage]`** — `dir` is repo-relative; must not sit under `.git/` (enforced so Git and tooling do not fight over the tree).

**`[scm]`** — v0 is `git` behind `ScmProvider`; blob SHA and commit evidence for staleness come from here.

**`[render]`** — Mermaid on/off, Highlight.js theme, and optional rewriting of `https://github.com/…/blob/…` links to repo-relative URLs in static HTML when `[static_site].github_url` parses.

**`[anchors]`** — Default resolution order (`symbol`, `lines`, …) for tooling that resolves spans.

**`[angles]`** (commented in this repo) — After you add `{storage}/source/.default`, each primary file can own a folder of `angleId.md` files; TOML lists ids and titles and picks `default_angle`. VS Code can enable this layout and open a chosen angle; Pages still use a single `commentray_markdown` path until the static viewer grows a switcher.

**`[static_site]`** — Feeds `npm run pages:build`: which source fills the code pane, which Markdown file (and optional intro) fills the commentray pane, toolbar GitHub links, and related file shortcuts. Normative detail: [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) and the plan’s Static code browser section.

**Custom publish URL / context path (important):**

- Keep **`[static_site].github_url`** as the **repository home** URL (for example, `https://github.com/acme/project`) so toolbar and blob-link derivation stay correct.
- Do **not** put your deployed docs URL into `github_url`. A publish URL like `https://example.com/some_context_path/<commentray-root>/` is an app hosting concern, not a repo identity.
- The generated site uses relative links and computes site-root navigation from the current page path (`/browse/...` aware), so it works under a context path without extra TOML keys.
- For rendered **source-markdown** links that point to files outside `_site/`, use **`[static_site].source_link_prefix`** (for example `https://github.com/acme/project/blob/main` or `/src`) so links resolve instead of 404ing.
- If `render.relative_github_blob_links = true` and `github_url` is parseable, Pages builds also derive a safe default source-link prefix to GitHub blob URLs.
- If you host under a custom prefix, validate by opening both:
  - `https://example.com/some_context_path/<commentray-root>/`
  - `https://example.com/some_context_path/<commentray-root>/browse/<pair>.html`
    and ensure home/pair links do not stack `browse/browse`.

**Rule of thumb:** repo identity in TOML (`github_url`), deploy base in hosting config (Pages/reverse proxy/CDN).

**Pointers:** [`packages/core/src/config.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.ts) · [`packages/core/src/config.test.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.test.ts)
