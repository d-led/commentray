# `init.ts` — companion

**`runInitFull`** — idempotent: storage dirs, seed `metadata/index.json`, write **`.commentray.toml`** only if missing. **`runInitConfig`** / **`--force`** for template refresh. **`runInitScm`** delegates to the marked `pre-commit` hook merge.

## Default template

`DEFAULT_COMMENTRAY_TOML` is intentionally commented-first so new repos see every knob without turning anything on by accident.

## Adjacent commands

CLI wiring lives in [`cli.ts`](https://github.com/d-led/commentray/blob/main/packages/cli/src/cli.ts); hook body is assembled in [`git-hooks.ts`](https://github.com/d-led/commentray/blob/main/packages/cli/src/git-hooks.ts).
