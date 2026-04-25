#!/usr/bin/env bash
set -euo pipefail

# Rebuild logo artifacts from the JPEG master:
#   docs/logos/2.jpg  →  docs/logos/2.png   (flat transparent PNG)
#   docs/logos/2.png  →  docs/logos/2.svg   (vector trace)
#   docs/logos/2.svg  →  packages/vscode/icon.png (VSIX / marketplace icon)
#
# Requires: Python 3 with Pillow + NumPy + Matplotlib, rsvg-convert (librsvg).
#
# Usage (from repo root):
#   bash scripts/refresh-logo-assets.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

JPG="$REPO_ROOT/docs/logos/2.jpg"
PNG="$REPO_ROOT/docs/logos/2.png"
SVG="$REPO_ROOT/docs/logos/2.svg"

if [[ ! -f "$JPG" ]]; then
  echo "Missing source JPEG: $JPG" >&2
  exit 1
fi

echo "==> Raster pipeline: $JPG -> $PNG"
python3 "$REPO_ROOT/docs/logos/scripts/jpg-to-clean-transparent-png.py" \
  --input "$JPG" \
  --output "$PNG"

echo "==> Vector trace: $PNG -> $SVG"
python3 "$REPO_ROOT/docs/logos/scripts/png-to-svg-trace.py" \
  --input "$PNG" \
  --output "$SVG"

echo "==> VS Code icon: $SVG -> packages/vscode/icon.png"
bash "$REPO_ROOT/scripts/build-vscode-icon.sh"

echo "Done. Updated: $PNG , $SVG , packages/vscode/icon.png"
