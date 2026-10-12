#!/usr/bin/env bash
set -euo pipefail
for apt_source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
  if [ -f "$apt_source" ]; then
    sudo sed -i 's|azure.archive.ubuntu.com|archive.ubuntu.com|g' "$apt_source"
  fi
done
apt_options=(-o Acquire::Retries=3 -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20)
if ! timeout 300s sudo apt-get update "${apt_options[@]}"; then
  for apt_source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
    if [ -f "$apt_source" ]; then
      sudo sed -i 's|archive.ubuntu.com/ubuntu|mirror.math.princeton.edu/pub/ubuntu|g' "$apt_source"
    fi
  done
  timeout 300s sudo apt-get update "${apt_options[@]}"
fi
read -r -a tauri_deps <<< "$TAURI_SYSTEM_DEPS"
timeout 300s sudo apt-get install -y --no-install-recommends "${apt_options[@]}" "${tauri_deps[@]}"
