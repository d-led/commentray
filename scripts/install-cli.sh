#!/usr/bin/env bash
set -euo pipefail

# Install the Commentray CLI globally by symlinking the local workspace
# build via `npm link`. Fastest path for local use and dogfooding:
# subsequent `npm run build -w commentray` updates are picked up
# without reinstalling.
#
# Usage:
#   bash scripts/install-cli.sh            # link
#   bash scripts/install-cli.sh --unlink   # remove the global symlink
#
# Needs npm's global bin directory on PATH. Print the prefix with:
#   npm config get prefix

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "${1:-}" == "--unlink" ]]; then
  npm rm -g commentray
  echo "Unlinked commentray (global)."
  exit 0
fi

echo "Building @commentray/core, @commentray/render, commentray..."
npm run build -w @commentray/core
npm run build -w @commentray/render
npm run build -w commentray

chmod +x packages/cli/dist/cli.js

echo "Linking commentray globally..."
(cd packages/cli && npm link)

if ! command -v commentray >/dev/null 2>&1; then
  cat >&2 <<EOF
'commentray' is not on PATH. Add npm's global bin directory:
  export PATH="\$(npm config get prefix)/bin:\$PATH"
Then rerun: commentray --version
EOF
  exit 1
fi

bin_path="$(command -v commentray)"
version="$(commentray --version)"
echo "Installed: ${bin_path}  (${version})"
echo "Remove later with: bash scripts/install-cli.sh --unlink"
