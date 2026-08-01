#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  echo "usage: run-source-neutral-v2-action-snapshot-kit.sh <protocol-root> <temporary-directory> [--content-candidate]" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
assembly_mode="${3:---release}"
if [[ "$assembly_mode" != "--release" && "$assembly_mode" != "--content-candidate" ]]; then
  echo "unsupported snapshot-kit mode: $assembly_mode" >&2
  exit 2
fi

if [[ -e "$kit_tmp/archive" || -e "$kit_tmp/action-snapshot.tar" ]]; then
  echo "snapshot-kit temporary path already exists" >&2
  exit 1
fi

mkdir -p "$kit_tmp/archive" "$kit_tmp/conformance"
git -C "$protocol_root" archive \
  --format=tar \
  --output="$kit_tmp/action-snapshot.tar" \
  HEAD
tar -xf "$kit_tmp/action-snapshot.tar" -C "$kit_tmp/archive"

if [[ -e "$kit_tmp/archive/.git" ]]; then
  echo "action snapshot unexpectedly contains Git metadata" >&2
  exit 1
fi
if ! grep -Fq \
  'run-source-neutral-v2-consumer-kit.sh' \
  "$kit_tmp/archive/actions/source-neutral-v2/action.yml"; then
  echo "composite action does not invoke the Consumer Conformance Kit" >&2
  exit 1
fi
if grep -Fq \
  'run-source-neutral-v2-release-kit.sh' \
  "$kit_tmp/archive/actions/source-neutral-v2/action.yml"; then
  echo "composite action invokes the Authority Release Kit" >&2
  exit 1
fi

"$kit_tmp/archive/scripts/run-source-neutral-v2-consumer-kit.sh" \
  "$kit_tmp/archive" \
  "$kit_tmp/conformance" \
  "$assembly_mode"

echo "Foigent source-neutral composite-action snapshot portability: pass"
