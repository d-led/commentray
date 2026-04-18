#!/usr/bin/env bash
set -euo pipefail

# Full quality gate: the set of checks that must pass before a change is
# considered done. Runs:
#   - prettier format check
#   - ESLint (project + refactor metrics)
#   - duplicate detection (jscpd)
#   - tsc -b across the monorepo
#   - unit tests
#
# Stops at the first failing step and prints which step failed (see messages
# above the failing tool output — e.g. format:check names the first drifted file).
#
# Slow-lane checks (integration, expensive tests, binary smoke) live in
# scripts/ci-full.sh, which is this gate plus those extras.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

run_step() {
  local name="$1"
  shift
  echo "" >&2
  echo "---- quality-gate: ${name} ----" >&2
  if ! "$@"; then
    echo "" >&2
    echo "QUALITY GATE FAILED at: ${name}" >&2
    echo "Fix the issue above, then re-run: bash scripts/quality-gate.sh" >&2
    exit 1
  fi
}

run_step "format:check" npm run format:check
run_step "lint" npm run lint
run_step "dupes" npm run dupes
run_step "typecheck" npm run typecheck
run_step "test (unit)" env COMMENTRAY_TEST_MODE=unit npm run test

echo "" >&2
echo "Quality gate passed." >&2
