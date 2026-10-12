#!/usr/bin/env bash
set -euo pipefail
cargo_version="$(cargo --version 2>&1 || true)"
if [[ "$cargo_version" == rustup-init* ]]; then
  rustup_init="$(command -v rustup-init || command -v cargo)"
  "$rustup_init" -y --default-toolchain none --profile minimal
  echo "$HOME/.cargo/bin" >> "$GITHUB_PATH"
fi
cargo --version
rustc --version
