# Anchor grammar (v0)

Anchors connect commentary **blocks** to spans inside a primary file. The grammar is intentionally small and versioned; language-specific plugins may interpret additional opaque anchors later.

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

### Opaque anchors

Any string that does not match the forms above is stored as an **opaque** anchor for forward compatibility.

## Cross references

Cross references are authored in Markdown using normal links and conventions:

- Repo-relative links where possible.
- Stable public URLs for external dependencies.

Higher-level “xref” syntax may be introduced later as an optional Markdown extension, backed by the same anchor model.
