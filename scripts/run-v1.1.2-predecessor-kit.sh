#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-v1.1.2-predecessor-kit.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
expected_commit="fd82aeca9877bea8064b25c365a3cdcdd0bb3d16"
expected_tree="d316d6ada678066ed7679a772856aea6157d869d"

actual_commit="$(git -C "$protocol_root" rev-parse v1.1.2^{commit})"
actual_tree="$(git -C "$protocol_root" rev-parse v1.1.2^{}^{tree})"
if [[ "$actual_commit" != "$expected_commit" ]]; then
  echo "v1.1.2 tag commit mismatch" >&2
  exit 1
fi
if [[ "$actual_tree" != "$expected_tree" ]]; then
  echo "v1.1.2 tag tree mismatch" >&2
  exit 1
fi

mkdir -p "$kit_tmp/archive" "$kit_tmp/conformance"
git -C "$protocol_root" archive \
  --format=tar \
  --output="$kit_tmp/v1.1.2.tar" \
  v1.1.2
tar -xf "$kit_tmp/v1.1.2.tar" -C "$kit_tmp/archive"
cmp \
  "$protocol_root/releases/v1.1.2/release-manifest.json" \
  "$kit_tmp/archive/releases/v1.1.2/release-manifest.json"
"$kit_tmp/archive/scripts/run-conformance-kit.sh" \
  "$kit_tmp/archive" \
  "$kit_tmp/conformance"

echo "Foigent immutable v1.1.2 predecessor kit: pass"
