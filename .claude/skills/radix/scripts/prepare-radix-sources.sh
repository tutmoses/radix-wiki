#!/usr/bin/env sh

set -eu

repos_dir=".repos"

log() {
  printf "%s\n" "$*" >&2
}

ensure_git_available() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi

  log "error: git was not found; install git or clone the Radix source repos manually"
  log "required commands:"
  log "  git clone https://github.com/xstelea/radix-web3.js .repos/radix-web3.js"
  log "  git clone https://github.com/radixdlt/radixdlt-scrypto .repos/radixdlt-scrypto"
  exit 1
}

remote_matches_expected() {
  remote_url="$1"
  repo_slug="$2"

  case "$remote_url" in
    "https://github.com/$repo_slug" | \
    "https://github.com/$repo_slug.git" | \
    "git@github.com:$repo_slug.git" | \
    "ssh://git@github.com/$repo_slug.git")
      return 0
      ;;
  esac

  return 1
}

ensure_expected_remote() {
  repo_dir="$1"
  repo_url="$2"
  repo_slug="$3"

  ensure_git_available
  remote_url="$(git -C "$repo_dir" config --get remote.origin.url || true)"

  if [ -z "$remote_url" ]; then
    log "error: $repo_dir is a git checkout but has no remote.origin.url"
    log "expected a clone of $repo_url"
    exit 1
  fi

  if ! remote_matches_expected "$remote_url" "$repo_slug"; then
    log "error: $repo_dir points at unexpected origin: $remote_url"
    log "expected a clone of $repo_url"
    exit 1
  fi
}

ensure_clone() {
  repo_name="$1"
  repo_url="$2"
  repo_slug="$3"
  repo_dir="$repos_dir/$repo_name"

  if [ -d "$repo_dir/.git" ]; then
    ensure_expected_remote "$repo_dir" "$repo_url" "$repo_slug"
    log "using existing checkout: $repo_dir"
    return 0
  fi

  if [ -e "$repo_dir" ]; then
    log "error: $repo_dir exists but is not a git checkout"
    log "remove it or replace it with a clone of $repo_url"
    exit 1
  fi

  ensure_git_available
  mkdir -p "$repos_dir"
  log "cloning $repo_url into $repo_dir"
  git clone "$repo_url" "$repo_dir"
}

ensure_gitignore_entry() {
  entry="$1"

  if [ ! -f ".gitignore" ]; then
    printf "%s\n" "$entry" > ".gitignore"
    log "created .gitignore with $entry"
    return 0
  fi

  if grep -Fxq "$entry" ".gitignore"; then
    log ".gitignore already contains $entry"
    return 0
  fi

  printf "\n%s\n" "$entry" >> ".gitignore"
  log "added $entry to .gitignore"
}

ensure_rdx_cli() {
  if command -v rdx >/dev/null 2>&1; then
    log "rdx binary already available"
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    log "error: npm was not found; install npm or install rdx-cli manually"
    log "required command: npm install -g rdx-cli"
    exit 1
  fi

  log "installing rdx-cli globally"
  npm install -g rdx-cli

  if ! command -v rdx >/dev/null 2>&1; then
    log "error: rdx-cli installed, but rdx is still not on PATH"
    exit 1
  fi

  log "rdx binary available"
}

ensure_clone "radix-web3.js" "https://github.com/xstelea/radix-web3.js" "xstelea/radix-web3.js"
ensure_clone "radixdlt-scrypto" "https://github.com/radixdlt/radixdlt-scrypto" "radixdlt/radixdlt-scrypto"

ensure_gitignore_entry ".repos/radix-web3.js"
ensure_gitignore_entry ".repos/radixdlt-scrypto"

ensure_rdx_cli
