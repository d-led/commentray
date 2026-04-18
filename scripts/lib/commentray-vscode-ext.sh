# shellcheck shell=bash
# Shared id + uninstall helper for scripts that drive the Cursor / VS Code CLI.
#
# Must be sourced after `scripts/lib/pick-editor-cli.sh` when using
# `commentray_uninstall_packaged_commentray_if_present`.

COMMENTRAY_VSCODE_EXTENSION_ID="d-led.commentray-vscode"

# Removes the **installed** (Marketplace or prior .vsix) Commentray so it cannot
# shadow or duplicate the workspace under development / a new install.
# Ignores failure when the extension is not installed.
commentray_uninstall_packaged_commentray_if_present() {
  local editor_cli="${1:?commentray_uninstall_packaged_commentray_if_present: editor_cli required}"
  echo "Removing installed Commentray ($COMMENTRAY_VSCODE_EXTENSION_ID) if present (avoids Marketplace copy vs dogfood / reinstall)..." >&2
  "$editor_cli" --uninstall-extension "$COMMENTRAY_VSCODE_EXTENSION_ID" >/dev/null 2>&1 || true
}
