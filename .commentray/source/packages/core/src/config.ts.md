# `config.ts` — companion

Every entrypoint funnels through here so **one** definition of “safe path” wins. New knobs mean extending `CommentrayToml`, `mergeCommentrayConfig`, and **`assertSafeConfigPaths`** together—otherwise someone’s `init` or `validate` quietly disagrees.

The **storage-under-`.git/`** rule is worth the drama: Git owns that tree; colocating our storage there is how you get a mystery deletion story in act two.

**TOML** — Multiline **`"""`** strings and arrays parse the same as one-liners (`@iarna/toml`); that’s for humans writing long URLs in `.commentray.toml`, not for cleverness in code.

**Pointers:** [`docs/spec/storage.md`](https://github.com/d-led/commentray/blob/main/docs/spec/storage.md) · [`packages/core/src/config.test.ts`](https://github.com/d-led/commentray/blob/main/packages/core/src/config.test.ts)
