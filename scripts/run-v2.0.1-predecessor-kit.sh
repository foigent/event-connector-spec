#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-v2.0.1-predecessor-kit.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
expected_commit="0cbb6417858d12d6a99ff3b517bd59a122bc7e2c"
expected_tree="f967929dd98c5f34cd42fce4aa21489b72b000e0"
expected_tag_object="c24531c24955bc700133387dd7352a88e5ba82be"
expected_manifest_sha="fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60"

actual_tag_object="$(git -C "$protocol_root" rev-parse v2.0.1)"
actual_commit="$(git -C "$protocol_root" rev-parse v2.0.1^{commit})"
actual_tree="$(git -C "$protocol_root" rev-parse v2.0.1^{}^{tree})"
if [[ "$actual_tag_object" != "$expected_tag_object" ]]; then
  echo "v2.0.1 tag object mismatch" >&2
  exit 1
fi
if [[ "$actual_commit" != "$expected_commit" ]]; then
  echo "v2.0.1 tag commit mismatch" >&2
  exit 1
fi
if [[ "$actual_tree" != "$expected_tree" ]]; then
  echo "v2.0.1 tag tree mismatch" >&2
  exit 1
fi

mkdir -p "$kit_tmp/archive" "$kit_tmp/conformance"
git -C "$protocol_root" archive \
  --format=tar \
  --output="$kit_tmp/v2.0.1.tar" \
  v2.0.1
tar -xf "$kit_tmp/v2.0.1.tar" -C "$kit_tmp/archive"
cmp \
  "$protocol_root/releases/v2.0.1/release-manifest.json" \
  "$kit_tmp/archive/releases/v2.0.1/release-manifest.json"
if [[ -e "$kit_tmp/archive/.git" ]]; then
  echo "v2.0.1 archive unexpectedly contains Git metadata" >&2
  exit 1
fi
actual_manifest_sha="$(shasum -a 256 "$kit_tmp/archive/releases/v2.0.1/release-manifest.json" | awk '{print $1}')"
if [[ "$actual_manifest_sha" != "$expected_manifest_sha" ]]; then
  echo "v2.0.1 release manifest digest mismatch" >&2
  exit 1
fi

"$protocol_root/scripts/run-source-neutral-v2-current-release-kit.sh" \
  "$kit_tmp/archive" \
  "$kit_tmp/conformance" \
  --release

echo "Foigent immutable v2.0.1 predecessor kit: pass"
