#!/usr/bin/env bash
set -euo pipefail

# Open VS Code / Cursor with the Commentray extension loaded from source
# (Extension Development Host) on the small dogfood fixture—so maintainers
# can capture real UI (paired panes, menus, keybindings) for commentray docs.
#
# There is no automated screenshot step: OS or editor tools vary too much for
# a reliable headless pipeline. Save PNG/SVG/WebP next to the angle’s `.md`
# (dogfood README main angle):
#   .commentray/source/README.md/assets/
# Reference from main.md as:  ./assets/your-file.png   (same ./… rules as VS Code)
#
# Usage (repo root):
#   bash scripts/open-vscode-for-commentray-screenshots.sh
#   npm run extension:commentray-screenshots

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/pick-editor-cli.sh
source "$REPO_ROOT/scripts/lib/pick-editor-cli.sh"

EXT_DEV_PATH="$REPO_ROOT/packages/vscode"
FIXTURE="$EXT_DEV_PATH/fixtures/dogfood"
ASSETS_DIR="$REPO_ROOT/.commentray/source/README.md/assets"

mkdir -p "$ASSETS_DIR"

echo "Commentray screenshot prep"
echo "----------------------------"
echo "1. This window will launch your editor in Extension Development Host on:"
echo "   $FIXTURE"
echo "2. Run Commentray commands (e.g. open paired markdown), arrange the layout."
echo "3. Capture with your OS or editor screenshot tool."
echo "4. Save files into (already created if missing):"
echo "   $ASSETS_DIR"
echo "5. In main.md use:  ![…](./assets/<filename>)"
echo "   See docs/spec/storage.md § Images and other local assets."
echo ""

editor_cli="$(commentray_pick_editor_cli)"

set +e
"$editor_cli" --extensionDevelopmentPath="$EXT_DEV_PATH" "$FIXTURE"
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  echo "" >&2
  echo "If --extensionDevelopmentPath failed, your editor build may not support it." >&2
  echo "Fallback: npm run extension:dogfood  then open paired panes manually." >&2
  exit "$status"
fi
