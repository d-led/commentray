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

  # Isolate the Extension Development Host with its own user-data and
  # extensions directories. Without this, Cursor/VS Code enforces "one
  # window per folder per profile": opening this repo in the dev host
  # steals focus back to the main window that already has it open.
  # A dedicated data dir makes the dev host a separate instance for
  # window-tracking purposes, so the same folder can be open in both.
  local dev_home="$REPO_ROOT/.commentray-dev"
  local dev_data="$dev_home/editor-data"
  local dev_exts="$dev_home/editor-extensions"
  mkdir -p "$dev_data" "$dev_exts"

  # VS Code / Cursor expect the camelCase form `--extensionDevelopmentPath`.
  # The kebab-case variant is parsed by Electron/Chromium, not VS Code's
  # extension host, and the dev window never opens.
  echo "Launching ${editor_cli} (isolated profile at ${dev_home})" >&2
  exec "$editor_cli" \
    --new-window \
    --user-data-dir="$dev_data" \
    --extensions-dir="$dev_exts" \
    --extensionDevelopmentPath="$REPO_ROOT/packages/vscode" \
    "$@"
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
