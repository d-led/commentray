#!/usr/bin/env bash
set -euo pipefail

# One-command release: bump version files, commit, tag, push (so CI builds
# binaries), publish every public package to npm.
#
# Usage:
#   bash scripts/release.sh patch                 # standard patch release
#   bash scripts/release.sh minor
#   bash scripts/release.sh major
#   bash scripts/release.sh rc                    # -> x.y.z-rc.N under 'next' tag
#   bash scripts/release.sh release               # drop -rc suffix
#   bash scripts/release.sh set 1.2.3             # explicit version
#   bash scripts/release.sh patch --dry-run       # rehearse everything
#   bash scripts/release.sh patch --no-publish    # bump + commit + tag + push only (skip npm)
#   bash scripts/release.sh patch --no-push       # bump + commit + tag + publish only (skip CI trigger)
#
# Requires a clean working tree before the first step: this script commits
# the bump output then creates v<version>. For bump-only (no commit/tag) on a
# dirty tree, use scripts/bump-version.sh alone, then commit and
# scripts/tag-version.sh.
#
# Exits early with clear errors on any step.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'
log_step()  { printf "\n%s== %s ==%s\n" "$YELLOW" "$1" "$NC"; }
log_ok()    { printf "%s[OK]%s %s\n"    "$GREEN"  "$NC" "$1"; }
log_error() { printf "%s[ERROR]%s %s\n" "$RED"    "$NC" "$1" >&2; }

dry_run=false
do_push=true
do_publish=true
bump_args=()
set_version=""

if [[ $# -lt 1 ]]; then
  sed -n '3,21p' "$0" >&2
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

if [[ "$dry_run" != true ]]; then
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    log_error "Not inside a git repository."
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log_error "Uncommitted changes present. Commit or stash first — release.sh will commit the version bump."
    exit 1
  fi
fi

log_step "Step 1/4: bump version (files only)"
if [[ "$dry_run" == true ]]; then
  bash scripts/bump-version.sh "${bump_args[@]}" --dry-run
else
  bash scripts/bump-version.sh "${bump_args[@]}"
fi

if [[ "$dry_run" == true ]]; then
  log_step "Step 2/4: commit + tag (dry run — skipped)"
  log_step "Step 3/4: git push (dry run — skipped)"
  log_step "Step 4/4: npm publish (dry run — would run publish.sh --dry-run)"
  bash scripts/publish.sh --dry-run || true
  echo ""
  log_ok "Dry run complete. Nothing was bumped, committed, tagged, pushed, or published."
  exit 0
fi

new_version=$(node -e "process.stdout.write(require('./packages/core/package.json').version)")
release_tag="v$new_version"
if git rev-parse --verify --quiet "$release_tag" >/dev/null; then
  log_error "Tag $release_tag already exists. Remove it or choose a different bump."
  exit 1
fi

log_step "Step 2/4: commit + annotated tag"
git add -A
git commit -m "Bump version to $new_version"
git tag -a "$release_tag" -m "Version $new_version"
log_ok "Committed and created tag $release_tag"

if [[ "$do_push" == true ]]; then
  log_step "Step 3/4: git push (branch + tags)"
  git push
  git push --tags
  log_ok "Pushed. The binaries workflow will build standalone CLIs, package the VS Code extension (.vsix), and attach them to the GitHub release for the tag."
else
  log_step "Step 3/4: git push (skipped via --no-push)"
fi

if [[ "$do_publish" == true ]]; then
  log_step "Step 4/4: npm publish"
  tag_flag=()
  case "$bump_command" in
    rc) tag_flag=(--tag=next) ;;
  esac
  bash scripts/publish.sh "${tag_flag[@]}"
else
  log_step "Step 4/4: npm publish (skipped via --no-publish)"
fi

echo ""
log_ok "Release done."
