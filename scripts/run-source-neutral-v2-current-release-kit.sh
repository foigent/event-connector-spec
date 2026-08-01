#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  echo "usage: run-source-neutral-v2-current-release-kit.sh <protocol-root> <temporary-directory> [--release|--content-candidate]" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
assembly_mode="${3:---release}"
if [[ "$assembly_mode" != "--release" && "$assembly_mode" != "--content-candidate" ]]; then
  echo "unsupported current-release-kit mode: $assembly_mode" >&2
  exit 2
fi

candidate_builder="$protocol_root/scripts/build-source-neutral-v2-candidate-manifest.mjs"
release_validator="$protocol_root/scripts/validate_source_neutral_v2_release.py"
if [[ -f "$protocol_root/scripts/build-source-neutral-v2.0.2-candidate-manifest.mjs" ]]; then
  candidate_builder="$protocol_root/scripts/build-source-neutral-v2.0.2-candidate-manifest.mjs"
fi
if [[ -f "$protocol_root/scripts/validate_source_neutral_v2_0_2_candidate.py" ]]; then
  release_validator="$protocol_root/scripts/validate_source_neutral_v2_0_2_candidate.py"
fi

mkdir -p \
  "$kit_tmp/v1-compatibility" \
  "$kit_tmp/go-cache" \
  "$kit_tmp/go-path" \
  "$kit_tmp/deno"

if [[ -f "$protocol_root/scripts/validate_source_neutral_v2_0_2_candidate.py" ]]; then
  "$protocol_root/scripts/run-v1-compatibility-current-kit.sh" \
    "$protocol_root" "$kit_tmp/v1-compatibility"
else
  "$protocol_root/scripts/run-v1-compatibility-kit.sh" \
    "$protocol_root" "$kit_tmp/v1-compatibility"
fi

node "$protocol_root/scripts/build-source-neutral-v2-artifacts.mjs" --check
node \
  "$protocol_root/scripts/build-source-neutral-v2-implementation-manifests.mjs" \
  --check
node "$candidate_builder" --check

if [[ "$assembly_mode" == "--release" ]]; then
  node \
    "$protocol_root/scripts/build-source-neutral-v2-release-manifest.mjs" \
    --check
fi

python3 "$release_validator"
if [[ -f "$protocol_root/tests/test_source_neutral_v2_0_2_candidate.py" ]]; then
  python_tests=(
    tests.test_source_neutral_v2_action_portability
    tests.test_source_neutral_v2_0_2_candidate
  )
else
  python_tests=(
    tests.test_source_neutral_v2_candidate
    tests.test_source_neutral_v2_release
  )
fi
(
  cd "$protocol_root"
  python3 -m unittest "${python_tests[@]}"
)

"$protocol_root/tools/schema-audit-v2/run.sh" \
  "$protocol_root" "$kit_tmp/go-cache"

(
  cd "$protocol_root/implementations/source-neutral-v2/go"
  GOCACHE="$kit_tmp/go-cache" GOPATH="$kit_tmp/go-path" GOPROXY=off \
    go test -mod=vendor -count=1 ./...
  GOCACHE="$kit_tmp/go-cache" GOPATH="$kit_tmp/go-path" GOPROXY=off \
    go vet -mod=vendor ./...
  GOCACHE="$kit_tmp/go-cache" GOPATH="$kit_tmp/go-path" GOPROXY=off \
    go build -mod=vendor -trimpath -ldflags=-buildid= \
    -o "$kit_tmp/foigent-source-neutral-conformance-go" \
    ./cmd/foigent-source-neutral-conformance-go
)

"$kit_tmp/foigent-source-neutral-conformance-go" \
  --bundle "$protocol_root/vectors/source-neutral-vector-bundle.v2.json" \
  --report "$kit_tmp/go-source-neutral-v2-a.json"
"$kit_tmp/foigent-source-neutral-conformance-go" \
  --bundle "$protocol_root/vectors/source-neutral-vector-bundle.v2.json" \
  --report "$kit_tmp/go-source-neutral-v2-b.json"
cmp \
  "$kit_tmp/go-source-neutral-v2-a.json" \
  "$kit_tmp/go-source-neutral-v2-b.json"
cmp \
  "$kit_tmp/go-source-neutral-v2-a.json" \
  "$protocol_root/conformance/reports/go-source-neutral-v2.json"

(
  cd "$protocol_root/implementations/source-neutral-v2/typescript"
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task typecheck
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task test
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task build
)

DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" \
  deno run --quiet --allow-read --allow-write --no-remote --no-npm \
  "$protocol_root/implementations/source-neutral-v2/typescript/src/runner.ts" \
  --bundle "$protocol_root/vectors/source-neutral-vector-bundle.v2.json" \
  --report "$kit_tmp/typescript-source-neutral-v2-a.json"
DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" \
  deno run --quiet --allow-read --allow-write --no-remote --no-npm \
  "$protocol_root/implementations/source-neutral-v2/typescript/src/runner.ts" \
  --bundle "$protocol_root/vectors/source-neutral-vector-bundle.v2.json" \
  --report "$kit_tmp/typescript-source-neutral-v2-b.json"
cmp \
  "$kit_tmp/typescript-source-neutral-v2-a.json" \
  "$kit_tmp/typescript-source-neutral-v2-b.json"
cmp \
  "$kit_tmp/typescript-source-neutral-v2-a.json" \
  "$protocol_root/conformance/reports/typescript-source-neutral-v2.json"

node "$protocol_root/scripts/compare-source-neutral-conformance.mjs" \
  "$kit_tmp/go-source-neutral-v2-a.json" \
  "$kit_tmp/typescript-source-neutral-v2-a.json"

if [[ "$assembly_mode" == "--content-candidate" ]]; then
  node "$protocol_root/scripts/build-source-neutral-v2-release-manifest.mjs" \
    --content-digest > "$kit_tmp/content-digest-a.txt"
  node "$protocol_root/scripts/build-source-neutral-v2-release-manifest.mjs" \
    --content-digest > "$kit_tmp/content-digest-b.txt"
  cmp "$kit_tmp/content-digest-a.txt" "$kit_tmp/content-digest-b.txt"
  echo "Foigent Source-Neutral Connector Protocol release content candidate: pass"
  cat "$kit_tmp/content-digest-a.txt"
  exit 0
fi

echo "Foigent Source-Neutral Connector Protocol current release: pass"
