# `init.ts` — commentray

**`runInitFull`** is the “first day on set” pass: directories, empty index if needed, `.commentray.toml` only if missing—idempotent so reruns feel like continuity, not a reshoot. **`runInitConfig --force`** is when you deliberately want the template voice-over again. **`runInitScm`** is a small delegation: the interesting merge logic lives in **`git-hooks.ts`**, not here.

The default TOML is **comment-first** on purpose—new repos see the knobs without flipping half of them on by accident.

**Wiring:** [`cli.ts`](https://github.com/d-led/commentray/blob/main/packages/cli/src/cli.ts) · [`git-hooks.ts`](https://github.com/d-led/commentray/blob/main/packages/cli/src/git-hooks.ts)
