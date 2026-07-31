#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-source-neutral-v2-release-kit.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
mkdir -p \
  "$kit_tmp/go-cache" \
  "$kit_tmp/go-path" \
  "$kit_tmp/deno"

node "$protocol_root/scripts/build-source-neutral-v2-artifacts.mjs" --check
node \
  "$protocol_root/scripts/build-source-neutral-v2-implementation-manifests.mjs" \
  --check
python3 "$protocol_root/scripts/validate_source_neutral_v2_release.py"
(
  cd "$protocol_root"
  python3 -m unittest \
    tests.test_source_neutral_v2_candidate \
    tests.test_source_neutral_v2_release
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
node \
  "$protocol_root/scripts/build-source-neutral-v2-release-manifest.mjs" \
  --check

echo "Foigent Source-Neutral Connector Protocol v2.0.0 Release Kit: pass"
