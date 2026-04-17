#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
npm run format:check
npm run lint
npm run dupes
npm run typecheck
COMMENTRAY_TEST_MODE=unit npm run test
