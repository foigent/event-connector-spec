#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: run-sdk-candidate.sh <protocol-root> <temporary-directory>" >&2
  exit 2
fi

protocol_root="$(cd "$1" && pwd -P)"
candidate_tmp="$2"
mkdir -p \
  "$candidate_tmp/current" \
  "$candidate_tmp/go-cache" \
  "$candidate_tmp/deno" \
  "$candidate_tmp/bin" \
  "$candidate_tmp/npm-a" \
  "$candidate_tmp/npm-b" \
  "$candidate_tmp/npm-cache-a" \
  "$candidate_tmp/npm-cache-b"

"$protocol_root/scripts/run-conformance-kit.sh" \
  "$protocol_root" \
  "$candidate_tmp/current"

(
  cd "$protocol_root/sdk/go"
  GOCACHE="$candidate_tmp/go-cache" GOPROXY=off \
    go test -mod=vendor -count=1 ./...
  GOCACHE="$candidate_tmp/go-cache" GOPROXY=off \
    go vet -mod=vendor ./...
  GOCACHE="$candidate_tmp/go-cache" GOPROXY=off \
    go build -mod=vendor -trimpath -ldflags=-buildid= \
    -o "$candidate_tmp/bin/foigent-sdk-conformance-go" \
    ./cmd/sdk-conformance
)

"$candidate_tmp/bin/foigent-sdk-conformance-go" \
  --protocol-root "$protocol_root" \
  --report "$candidate_tmp/go-sdk.json"

(
  cd "$protocol_root/sdk/typescript"
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$candidate_tmp/deno" deno task typecheck
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$candidate_tmp/deno" deno task test
  DENO_NO_UPDATE_CHECK=1 DENO_DIR="$candidate_tmp/deno" deno task build
)

DENO_NO_UPDATE_CHECK=1 DENO_DIR="$candidate_tmp/deno" \
  deno run --node-modules-dir=none --quiet --allow-read --allow-write \
  "$protocol_root/sdk/typescript/src/testkit/runner.ts" \
  --protocol-root "$protocol_root" \
  --report "$candidate_tmp/typescript-sdk.json"

(
  cd "$protocol_root/sdk/typescript"
  npm_config_cache="$candidate_tmp/npm-cache-a" \
    npm pack --ignore-scripts --pack-destination "$candidate_tmp/npm-a"
  npm_config_cache="$candidate_tmp/npm-cache-b" \
    npm pack --ignore-scripts --pack-destination "$candidate_tmp/npm-b"
)
cmp \
  "$candidate_tmp/npm-a/foigent-event-connector-sdk-0.1.0-candidate.1.tgz" \
  "$candidate_tmp/npm-b/foigent-event-connector-sdk-0.1.0-candidate.1.tgz"

cmp "$candidate_tmp/go-sdk.json" "$candidate_tmp/typescript-sdk.json"
node "$protocol_root/scripts/compare-sdk-candidate.mjs" \
  "$candidate_tmp/go-sdk.json" \
  "$candidate_tmp/typescript-sdk.json" \
  "$candidate_tmp/current/go-v1.json" \
  "$candidate_tmp/current/typescript-v1.json" \
  "$candidate_tmp/current/go-litellm-v1.json" \
  "$candidate_tmp/current/typescript-litellm-v1.json"

if rg -n \
  -g '!**/*_test.go' \
  '"(net/http|database/sql|os|github.com/foigent/x-insight|github.com/uniroute/unirouter)' \
  "$protocol_root/sdk/go/canonical" \
  "$protocol_root/sdk/go/protocol" \
  "$protocol_root/sdk/go/kernel"; then
  echo "forbidden Go core dependency detected" >&2
  exit 3
fi
if rg -n \
  '\b(Deno\.|globalThis\.fetch|node:fs|node:http|node:https)' \
  "$protocol_root/sdk/typescript/src/canonical" \
  "$protocol_root/sdk/typescript/src/protocol" \
  "$protocol_root/sdk/typescript/src/kernel"; then
  echo "forbidden TypeScript core dependency detected" >&2
  exit 3
fi
if rg -n 'EstablishFence|activation_forward.*function|ActivationCheckpoint' \
  "$protocol_root/sdk/go" \
  "$protocol_root/sdk/typescript/src"; then
  echo "activation-forward implementation leaked into the shared SDK" >&2
  exit 3
fi

git -C "$protocol_root" diff --exit-code \
  fd82aeca9877bea8064b25c365a3cdcdd0bb3d16 -- \
  action.yml catalog compatibility conformance fixtures implementations \
  manifests mappings reference releases schemas spec tools vectors

echo "Foigent Event Connector SDK candidate: pass"
