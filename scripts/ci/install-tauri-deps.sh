#!/usr/bin/env bash
# Install the Tauri Linux system dependencies listed in $TAURI_SYSTEM_DEPS.
#
# Usage: install-tauri-deps.sh [plan|install]
#   plan     Refresh the apt lists and write the exact .deb set this install
#            needs as a cache key to $GITHUB_OUTPUT (deb-key, image).
#   install  Install the packages. When $TAURI_APT_ARCHIVE_DIR is set, apt
#            reuses the .deb files restored there and only downloads what is
#            missing, so a warm cache never waits on the Ubuntu mirror.
#   (none)   Refresh the lists, then install (plan + install without a key).
#
# .github/actions/setup-tauri-linux-deps wires plan/install around
# actions/cache. apt still verifies every reused .deb against the signed
# package lists, so a restored archive cannot change what gets installed.
set -euo pipefail
mode="${1:-all}"
apt_options=(-o Acquire::Retries=3 -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20)
read -r -a tauri_deps <<< "$TAURI_SYSTEM_DEPS"
apt_sources=(/etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources /etc/apt/apt-mirrors.txt)

refresh_lists() {
  for apt_source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
    if [ -f "$apt_source" ]; then
      sudo sed -i 's|azure.archive.ubuntu.com|archive.ubuntu.com|g' "$apt_source"
    fi
  done
  if ! timeout 300s sudo apt-get update "${apt_options[@]}"; then
    switch_to_fallback_mirror
    timeout 300s sudo apt-get update "${apt_options[@]}"
  fi
}

# ubuntu-24.04 runners list their primary mirror in /etc/apt/apt-mirrors.txt
# rather than ubuntu.sources, so rewrite every place a mirror can live.
switch_to_fallback_mirror() {
  for apt_source in "${apt_sources[@]}"; do
    if [ -f "$apt_source" ]; then
      sudo sed -i -E 's#(azure\.)?archive\.ubuntu\.com/ubuntu#mirror.math.princeton.edu/pub/ubuntu#g' "$apt_source"
    fi
  done
}

plan() {
  refresh_lists
  # --print-uris resolves the full dependency closure without installing.
  # Each line names one .deb with its exact version and checksum, so the hash
  # changes only when Ubuntu publishes a new build of something we install.
  # An empty archive dir makes apt list every .deb, not just ones it has.
  local empty_archive uris
  empty_archive="$(mktemp -d)"
  mkdir -p "$empty_archive/partial"
  uris="$(sudo apt-get install -y --no-install-recommends --print-uris -qq \
    -o "Dir::Cache::Archives=$empty_archive" "${tauri_deps[@]}")"
  rm -rf "$empty_archive"
  printf '%s\n' "$uris" | awk '{print $2}' | sort > "${RUNNER_TEMP:-/tmp}/tauri-apt-debs.txt"
  local deb_key
  deb_key="$(printf '%s\n' "$uris" | awk '{print $2, $4}' | sort | sha256sum | cut -c1-16)"
  echo "planned $(wc -l < "${RUNNER_TEMP:-/tmp}/tauri-apt-debs.txt") .deb files, key ${deb_key}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "deb-key=${deb_key}" >> "$GITHUB_OUTPUT"
    echo "image=${ImageOS:-unknown}" >> "$GITHUB_OUTPUT"
  fi
}

install() {
  if [ -n "${TAURI_APT_ARCHIVE_DIR:-}" ]; then
    mkdir -p "$TAURI_APT_ARCHIVE_DIR"
    sudo mkdir -p "$TAURI_APT_ARCHIVE_DIR/partial"
    # apt downloads as the unprivileged _apt user into partial/.
    if id _apt > /dev/null 2>&1; then
      sudo chown _apt "$TAURI_APT_ARCHIVE_DIR/partial"
    fi
    apt_options+=(-o "Dir::Cache::Archives=$TAURI_APT_ARCHIVE_DIR")
    echo "reusing $(find "$TAURI_APT_ARCHIVE_DIR" -maxdepth 1 -name '*.deb' | wc -l) cached .deb files"
  fi
  local status=0
  timeout 300s sudo apt-get install -y --no-install-recommends "${apt_options[@]}" "${tauri_deps[@]}" || status=$?
  if [ "$status" -eq 124 ]; then
    # A stalled mirror is the common failure: retry once from the fallback.
    # Files apt already fetched stay in the archive dir, so this resumes.
    echo "::warning::apt-get install timed out; retrying from the fallback mirror"
    switch_to_fallback_mirror
    timeout 300s sudo apt-get update "${apt_options[@]}"
    timeout 300s sudo apt-get install -y --no-install-recommends "${apt_options[@]}" "${tauri_deps[@]}"
  elif [ "$status" -ne 0 ]; then
    exit "$status"
  fi
  if [ -n "${TAURI_APT_ARCHIVE_DIR:-}" ]; then
    # Keep only the .debs this plan needs so the cache never accumulates
    # superseded versions, and hand the dir back to the runner user so
    # actions/cache can archive it.
    sudo rm -rf "$TAURI_APT_ARCHIVE_DIR/partial" "$TAURI_APT_ARCHIVE_DIR/lock"
    local plan_file="${RUNNER_TEMP:-/tmp}/tauri-apt-debs.txt"
    if [ -s "$plan_file" ]; then
      find "$TAURI_APT_ARCHIVE_DIR" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort \
        | comm -23 - "$plan_file" | while read -r stale; do sudo rm -f "$TAURI_APT_ARCHIVE_DIR/$stale"; done
    fi
    sudo chown -R "$(id -u):$(id -g)" "$TAURI_APT_ARCHIVE_DIR"
  fi
}

case "$mode" in
  plan) plan ;;
  install) install ;;
  all)
    refresh_lists
    install
    ;;
  *)
    echo "usage: $0 [plan|install]" >&2
    exit 2
    ;;
esac
