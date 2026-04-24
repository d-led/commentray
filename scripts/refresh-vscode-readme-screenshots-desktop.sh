#!/usr/bin/env bash
set -euo pipefail

# Regenerate **desktop VS Code** PNGs for the extension README companion
# (`.commentray/source/packages/vscode/README.md/assets/vscode-*.png`).
#
# Implementation: `scripts/capture-vscode-readme-screenshots-desktop.mjs` (keyboard scenarios).
# How to change scenarios: see `.commentray/source/packages/vscode/README.md/main.md` § Maintainer.
#
# Usage (repository root):
#   bash scripts/refresh-vscode-readme-screenshots-desktop.sh
#   npm run extension:vscode-readme-screenshots:desktop

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

exec env -u ELECTRON_RUN_AS_NODE node scripts/capture-vscode-readme-screenshots-desktop.mjs
