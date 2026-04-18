#!/usr/bin/env bash
set -euo pipefail

# Build and launch Cursor / VS Code with this repo's Commentray extension
# loaded from packages/vscode (development install — no .vsix).
#
# Usage:
#   bash scripts/editor-extension.sh dogfood              # open the fixture folder
#   bash scripts/editor-extension.sh dogfood <path>       # open a specific folder
#
# By default this opens `packages/vscode/fixtures/dogfood`, a minimal
# commentray-enabled workspace committed to this repo. That avoids VS Code /
# Cursor's "one folder per profile" rule, which otherwise steals focus back to
# your main window when you try to open a folder it already has open.
#
# To actually USE the extension in your own projects, install the packaged
# .vsix instead:
#   npm run extension:install
#
# `npm run build -w commentray-vscode` runs tsc then esbuild so `@commentray/core`
# is inlined into dist/extension.js (same as packaged .vsix).
#
# Editor CLI:
#   $COMMENTRAY_EDITOR (path or command) is honored first.
#   Otherwise: prefer `cursor` if on PATH, else `code`.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/pick-editor-cli.sh
source "$REPO_ROOT/scripts/lib/pick-editor-cli.sh"

DEFAULT_DOGFOOD_FOLDER="$REPO_ROOT/packages/vscode/fixtures/dogfood"

build_extension() {
  npm run build -w @commentray/core
  npm run build -w commentray-vscode
  bundled_schema="$(
    node --input-type=module -e "import { CURRENT_SCHEMA_VERSION } from './packages/core/dist/model.js'; process.stdout.write(String(CURRENT_SCHEMA_VERSION))"
  )"
  echo "Built commentray-vscode (bundled @commentray/core index schemaVersion: ${bundled_schema})." >&2
}

warn_if_folder_collides_with_main() {
  local target_abs="$1"
  # Heuristic: if the user points the dev host at this very repo, Cursor/VS
  # Code will focus-steal to any existing window holding it. We can't detect
  # "already open" reliably, so warn unconditionally for this one known case.
  if [[ "$target_abs" == "$REPO_ROOT" ]]; then
    cat >&2 <<EOF
warning: opening the Commentray repository itself in the dev host.
         If your regular Cursor window already has this folder open,
         VS Code / Cursor will focus that window instead of the dev host.
         Close the main window first, or use the default fixture:
           bash scripts/editor-extension.sh dogfood
EOF
  fi
}

cmd_dogfood() {
  build_extension

  local target
  if [[ "$#" -eq 0 ]]; then
    target="$DEFAULT_DOGFOOD_FOLDER"
  else
    target="$(cd "$1" && pwd)"
    shift
  fi

  warn_if_folder_collides_with_main "$target"

  local editor_cli
  editor_cli="$(commentray_pick_editor_cli)"

  # VS Code / Cursor expect the camelCase form `--extensionDevelopmentPath`.
  # The kebab-case variant is parsed by Electron/Chromium, not VS Code's
  # extension host, and the dev window never opens.
  echo "Launching ${editor_cli} against ${target}" >&2
  echo "Using --extensionDevelopmentPath (workspace extension). For the normal install path, run: bash scripts/install-extension.sh" >&2
  exec "$editor_cli" \
    --extensionDevelopmentPath="$REPO_ROOT/packages/vscode" \
    "$target" \
    "$@"
}

case "${1:-}" in
  dogfood)
    shift
    cmd_dogfood "$@"
    ;;
  *)
    echo "Usage: $0 dogfood [folder]" >&2
    exit 2
    ;;
esac
