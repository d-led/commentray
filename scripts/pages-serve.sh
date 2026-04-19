#!/usr/bin/env bash
set -euo pipefail
# Back-compat entry: same as `scripts/serve.sh`.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/serve.sh" "$@"
