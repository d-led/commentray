# @commentray/cli

Command-line interface for [Commentray](https://github.com/d-led/commentray) — a side-by-side "commentary track" for code. Provides idempotent workspace setup, validation, staleness doctoring, metadata migration, and HTML rendering.

## Install

```bash
npm install -D @commentray/cli
# or globally:
npm install -g @commentray/cli
```

Standalone, self-contained binaries (no Node install needed) for Linux x64/arm64, macOS x64/arm64, and Windows x64 are attached to **[GitHub Releases](https://github.com/d-led/commentray/releases)** for every `v*` tag (that is the supported download location). CI workflow artifacts expire after a short retention period—use Releases, not old Actions runs.

## Use

```bash
commentray init            # dirs + index.toml if missing; migrate/normalize index; validate
commentray init config     # ensure .commentray.toml exists (with --force to replace)
commentray init scm        # install/refresh a marked block in .git/hooks/pre-commit
commentray validate        # schema + anchor integrity + Git staleness evidence
commentray doctor          # validate plus environment checks
commentray migrate         # migrate metadata JSON to the current schema
commentray render --source SRC --markdown MD --out OUT.html [--mermaid]
commentray paths SRC       # print the commentray Markdown path for a source file
```

Exit codes: `0` for success, `1` when validation finds errors (suitable for CI).

## License

[MPL-2.0](./LICENSE)
