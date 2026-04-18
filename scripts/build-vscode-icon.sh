#!/usr/bin/env bash
set -euo pipefail

# Rasterize the canonical SVG logo into the PNG icon shipped inside the
# Commentray VSIX. The Marketplace requires a PNG (SVG is rejected); we
# regenerate from the SVG source so docs/logos stays the single source of truth.
#
# Usage:
#   bash scripts/build-vscode-icon.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SVG="$REPO_ROOT/docs/logos/1.svg"
TARGET_PNG="$REPO_ROOT/packages/vscode/icon.png"
TARGET_SIZE=256

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert not found. Install with: brew install librsvg" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_SVG" ]]; then
  echo "Missing icon source: $SOURCE_SVG" >&2
  exit 1
fi

echo "Rendering $SOURCE_SVG -> $TARGET_PNG (${TARGET_SIZE}x${TARGET_SIZE})"
rsvg-convert --width "$TARGET_SIZE" --height "$TARGET_SIZE" \
  --keep-aspect-ratio \
  --output "$TARGET_PNG" \
  "$SOURCE_SVG"
