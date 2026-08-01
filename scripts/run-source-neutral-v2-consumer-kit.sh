#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  echo "usage: run-source-neutral-v2-consumer-kit.sh <protocol-root> <temporary-directory> [--release|--content-candidate]" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
assembly_mode="${3:---release}"
"$protocol_root/scripts/run-source-neutral-v2-current-release-kit.sh" \
  "$protocol_root" \
  "$kit_tmp/current-release" \
  "$assembly_mode"

echo "Foigent Source-Neutral Connector Protocol Consumer Conformance Kit: pass"
