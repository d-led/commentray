# `quality-gate.sh` — companion

Single entry for “**merge-ready**” quality: **`format:check`** → **`lint`** (ESLint + **shellcheck** via `scripts/shellcheck.sh`) → **`dupes`** → **`typecheck`** → **`COMMENTRAY_TEST_MODE=unit` tests**.

## Philosophy

One script name (`quality-gate`) so docs and CI never drift to a forgotten `ci-quick` alias. Expensive tiers stay opt-in (`ci-expensive.yml`, PR label).

## When it fails

Fix the root cause; widening ignore lists to greenwash CI is an explicit non-goal in [`CONTRIBUTING.md`](https://github.com/d-led/commentray/blob/main/CONTRIBUTING.md).
