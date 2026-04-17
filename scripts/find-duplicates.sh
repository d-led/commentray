#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Duplicate detection for first-party TS/JS (jscpd). Line/token based—tune -l / -k together.
# Any clone fails the script (--threshold 1) so CI stays at zero findings.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# jscpd keeps one -i value: single comma-separated ignore list.
JSCPD_IGNORE="**/node_modules/**,**/dist/**,**/coverage/**,**/.cache/**,**/.git/**,packages/code-commentray-static/site/**,*.vsix,.yarn/**"

# Bash 3.2 + set -u: empty "${array[@]}" is treated as unset; guard expansion.
exec npx jscpd . \
  -p "**/*.{ts,tsx,mjs,cjs,js}" \
  -i "${JSCPD_IGNORE}" \
  -r console \
  -m strict \
  -l 10 \
  -k 70 \
  --threshold 1
