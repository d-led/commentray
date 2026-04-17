#!/usr/bin/env bash
set -euo pipefail

# One-shot setup for a fresh checkout of Commentray:
#   1. install npm dependencies
#   2. build all workspaces
#   3. initialize .commentray/ storage + default .commentray.toml
#   4. run `commentray doctor` as a health check
#
# Idempotent — safe to rerun.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "== Installing dependencies =="
npm install

echo "== Building all workspaces =="
npm run build

echo "== Initializing Commentray workspace =="
npm run commentray -- init

echo "== Running commentray doctor =="
npm run commentray -- doctor
