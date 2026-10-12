#!/usr/bin/env bash
set -euo pipefail
log_path="$1"
shift
mkdir -p "$(dirname "$log_path")"
"$@" 2>&1 | tee "$log_path"
