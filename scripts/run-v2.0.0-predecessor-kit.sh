#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-v2.0.0-predecessor-kit.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
expected_commit="a8ab25ef8c8dd1c12d073ec0cf23c376f5741744"
expected_tree="981e2516154610c172c6a1607795512ad9c69f30"

actual_commit="$(git -C "$protocol_root" rev-parse v2.0.0^{commit})"
actual_tree="$(git -C "$protocol_root" rev-parse v2.0.0^{}^{tree})"
if [[ "$actual_commit" != "$expected_commit" ]]; then
  echo "v2.0.0 tag commit mismatch" >&2
  exit 1
fi
if [[ "$actual_tree" != "$expected_tree" ]]; then
  echo "v2.0.0 tag tree mismatch" >&2
  exit 1
fi

mkdir -p "$kit_tmp/archive" "$kit_tmp/conformance"
git -C "$protocol_root" archive \
  --format=tar \
  --output="$kit_tmp/v2.0.0.tar" \
  v2.0.0
tar -xf "$kit_tmp/v2.0.0.tar" -C "$kit_tmp/archive"
cmp \
  "$protocol_root/releases/v2.0.0/release-manifest.json" \
  "$kit_tmp/archive/releases/v2.0.0/release-manifest.json"
"$kit_tmp/archive/scripts/run-source-neutral-v2-release-kit.sh" \
  "$kit_tmp/archive" \
  "$kit_tmp/conformance"

echo "Foigent immutable v2.0.0 predecessor kit: pass"
