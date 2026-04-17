# Commentary storage layout

## Repository root

- **Config**: `.commentary.toml` (TOML). Omitted keys use built-in defaults.
- **Storage root**: defaults to `.commentary/` under the repository root.

## Directories

- **`.commentary/source/`**: Markdown commentary files.
- **`.commentary/metadata/`**: Machine-oriented JSON (indices, fingerprints, diagnostics).

## Commentary file naming

Given a **repo-relative** primary file path `P` (POSIX-style, no `..` segments), the commentary Markdown path is:

```text
.commentary/source/{P}.md
```

Examples:

- `src/server.ts` → `.commentary/source/src/server.ts.md`
- `README.md` → `.commentary/source/README.md.md`

The mapping is intentionally transparent: append `.md` to the original path under a stable prefix.

## Metadata

The default index file is:

```text
.commentary/metadata/index.json
```

It is plain JSON with a `schemaVersion` field so migrations remain explicit and auditable.
