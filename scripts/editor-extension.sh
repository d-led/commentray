#!/usr/bin/env bash
set -euo pipefail

# Build and launch Cursor / VS Code with this repo's Commentray extension loaded
# from packages/vscode (development install — no .vsix).
#
# Usage:
#   bash scripts/editor-extension.sh dogfood [path...]   # default: open this repo
#
# Editor CLI:
#   Set COMMENTRAY_EDITOR (e.g. "cursor", "code", or a full path).
#   Otherwise: prefer "cursor" if on PATH, else "code".

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

pick_editor_cli() {
  if [[ -n "${COMMENTRAY_EDITOR:-}" ]]; then
    echo "$COMMENTRAY_EDITOR"
    return
  fi
  if command -v cursor >/dev/null 2>&1; then
    echo cursor
    return
  fi
  if command -v code >/dev/null 2>&1; then
    echo code
    return
  fi
  echo "Could not find 'cursor' or 'code' on PATH. Install the editor's shell command, or set COMMENTRAY_EDITOR." >&2
  exit 1
}

build_extension() {
  npm run build -w @commentray/core
  npm run build -w commentray-vscode
}

cmd_dogfood() {
  build_extension
  local editor_cli
  editor_cli="$(pick_editor_cli)"
  if [[ "$#" -eq 0 ]]; then
    set -- "$REPO_ROOT"
  fi
  echo "Launching ${editor_cli} with --extension-development-path=$REPO_ROOT/packages/vscode" >&2
  exec "$editor_cli" --extension-development-path="$REPO_ROOT/packages/vscode" "$@"
}

case "${1:-}" in
  dogfood)
    shift
    cmd_dogfood "$@"
    ;;
  *)
    echo "Usage: $0 dogfood [folder...]" >&2
    exit 2
    ;;
esac
