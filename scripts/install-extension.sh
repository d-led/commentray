#!/usr/bin/env bash
set -euo pipefail

# Build, package, and install the Commentray extension into your regular
# Cursor / VS Code (not the Extension Development Host).
#
# Usage:
#   bash scripts/install-extension.sh                  # build + install
#   bash scripts/install-extension.sh --package-only   # just produce the .vsix
#   bash scripts/install-extension.sh --uninstall      # remove the installed extension
#
# Honors $COMMENTRAY_EDITOR (path or command), else prefers `cursor`, else `code`.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/pick-editor-cli.sh
source "$REPO_ROOT/scripts/lib/pick-editor-cli.sh"

EXT_DIR="$REPO_ROOT/packages/vscode"
EXT_ID="d-led.commentray-vscode"

ext_version() {
  node -e "process.stdout.write(require('$EXT_DIR/package.json').version)"
}

mode="install"
case "${1:-}" in
  --package-only) mode="package" ;;
  --uninstall) mode="uninstall" ;;
  "" ) mode="install" ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

if [[ "$mode" == "uninstall" ]]; then
  editor_cli="$(commentray_pick_editor_cli)"
  echo "Uninstalling $EXT_ID from $editor_cli..."
  "$editor_cli" --uninstall-extension "$EXT_ID"
  exit 0
fi

echo "Building @commentray/core and bundling the extension..."
npm run build -w @commentray/core
# Typecheck via tsc (no emit needed — esbuild produces the final artifact).
npm run build -w commentray-vscode
node "$EXT_DIR/esbuild.extension.mjs"

# `--no-dependencies` skips vsce's node_modules traversal: the bundle has
# no runtime deps, so the symlinked workspace package shouldn't be inspected.
version="$(ext_version)"
vsix_path="$EXT_DIR/dist/commentray-vscode-${version}.vsix"
echo "Packaging .vsix at $vsix_path..."
(cd "$EXT_DIR" && npx --yes @vscode/vsce@^3 package --no-dependencies --out "dist/commentray-vscode-${version}.vsix")

if [[ "$mode" == "package" ]]; then
  echo "Built $vsix_path (not installed)."
  exit 0
fi

editor_cli="$(commentray_pick_editor_cli)"
echo "Installing into $editor_cli..."
"$editor_cli" --install-extension "$vsix_path" --force
echo "Installed. Reload your editor window (Cmd/Ctrl+Shift+P → 'Developer: Reload Window')."
echo "Uninstall later with: bash scripts/install-extension.sh --uninstall"
