# `config.ts` — companion

Loads `.commentray.toml`, merges typed defaults, normalizes **`[static_site]`** (snake_case in file → camelCase in memory), and rejects path values that would escape the repo root.

## What to change here

- New config keys → extend `CommentrayToml` + `mergeCommentrayConfig` + `assertSafeConfigPaths`.
- **Storage** must never sit under `.git/` — enforced in one place so every entrypoint shares the rule.

## TOML quality-of-life

Multiline **`"""`** strings and multiline arrays parse the same as one-liners (`@iarna/toml`). Handy for long URLs and strategy lists without 200-character lines.

## Cross-links

- [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) — path mapping to `.commentray/source/<path>.md`
- [`packages/core/src/config.test.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.test.ts) — merge + safety tests
