# Anchor grammar (v0)

Anchors connect commentray **blocks** to spans inside a primary file. The grammar is intentionally small and versioned; language-specific plugins may interpret additional opaque anchors later.

## Supported forms

### Line ranges

```text
lines:<start>-<end>
```

Where `start` and `end` are **1-based** inclusive line numbers and `end >= start`.

Examples:

- `lines:10-40`

### Symbols (opaque name)

```text
symbol:<name>
```

`name` is a language-specific identifier string (function name, type name, etc.). Resolution is provided by language plugins; the core library treats unknown resolution as a **diagnostic**, not a hard failure.

Examples:

- `symbol:Handler`

### Marker ids (`marker:<id>`)

```text
marker:<id>
```

`<id>` is **1–64 characters**: ASCII letters, digits, hyphen (`-`), and underscore (`_`); it must start with a letter or digit. Examples: `intro`, `auth-handler`, `block_01`, `a3f9k2`.

The same token appears in source as `commentray:<id>` in `#region` / `#endregion` style delimiters, or as `commentray:start id=<id>` / `commentray:end id=<id>` in generic comments. The Markdown `<!-- commentray:block id=<id> -->` marker and `index.json` `block.id` must use **the same** `<id>` when the anchor is `marker:…`.

Validation: **per source file**, paired starts/ends must be well-formed (no duplicate opens, no orphans). **`commentray validate`** also warns when the same id is reused across **different** source files (repo-wide ambiguity for links) and errors if the same `(sourcePath, marker id)` is claimed by different block ids in the index.

### Opaque anchors

Any string that does not match the forms above is stored as an **opaque** anchor for forward compatibility.

## Cross references

Cross references are authored in Markdown using normal links and conventions:

- Repo-relative links where possible.
- Stable public URLs for external dependencies.

Higher-level “xref” syntax may be introduced later as an optional Markdown extension, backed by the same anchor model.
