#!/usr/bin/env bash
set -euo pipefail
# Builds workspace packages needed by `commentray serve`, then runs it (watches + rebuilds `_site`).
# Used by `npm run serve` and `npm run pages:serve` at the repo root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
npm run build -w @commentray/core
npm run build -w @commentray/render
npm run build -w @commentray/code-commentray-static
npm run build -w @commentray/cli
exec node packages/cli/dist/cli.js serve "$@"
