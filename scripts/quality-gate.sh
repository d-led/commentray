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
# Slow-lane checks (integration, expensive tests, binary smoke) live in
# scripts/ci-full.sh, which is this gate plus those extras.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

npm run format:check
npm run lint
npm run dupes
npm run typecheck
COMMENTRAY_TEST_MODE=unit npm run test
