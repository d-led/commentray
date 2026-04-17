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

## Metadata

The default index file is:

```text
.commentray/metadata/index.json
```

It is plain JSON with a `schemaVersion` field so migrations remain explicit and auditable.
