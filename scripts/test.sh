#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
mode="${COMMENTRAY_TEST_MODE:-unit}"
case "$mode" in
  unit) exec npm run test:unit ;;
  integration) exec npm run test:integration ;;
  expensive) exec npm run test:expensive ;;
  all)
    npm run test:unit && npm run test:integration && npm run test:expensive
    ;;
  *) echo "Unknown COMMENTRAY_TEST_MODE=$mode (use unit|integration|expensive|all)" >&2; exit 1 ;;
esac
