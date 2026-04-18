# `quality-gate.sh` — commentray

One script name so docs and CI share the same front door. Order: **`format:check`** → **`lint`** (ESLint + shellcheck) → **`dupes`** → **`typecheck`** → **`COMMENTRAY_TEST_MODE=unit` tests**. Expensive tiers stay opt-in (`ci-expensive.yml`, PR label).

**When it fails** — Fix the root cause; widening ignores to greenwash CI is an explicit non-goal in [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md).
