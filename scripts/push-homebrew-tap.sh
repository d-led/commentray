#!/usr/bin/env bash
set -euo pipefail
# Clone d-led/homebrew-d-led, regenerate commentray.rb from GitHub Release assets, commit, push.
# Intended for CI after binaries.yml attaches release assets. Exits 0 when HOMEBREW_TAP_PUSH_TOKEN is unset.
#
# Env:
#   HOMEBREW_TAP_PUSH_TOKEN — PAT with contents write on d-led/homebrew-d-led (unset = skip)
#   GITHUB_REF_NAME         — tag e.g. v0.2.0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -z "${HOMEBREW_TAP_PUSH_TOKEN:-}" ]; then
  echo "HOMEBREW_TAP_PUSH_TOKEN unset; skipping Homebrew tap update."
  exit 0
fi

if [ -z "${GITHUB_REF_NAME:-}" ] || [[ "${GITHUB_REF_NAME}" != v* ]]; then
  echo "GITHUB_REF_NAME must be set to a v* tag (got: ${GITHUB_REF_NAME:-})" >&2
  exit 1
fi

TMP="${RUNNER_TEMP:-/tmp}/homebrew-d-led-$$"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

git clone --depth 1 "https://x-access-token:${HOMEBREW_TAP_PUSH_TOKEN}@github.com/d-led/homebrew-d-led.git" "${TMP}"

node scripts/generate-homebrew-formula.mjs --output "${TMP}/commentray.rb"

cd "${TMP}"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add commentray.rb
if git diff --staged --quiet; then
  echo "No formula changes to commit."
  exit 0
fi

git commit -m "commentray ${GITHUB_REF_NAME}"
git push origin HEAD:main
