#!/usr/bin/env bash
set -euo pipefail
# Builds workspace packages needed by `commentray serve`, then runs it.
# By default `node scripts/serve-with-package-watch.mjs` also watches
# `packages/{core,render,code-commentray-static,cli}/src` (plus render's
# esbuild script), rebuilds on change, and restarts `commentray serve` so
# Node picks up new `dist/` output. You should not need to restart `serve`
# by hand: `commentray serve` also rebuilds `_site/` on static-site changes
# while keeping the same HTTP listener. Set COMMENTRAY_SERVE_NO_PACKAGE_WATCH=1
# to skip the package watcher (one-shot package builds only).
# Used by `npm run serve` and `npm run pages:serve` at the repo root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ "${COMMENTRAY_SERVE_NO_PACKAGE_WATCH:-}" = "1" ]; then
  npm run build -w @commentray/core
  npm run build -w @commentray/render
  npm run build -w @commentray/code-commentray-static
  npm run build -w @commentray/cli
  exec node packages/cli/dist/cli.js serve "$@"
fi

exec node "$REPO_ROOT/scripts/serve-with-package-watch.mjs" "$@"
