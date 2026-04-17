# Commentray — quick-start

_You have the main [`README.md`](https://github.com/d-led/commentray/blob/main/README.md) in the left column: packages, scripts, release flow. This file **is** commentray for that README—the running voice-over, not a second brochure._

> **Director beat:** two panes, one checkout. The left column states facts; this **commentray** adds motive, trade-offs, and “we tried that already.” Same word names the tool (**Commentray**) and what you write beside the code (**commentray**); the README’s _Why_ section spells that out for newcomers.

## Try scroll sync (why the editor extension exists)

On **[GitHub Pages](https://d-led.github.io/commentray/)** you already get the split layout: **Code** is this repo’s `README.md`; **Commentray** is _this_ file, rendered as HTML. **Scroll either pane**—the other follows in **lockstep** (proportional sync: long README, shorter commentary, same “where am I in the story?” gesture). That is the “commentary track” metaphor made tangible without installing anything.

**Other files:** the toolbar row includes **Also on GitHub** (from `[static_site.related_github_files]` in [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml))—each link opens that path on GitHub so you can read `CONTRIBUTING.md`, specs, or the plan beside the same mental model. Only one HTML file ships to Pages, so in-commentray Markdown links that get rewritten to repo-relative paths may **404** here; use full `https://github.com/…/blob/…` URLs for prose links when you need a guarantee, or list the file under `related_github_files` for a first-class shortcut.

**Search:** **Escape** clears the query and hides hit results (same as **Clear**).

The **VS Code / Cursor** extension goes further while you **author**: open **Commentray: Open commentray beside source**, keep both editors visible, and scroll the source—the commentray view tracks, and once you add **blocks** (**Commentray: Add block from selection**), scroll sync **snaps to the block heading** that matches the code you are looking at instead of only stretching by line ratio. Same storage and `index.json` model as the site; the plugin is where editing stays pleasant.

## Why this file exists

The README has to stay scannable. Here we can linger: why `.commentray/` lives beside the code, when to reach for the extension versus the CLI, and where the sharp edges are—without pasting another full quickstart.

## If you only do one thing

Clone and `npm run setup` (left pane has the exact line). After that, pick your lane: editor install script vs `cli:install`—again spelled out in the README. The interesting bit is that **both** paths land on the same storage layout and validators; we split the UX, not the model.

## About this HTML

You may be reading a **generated** page: `code-commentray-static` plus [`build-static-pages.mjs`](https://github.com/d-led/commentray/blob/main/scripts/build-static-pages.mjs) and [`pages.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/pages.yml) are the assembly line. Point `[static_site]` at another source file and you get the same split-pane treatment—configuration is the cameo, not a fork of the product.

## Cookbook (tone, not a second README)

- **Greenfield adopt** — `commentray init` is deliberately boring (idempotent, safe to re-run). The “aha” is that nothing in your primary tree _has_ to move.
- **Hook paranoia** — `init scm` is for teams who want the index validated **before** misleading commentray can merge; it is opt-in because hooks are a social contract, not a library concern.
- **“Why is my tree red?”** — `doctor` layers environment noise on top of `validate` so humans get a single front door.
- **Binaries** — Use **GitHub Releases** for downloads; CI workflow artifacts from [`binaries.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml) expire after 14 days by design.
- **Your own Pages** — Copy [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml), adjust `[static_site]`, run `npm run pages:build`. The dogfood site is proof the pipeline is boring enough to reuse.

## Architecture (who talks to whom)

Treat the left README’s bullet list as the roster. In practice: **`@commentray/core`** owns truth (paths, index schema, staleness); **`@commentray/render`** owns “safe enough HTML”; **`@commentray/cli`** is the automation face; **`commentray-vscode`** is the human face; **`code-commentray-static`** is the smallest interesting consumer of the renderer. If you change the HTML contract, walk that chain backward before you tag.

## Reference (jump off points)

- Storage layout: [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md)
- Anchor strategies: [`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md)
- Block grammar: [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
- Roadmap: [`docs/plan/plan.md`](https://github.com/d-led/commentray/blob/main/docs/plan/plan.md)
- Debugging the extension: [`docs/development.md`](https://github.com/d-led/commentray/blob/main/docs/development.md)
- Trust model & parsing guarantees: [`SECURITY.md`](https://github.com/d-led/commentray/blob/main/SECURITY.md)
- Quality gate & contribution flow: [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md)

## What Commentray is not (one beat each)

Not a substitute for good inline comments where the medium allows. Not a hosted blog—**commentray** travels in **git** with the code it explains. Not editor-exclusive—the CLI is the same story without a GUI.
