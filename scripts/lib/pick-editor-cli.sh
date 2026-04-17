# shellcheck shell=bash
# Picks the editor CLI to use and echoes it on stdout.
#
#   $COMMENTRAY_EDITOR is honored first (path or command name).
#   Otherwise prefer `cursor`, then fall back to `code`.
#
# Exits the sourcing script with a clear message if neither is available.
commentray_pick_editor_cli() {
  if [[ -n "${COMMENTRAY_EDITOR:-}" ]]; then
    echo "$COMMENTRAY_EDITOR"
    return 0
  fi
  if command -v cursor >/dev/null 2>&1; then
    echo cursor
    return 0
  fi
  if command -v code >/dev/null 2>&1; then
    echo code
    return 0
  fi
  echo "Could not find 'cursor' or 'code' on PATH. Install the editor's shell command, or set COMMENTRAY_EDITOR." >&2
  return 1
}
