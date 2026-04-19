# Commentray — a side-by-side documentation ecosystem

Have you ever wished a “commentary track” for code the way DVD extras let filmmakers talk over a film **without** changing the picture? When looking at code, that might answer the whys, reveal the intent **besides** the code itself.

The **ecosystem** is a few published **`@commentray/*` libraries** (shared config and paths, Markdown → HTML, static “code + commentray” pages), the **`commentray` CLI**, and a **VS Code / Cursor** extension—all agreeing on **`.commentray.toml`** and the **`.commentray/`** tree. **Tooling** keeps companions tied to the source: optional **Git pre-commit**, **`validate`** / **`doctor`**, migrations, **`render`** / **`pages:build`** / **`serve`** for browsable HTML, and (when published) **standalone binaries** for machines without Node. This repo’s own CI runs the **quality gate** (format, lint, typecheck, unit tests, etc.) and **Cypress** against a built static site—it does **not** run `commentray validate` as a separate step unless you add that to your workflow.

## Why

Inline comments are not always possible (generated files, tight formats, policy). Commentray keeps the primary artifact clean while storing rationale, warnings, and diagrams in **commentray**—Markdown that lives under `.commentray/source/` beside the code it explains. In a meeting you might hear: _“We have to document our architecture **in commentray** so that newcomers can have an effective source code onboarding experience.”_ Same word names the tool and the practice; context disambiguates.

The same split is useful when you want **rich context for a human or a chatbot**—runbooks, product rationale, incident notes, onboarding prose—that does not belong in the source file itself, yet stays **correlatable** with specific lines or regions through the metadata index and block anchors, so the assistant can reason about “this commentary goes with that code” without you pasting a wall of inline comments into the repo.

**Good for:** **developers**, **architects**, and **LLM**-assisted workflows that each need **context-specific** insight into the same codebase with different rationale, warnings, and diagrams beside the source without crowding the primary file. Also onboarding next to the code, pre-commit validation of companion metadata, and publishing a **code + commentray** static site (for example GitHub Pages) with scroll-linked panes.

## Live README + commentray

