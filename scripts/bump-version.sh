#!/usr/bin/env bash
set -euo pipefail

# Bump the version of every Commentray workspace package in lockstep,
# sync intra-workspace @commentray/* dep pins, and update CHANGELOG.md if it
# exists. Does not run git: no commit, no tag. Use when you want to edit
# versions alongside other work, then commit when ready.
#
# Tagging is separate: `bash scripts/tag-version.sh` after committing, or
# `bash scripts/release.sh …` for bump + commit + tag + push + publish.
#
# Usage:
#   bash scripts/bump-version.sh patch                  # 0.1.2 -> 0.1.3
#   bash scripts/bump-version.sh minor                  # 0.1.2 -> 0.2.0
#   bash scripts/bump-version.sh major                  # 0.1.2 -> 1.0.0
#   bash scripts/bump-version.sh rc                     # x.y.z -> x.y.(z+1)-rc.0
#                                                       # or x.y.z-rc.N -> x.y.z-rc.(N+1)
#   bash scripts/bump-version.sh release                # x.y.z-rc.N -> x.y.z
#   bash scripts/bump-version.sh set 1.2.3[-rc.0]       # set an explicit version
#   bash scripts/bump-version.sh <command> --dry-run    # preview only, no writes
#
# Next steps (pick one):
#   git add -A && git commit … && bash scripts/tag-version.sh
#   bash scripts/release.sh patch                       # clean tree required; does commit+tag
#   git push && git push --tags                         # after you tag
#   bash scripts/publish.sh                             # npm publish

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CANONICAL_PKG="packages/core/package.json"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'
log_info()  { printf "%s[INFO]%s %s\n" "$YELLOW" "$NC" "$1"; }
log_ok()    { printf "%s[OK]%s %s\n"   "$GREEN"  "$NC" "$1"; }
log_error() { printf "%s[ERROR]%s %s\n" "$RED"   "$NC" "$1" >&2; }

dry_run=false
args=()
for a in "$@"; do
  if [[ "$a" == "--dry-run" ]]; then
    dry_run=true
  else
    args+=("$a")
  fi
done
set -- "${args[@]:-}"

command="${1:-}"
if [[ -z "$command" ]]; then
  log_error "Missing command."
  sed -n '3,26p' "$0" >&2
  exit 2
fi

# Current version is whatever the canonical package.json says.
current=$(node -e "process.stdout.write(require('./$CANONICAL_PKG').version)")
echo "Current version: $current"

# semver regex matching x.y.z with optional -rc.N
if [[ $current =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-rc\.([0-9]+))?$ ]]; then
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"
  rc_num="${BASH_REMATCH[5]:-}"
else
  log_error "Could not parse current version '$current' (expected x.y.z or x.y.z-rc.N)."
  exit 1
fi

case "$command" in
  major)   new_version="$((major + 1)).0.0" ;;
  minor)   new_version="$major.$((minor + 1)).0" ;;
  patch)   new_version="$major.$minor.$((patch + 1))" ;;
  rc)
    if [[ -z "$rc_num" ]]; then
      new_version="$major.$minor.$((patch + 1))-rc.0"
    else
      new_version="$major.$minor.$patch-rc.$((rc_num + 1))"
    fi
    ;;
  release)
    if [[ -z "$rc_num" ]]; then
      log_error "Current version '$current' is not a release candidate."
      exit 1
    fi
    new_version="$major.$minor.$patch"
    ;;
  set)
    new_version="${2:-}"
    if [[ -z "$new_version" ]]; then
      log_error "'set' requires an explicit version argument."
      exit 2
    fi
    if [[ ! $new_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$ ]]; then
      log_error "Version '$new_version' must match x.y.z or x.y.z-rc.N."
      exit 1
    fi
    ;;
  *)
    log_error "Unknown command: $command"
    sed -n '3,26p' "$0" >&2
    exit 2
    ;;
esac

echo "New version:     $new_version"

if [[ "$dry_run" == true ]]; then
  echo ""
  echo "=== DRY RUN ==="
  echo "Would bump every workspace package.json ($current -> $new_version),"
  echo "sync @commentray/* deps, update CHANGELOG.md if present, and refresh"
  echo "package-lock.json. No git commit or tag."
  exit 0
fi

log_info "Bumping all workspace packages to $new_version..."
npm version "$new_version" --workspaces --no-git-tag-version --include-workspace-root=false >/dev/null

log_info "Syncing intra-workspace @commentray/* pins..."
node scripts/sync-workspace-deps.mjs

log_info "Refreshing package-lock.json..."
npm install --package-lock-only --no-audit --no-fund >/dev/null

changelog="CHANGELOG.md"
if [[ -f "$changelog" ]]; then
  today="$(date +%Y-%m-%d)"
  if grep -q "^## \[Unreleased\]" "$changelog"; then
    log_info "Inserting $new_version header into $changelog..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "/^## \[Unreleased\]/a\\
\\
## [$new_version] - $today
" "$changelog"
    else
      sed -i "/^## \[Unreleased\]/a\\
\n## [$new_version] - $today\n" "$changelog"
    fi
    log_ok "Updated $changelog"
  else
    log_info "No [Unreleased] section in $changelog; skipping."
  fi
fi

log_ok "Version files updated: $current -> $new_version (uncommitted)"

echo ""
echo "Next steps:"
echo "  1. Review the diff, then commit:"
echo "       git add -A && git commit -m \"Bump version to $new_version\""
echo "  2. Create the annotated tag:"
echo "       bash scripts/tag-version.sh"
echo "  3. Push and publish:"
echo "       git push && git push --tags"
echo "       bash scripts/publish.sh"
echo ""
echo "From a clean tree, an all-in-one alternative is:"
echo "       bash scripts/release.sh $command"
echo "       (runs this bump, then commit, tag, push, and publish.)"
if [[ $new_version =~ -rc\. ]]; then
  echo ""
  echo "(Pre-release: add '--tag next' to 'npm publish' if you want to keep"
  echo " 'latest' pointing at the current stable.)"
fi
