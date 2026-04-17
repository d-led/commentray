# Commentray storage layout

## Repository root

- **Config**: `.commentray.toml` (TOML). Omitted keys use built-in defaults.
- **Storage root**: defaults to `.commentray/` under the repository root.

## Directories

- **`.commentray/source/`**: Markdown commentray files.
- **`.commentray/metadata/`**: Machine-oriented JSON (indices, fingerprints, diagnostics).

## Commentray file naming

Given a **repo-relative** primary file path `P` (POSIX-style, no `..` segments), the commentray Markdown path is:

```text
.commentray/source/{P}.md
```

Examples:

- `src/server.ts` → `.commentray/source/src/server.ts.md`
- `README.md` → `.commentray/source/README.md.md`

The mapping is intentionally transparent: append `.md` to the original path under a stable prefix.

## Images and other local assets (static HTML)

When companion Markdown is rendered to static HTML (GitHub Pages, `commentray render`), `img[src]` and local `a[href]` are rewritten so links work from the output HTML file. Use normal Markdown URL rules with one extension for the **repository root**:

| You write (in companion `.md`) | Resolves relative to |
| ------------------------------ | -------------------- |
| `![](/docs/diagram.svg)` | Repository root (`docs/diagram.svg` from the clone root) |
| `![](./figures/diagram.svg)` | The companion file’s directory (usually `.commentray/source/…`) |
| `![](figures/diagram.svg)` | Same as above (standard Markdown: relative to the companion file) |

A leading **`/`** means “from the repository root” (POSIX path after the slash). Paths without a leading slash follow **CommonMark**: they are resolved from the directory that contains the companion Markdown file, so assets can live **next to** that file or in subfolders (for example `.commentray/source/README.md.assets/` or `.commentray/source/figures/`).

**Note:** The built-in VS Code Markdown preview resolves URLs relative to the open `.md` file on disk; it does not run this HTML rewriter. The `/` versus companion-relative rules above still match how the preview resolves paths when files exist on disk.

## Metadata

The default index file is:

```text
.commentray/metadata/index.json
```

It is plain JSON with a `schemaVersion` field so migrations remain explicit and auditable.