This repository’s **GitHub Pages** build pairs `README.md` with commentray under [`.commentray/source/README.md/`](.commentray/source/README.md/)—that column is meant as the **voice-over** (trade-offs, cookbook, diagrams) while this file stays the **scannable facts**. Open the [published site](https://d-led.github.io/commentray/) to try block-aware scroll sync without installing anything.

## Using Commentray

Short, command-first guides (install the CLI or extension, first `.commentray/` setup, validation, and what each layer catches):

- [Install](docs/user/install.md) — binaries, `npm i -g @commentray/cli`, editor extension
- [Quickstart](docs/user/quickstart.md) — `commentray init`, paired Markdown paths, validate
- [Keeping blocks in sync](docs/user/keeping-blocks-in-sync.md) — index, markers, anchors
- [What Commentray detects](docs/user/detection.md) — hook, CLI, editor, known gaps
- [CLI reference](docs/user/cli.md) — commands, exit codes, env vars
- [Configuration](docs/user/config.md) — `.commentray.toml` keys
- [Troubleshooting](docs/user/troubleshooting.md) — common failures

## Install surfaces

| Surface              | Get it                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI (Node)**       | [`@commentray/cli`](https://www.npmjs.com/package/@commentray/cli) on npm — `npm install -g @commentray/cli`                                                                                                                                         |
| **CLI (no Node)**    | [GitHub Releases](https://github.com/d-led/commentray/releases) per **`v*`** tag when published (**none yet**—use **npm -g** or a [clone build](docs/development.md#clone-and-workspace-setup); [Standalone CLI binaries](#standalone-cli-binaries)) |
| **VS Code / Cursor** | Marketplace: **[`d-led.commentray-vscode`](https://marketplace.visualstudio.com/items?itemName=d-led.commentray-vscode)**                                                                                                                            |

Install paths: [Install](docs/user/install.md). Clone, local SEA builds, and macOS quarantine on downloaded binaries: [Development](docs/development.md#cli-binaries-and-pages).

## npm packages (library ecosystem)

Published libraries and tools (versions move in lockstep; see [Developing this repository](#developing-this-repository) for releases):

| Package                                                                                                  | Role                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@commentray/core`](https://www.npmjs.com/package/@commentray/core)                                     | Models, TOML config, JSON metadata validation, Git SCM adapter, staleness helpers                                                                        |
| [`@commentray/render`](https://www.npmjs.com/package/@commentray/render)                                 | Markdown → HTML (GFM), syntax highlighting, Mermaid, HTML shells for side-by-side and interactive static browsing                                        |
| [`@commentray/code-commentray-static`](https://www.npmjs.com/package/@commentray/code-commentray-static) | Sample generator for a single static HTML “code + commentray” page; used with `[static_site]` in `.commentray.toml` and `npm run pages:build` → `_site/` |
| [`@commentray/cli`](https://www.npmjs.com/package/@commentray/cli)                                       | `commentray` — `init`, validate/doctor/migrate/render, **`serve`**, Git hook helpers                                                                     |

The **VS Code / Cursor** extension ships as **`d-led.commentray-vscode`** on the Marketplace (not published as an npm package). `commentray init` merges that extension id into [`.vscode/extensions.json`](.vscode/extensions.json) when the file is mergeable JSON.

**Also in this repo:** `packages/vscode` — extension sources (paired commentray beside source, **scroll sync when `index.json` and Markdown markers align**, workspace validation in an output channel). Standalone CLI executables (Node SEA) are built in [`.github/workflows/binaries.yml`](.github/workflows/binaries.yml); **`v*`** tags are meant to publish them to [Releases](https://github.com/d-led/commentray/releases) (**none yet**).

## Repository map

- **User-facing guides** — [`docs/user/`](docs/user/) — install, quickstart, validation, troubleshooting: **for anyone using Commentray on their own project**, not for hacking this monorepo (contributors: [`docs/development.md`](docs/development.md)).
- **Specs (how it is supposed to work)** — [`docs/spec/storage.md`](docs/spec/storage.md) (paths & Angles), [`docs/spec/anchors.md`](docs/spec/anchors.md) (binding commentary to source), [`docs/spec/blocks.md`](docs/spec/blocks.md) (markers and index blocks).
- **Companion tree** — [`.commentray/`](.commentray/) — where companion Markdown under `source/` and `metadata/` (for example `index.json`) live next to your code, outside the primary files they explain.
- **Ideas / backlog** — [`docs/plan/plan.md`](docs/plan/plan.md) — design notes and possible work; not a dated roadmap.
- **This repo’s root config** — [`.commentray.toml`](.commentray.toml) — optional TOML for storage, static site, render, etc., when working in **this** tree (dogfood / Pages).

## Standalone CLI binaries

Prefer not to install Node? **`v*`-tagged** builds are meant to land on **[GitHub Releases](https://github.com/d-led/commentray/releases)** ([`.github/workflows/binaries.yml`](.github/workflows/binaries.yml)). **There are no releases on that page yet**—until the first one ships, use **`npm install -g @commentray/cli`** or work from a [clone](docs/development.md#clone-and-workspace-setup). Short-lived **workflow artifacts** (14 days) are only for debugging a run. End-user install detail: [Install](docs/user/install.md); macOS quarantine and local binary builds: [Development](docs/development.md#macos-quarantine-standalone-cli).

## Developing this repository

Clone and first-time setup: [`docs/development.md` → Clone and workspace setup](docs/development.md#clone-and-workspace-setup). Idempotent refresh at the repo root:

```bash
npm run setup       # install, build, init, doctor — idempotent
```

Everything else—quality gate, tests, Cypress, extension dogfood, `serve` / Pages, binaries, CI—is in [`docs/development.md`](docs/development.md). See also [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Packages in this monorepo are licensed under **MPL-2.0** (see `LICENSE` and per-package copies).

## On the Name

**Repository:** [github.com/d-led/commentray](https://github.com/d-led/commentray). The name **Commentray** avoids collision with the unrelated VSX id [`jaredhughes.commentary`](https://marketplace.cursorapi.com/items/?itemName=jaredhughes.commentary) on Open VSX, although originally it was supposed to be called that.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/development.md`](docs/development.md).
