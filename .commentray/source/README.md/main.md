# Commentray — quick-start

<!-- commentray:block id=readme-lede -->

_You have the main [`README.md`](https://github.com/d-led/commentray/blob/main/README.md) in the left column: packages, scripts, release flow. This file **is** commentray for that README—the voice-over beside the facts, not a second brochure._

<!-- commentray:block id=readme-why -->

The README’s _Why_ section names the product (**Commentray**) and the prose you write (**commentray**). Same checkout, two panes: the left states what exists; this column states why it is shaped that way and where the edges are.

<!-- commentray:block id=readme-user-guides -->

The README’s **Using Commentray** section links short guides under `docs/user/`—install, quickstart, detection, CLI reference, configuration, troubleshooting—without walking the whole monorepo first.

## Try scroll sync (why the editor extension exists)

On **[GitHub Pages](https://d-led.github.io/commentray/)** the split is live: **Code** is this repo’s `README.md`; **Commentray** is this file, rendered as HTML. Scroll either pane—the other follows in **lockstep** (**block stretch** when this repo’s `index.json` lists blocks for this pair with matching `<!-- commentray:block … -->` markers; otherwise **proportional** sync). That is the DVD-style commentary metaphor without installing anything.

The deploy is a **single** HTML file, so in-commentray Markdown links rewritten to repo-relative paths can **404** on Pages; use full `https://github.com/…/blob/…` URLs when the link must work from the static site.

**Search:** **Escape** clears the query and hides hit results (same as **Clear**).

The **VS Code / Cursor** extension is for **authoring**: **Commentray: Open commentray beside source**, both editors visible, scroll source and let commentray track. After **Commentray: Add block from selection**, sync can **snap to the block** that owns the visible source lines when `index.json` and `<!-- commentray:block id=… -->` markers agree; otherwise you stay on proportional sync. Same storage model as the site; the extension is where editing stays pleasant.

## Why this file exists

The README stays scannable. Here we keep motive, trade-offs, and sharp edges—without duplicating another full quickstart.

## If you only do one thing

Clone and `npm run setup` (see README). Then pick editor install script or `cli:install`; both land on the same `.commentray/` layout and validators. Same model, different entrypoints.

## About this HTML

You may be reading a **generated** page: `@commentray/code-commentray-static`, [`build-static-pages.mjs`](https://github.com/d-led/commentray/blob/main/scripts/build-static-pages.mjs), and [`pages.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/pages.yml). Point `[static_site]` at another source file and you get the same layout—configuration is reuse, not a fork.

## Cookbook (tone, not a second README)

- **Greenfield adopt** — `commentray init` is idempotent; nothing in the primary tree has to move first.
- **Hook paranoia** — `init scm` runs `validate` before merge; opt-in because hooks are a team contract.
- **“Why is my tree red?”** — `doctor` stacks environment checks on `validate`.
- **Binaries** — **GitHub Releases** for downloads; CI artifacts from [`binaries.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml) expire after 14 days by design.
- **Your own Pages** — Copy [`.commentray.toml`](https://github.com/d-led/commentray/blob/main/.commentray.toml), adjust `[static_site]`, run `npm run pages:build`.

## Architecture (who talks to whom)

Do not duplicate the README’s package list here—that list is canonical. In one line: **core** holds paths and index truth; **render** holds safe HTML; **cli** and **vscode** are surfaces; **code-commentray-static** is the smallest renderer consumer. Change the HTML contract, then walk that chain backward before you tag.

## Reference (jump off points)

- Storage layout: [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md)
- Anchor strategies: [`docs/spec/anchors.md`](https://github.com/d-led/commentray/blob/main/docs/spec/anchors.md)
- Block grammar: [`docs/spec/blocks.md`](https://github.com/d-led/commentray/blob/main/docs/spec/blocks.md)
- Roadmap: [`docs/plan/plan.md`](https://github.com/d-led/commentray/blob/main/docs/plan/plan.md)
- Debugging the extension: [`docs/development.md`](https://github.com/d-led/commentray/blob/main/docs/development.md)
- Trust model & parsing guarantees: [`SECURITY.md`](https://github.com/d-led/commentray/blob/main/SECURITY.md)
- Quality gate & contribution flow: [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md)

## What Commentray is not (one beat each)

Not a substitute for inline comments where the medium allows. Not a hosted blog—**commentray** lives in **git** with the code it explains. Not editor-exclusive—the CLI is the same story without a GUI.
