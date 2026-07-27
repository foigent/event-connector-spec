#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-conformance-kit.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
kit_tmp="$2"
mkdir -p "$kit_tmp/go-cache" "$kit_tmp/deno"

node "$protocol_root/scripts/build-implementation-manifests.mjs" --check
node "$protocol_root/scripts/verify-candidate.mjs"
python3 -m unittest discover -s "$protocol_root/tests" -p 'test_*.py'

(
  cd "$protocol_root/tools/schema-audit"
  GOCACHE="$kit_tmp/go-cache" GOPROXY=off \
    go run -mod=vendor . "$protocol_root"
)

(
  cd "$protocol_root/implementations/go"
  GOCACHE="$kit_tmp/go-cache" GOPROXY=off \
    go test -mod=vendor -count=1 ./...
  GOCACHE="$kit_tmp/go-cache" GOPROXY=off \
    go vet -mod=vendor ./...
  GOCACHE="$kit_tmp/go-cache" GOPROXY=off \
    go build -mod=vendor -trimpath -ldflags=-buildid= \
    -o "$kit_tmp/foigent-conformance-go" \
    ./cmd/foigent-conformance-go
)

"$kit_tmp/foigent-conformance-go" \
  --bundle "$protocol_root/vectors/canonical-vector-bundle.v1.json" \
  --report "$kit_tmp/go-v1.json"

(
  cd "$protocol_root/implementations/typescript"
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task typecheck
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task test
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" deno task build
)

DENO_NO_UPDATE_CHECK=1 DENO_DIR="$kit_tmp/deno" \
  deno run --quiet --allow-read --allow-write \
  "$protocol_root/implementations/typescript/src/runner.ts" \
  --bundle "$protocol_root/vectors/canonical-vector-bundle.v1.json" \
  --report "$kit_tmp/typescript-v1.json"

cmp "$kit_tmp/go-v1.json" \
  "$protocol_root/conformance/reports/go-v1.json"
cmp "$kit_tmp/typescript-v1.json" \
  "$protocol_root/conformance/reports/typescript-v1.json"
node "$protocol_root/scripts/compare-conformance.mjs" \
  "$kit_tmp/go-v1.json" "$kit_tmp/typescript-v1.json"
node "$protocol_root/scripts/build-release-manifest.mjs" --check

echo "Foigent Event Connector Conformance Kit: pass"
