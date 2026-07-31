#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run.sh <protocol-root> <go-cache>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
go_cache="$2"

(
  cd "$protocol_root/tools/schema-audit"
  GOCACHE="$go_cache" GOPROXY=off \
    go run -mod=vendor \
    -overlay=../schema-audit-v2/overlay.json \
    . "$protocol_root"
)
