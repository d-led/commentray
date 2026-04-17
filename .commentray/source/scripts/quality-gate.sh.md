# `quality-gate.sh` — companion

One script name so docs and CI never drift to a forgotten alias. The order is the story: **`format:check`** → **`lint`** (ESLint + shellcheck) → **`dupes`** → **`typecheck`** → **`COMMENTRAY_TEST_MODE=unit` tests**. Expensive tiers stay opt-in (`ci-expensive.yml`, PR label) so local iteration does not pay for the whole studio.

**When it fails** — Fix the root cause; widening ignores to greenwash CI is an explicit non-goal in [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md).
