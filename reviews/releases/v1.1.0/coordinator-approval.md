# Protocol 1.1.0 Coordinator Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- repository ID: `1313391565`
- commit: `8e283d87c9c2e2638f29333e37b01a56cf69ed00`
- tree: `3e63bc1f5064faf794f95da35540a1431d2c7d67`
- protocol version: `1.1.0`
- reviewed content digest:
  `sha256:3067581f2012c1239dbee1959facbc77ab1b18dc3bfc82172f57c3be894d09c5`
- Source Domain Owner approval SHA-256:
  `7525d5ea7b136e8cc7feab717870aef61539a2d7a1ddc8f83a9fa17830023615`
- Projection Owner approval SHA-256:
  `42570eacb414d177f6f5d9d227c675699534aa94d65f97171a04ccfa750e23d5`

## Disposition

No material semantic conflict remains.

Protocol `1.1.0` is an additive shared Event/Connector contract and SDK
conformance release. It does not create one universal privileged plugin
runtime. Each product retains its own isolated runtime, local authorization,
registry, persistence, lifecycle, and operational controls.

The UniRouter completed-execution Connector remains the unchanged Reference
Connector and compatibility baseline. The LiteLLM spend-log Connector is the
second independent integration Connector. It uses the shared Event envelope,
identity, hash, lifecycle, error, Batch, Checkpoint, Receipt, and conformance
contracts without coupling LiteLLM runtime behavior into UniRouter or changing
X-Insight M0 semantics.

The LiteLLM contract:

- pins upstream release `v1.93.0`, exact Git commit, signed multi-architecture
  image index, reviewed Source files, and immutable evidence;
- projects raw `/spend/logs/v2` responses through a strict allowlist and
  forbids raw prompt, response, API key, user, end-user, IP, metadata, proxy
  request, cache key, session, team, and organization fields from retention,
  logs, shared Event payloads, or X-Insight normalized evidence;
- accepts only a complete bounded window and advances a structured
  start-time/request-ID boundary checkpoint after every accepted item
  converges;
- orders opaque request IDs by exact UTF-8 bytes in both Go and TypeScript,
  including the frozen BMP/non-BMP boundary vector;
- keeps mutable page, retry, fetch, ingestion, cursor, and high-watermark state
  outside Event identity/hash and item-linked provenance;
- preserves separate Source, shared Envelope, and product-local M0 hash and
  idempotency domains;
- maps Source-reported USD only as an observational usage extension, never as
  authoritative billing or top-level CNY cost;
- maps four explicit unavailable claims to deterministic first-class Capture
  Gaps with the frozen declared/derived provenance.

## Compatibility

Protocol `1.0.0` Reference component bytes and digests remain unchanged. The
existing completed-execution compatibility gate still preserves 10 M0 event
IDs/hashes, 8 Gap rows, 2 provenance IDs, 10 provenance links, local
idempotency identities, and read-model expectations.

The LiteLLM Connector adds `model.request.completed/v2`, projecting terminal
status to `model.request.succeeded` or `model.request.failed` in X-Insight M0
`m0.1`. It does not replace the existing Reference event schema or projection.

## Coordinator verification

The Coordinator independently verified:

- the exact candidate commit, tree, content digest, and both Owner approval
  identities;
- the corrected official LiteLLM Source path against the pinned upstream
  commit and its exact file SHA-256;
- deterministic generation and validation of 14 schemas, 2 Connector
  Manifests, and 5 shared envelopes/payloads;
- 25 mapping and governance tests with 6 expected legacy-environment skips;
- Go tests and vet, TypeScript typecheck, 10 tests, and offline build;
- byte-identical Go and TypeScript output for all 30 Reference cases and all 20
  LiteLLM cases;
- explicit replay, conflict, partial-page failure, activation-forward,
  incomplete-window, privacy-rejection, canonical decimal/time, cache
  tri-state, Capture Gap, and UTF-8 checkpoint boundary cases;
- exact preservation of protocol `1.0.0` Reference component digests;
- Source Domain Owner and Projection Owner independent compatibility findings.

The approval covers only the exact content digest above. Any component-byte
change requires a new digest and three-role review.

## Boundary

This approval authorizes immutable publication and product CI pinning of
protocol `1.1.0`. Product runtime implementation, deployment, credentials,
live LiteLLM access, traffic, database changes, service operations, and
Checkpoint mutation remain separate execution stages with their own evidence
and acceptance gates.
