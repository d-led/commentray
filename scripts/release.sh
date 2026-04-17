#!/usr/bin/env bash
set -euo pipefail

# One-command release: bump version, push tag (so CI builds binaries),
# publish every public package to npm.
#
# Usage:
#   bash scripts/release.sh patch                 # standard patch release
#   bash scripts/release.sh minor
#   bash scripts/release.sh major
#   bash scripts/release.sh rc                    # -> x.y.z-rc.N under 'next' tag
#   bash scripts/release.sh release               # drop -rc suffix
#   bash scripts/release.sh set 1.2.3             # explicit version
#   bash scripts/release.sh patch --dry-run       # rehearse everything
#   bash scripts/release.sh patch --no-publish    # bump + push only (skip npm)
#   bash scripts/release.sh patch --no-push       # bump + publish only (skip CI trigger)
#
# Exits early with clear errors on any step. Safe to rerun after fixing
# the failing step — each underlying script is idempotent on clean input.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'
log_step() { printf "\n%s== %s ==%s\n" "$YELLOW" "$1" "$NC"; }
log_ok()   { printf "%s[OK]%s %s\n"    "$GREEN"  "$NC" "$1"; }

dry_run=false
do_push=true
do_publish=true
bump_args=()
set_version=""

if [[ $# -lt 1 ]]; then
  sed -n '3,18p' "$0" >&2
  exit 2
fi

bump_command="$1"; shift
bump_args+=("$bump_command")
if [[ "$bump_command" == "set" ]]; then
  if [[ $# -lt 1 ]]; then
    echo "release.sh: 'set' requires an explicit version argument." >&2
    exit 2
  fi
  set_version="$1"; shift
  bump_args+=("$set_version")
fi

for a in "$@"; do
  case "$a" in
    --dry-run)    dry_run=true ;;
    --no-push)    do_push=false ;;
    --no-publish) do_publish=false ;;
    *) echo "release.sh: unknown flag: $a" >&2; exit 2 ;;
  esac
done

log_step "Step 1/3: bump version"
if [[ "$dry_run" == true ]]; then
  bash scripts/bump-version.sh "${bump_args[@]}" --dry-run
else
  bash scripts/bump-version.sh "${bump_args[@]}"
fi

if [[ "$dry_run" == true ]]; then
  log_step "Step 2/3: git push (dry run — skipped)"
  log_step "Step 3/3: npm publish (dry run — would run publish.sh --dry-run)"
  bash scripts/publish.sh --dry-run || true
  echo ""
  log_ok "Dry run complete. Nothing was committed, pushed, or published."
  exit 0
fi

if [[ "$do_push" == true ]]; then
  log_step "Step 2/3: git push (branch + tags)"
  git push
  git push --tags
  log_ok "Pushed. Binary-build workflow will trigger on the tag."
else
  log_step "Step 2/3: git push (skipped via --no-push)"
fi

if [[ "$do_publish" == true ]]; then
  log_step "Step 3/3: npm publish"
  tag_flag=()
  case "$bump_command" in
    rc) tag_flag=(--tag=next) ;;
  esac
  bash scripts/publish.sh "${tag_flag[@]}"
else
  log_step "Step 3/3: npm publish (skipped via --no-publish)"
fi

echo ""
log_ok "Release done."
