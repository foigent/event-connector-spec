#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  echo "usage: run-source-neutral-v2-release-kit.sh <protocol-root> <temporary-directory> [--content-candidate]" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
assembly_mode="${3:---release}"
if [[ "$assembly_mode" != "--release" && "$assembly_mode" != "--content-candidate" ]]; then
  echo "unsupported release-kit mode: $assembly_mode" >&2
  exit 2
fi
mkdir -p \
  "$kit_tmp/v1.1.2-predecessor" \
  "$kit_tmp/v2.0.0-predecessor" \
  "$kit_tmp/v2.0.1-predecessor" \
  "$kit_tmp/current"

if [[ "$(git -C "$protocol_root" rev-parse --is-inside-work-tree)" != "true" ]]; then
  echo "Authority Release Kit requires a real protocol authority Git checkout" >&2
  exit 1
fi

"$protocol_root/scripts/run-v1.1.2-predecessor-kit.sh" \
  "$protocol_root" "$kit_tmp/v1.1.2-predecessor"
"$protocol_root/scripts/run-v2.0.0-predecessor-kit.sh" \
  "$protocol_root" "$kit_tmp/v2.0.0-predecessor"
"$protocol_root/scripts/run-v2.0.1-predecessor-kit.sh" \
  "$protocol_root" "$kit_tmp/v2.0.1-predecessor"

"$protocol_root/scripts/run-source-neutral-v2-current-release-kit.sh" \
  "$protocol_root" \
  "$kit_tmp/current" \
  "$assembly_mode"

echo "Foigent Source-Neutral Connector Protocol Authority Release Kit: pass"
