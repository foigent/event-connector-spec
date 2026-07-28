# Protocol 1.1.0 Projection Owner Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- commit: `8e283d87c9c2e2638f29333e37b01a56cf69ed00`
- tree: `3e63bc1f5064faf794f95da35540a1431d2c7d67`
- protocol version: `1.1.0`
- reviewed content digest:
  `sha256:3067581f2012c1239dbee1959facbc77ab1b18dc3bfc82172f57c3be894d09c5`

## Disposition

Semantic conflict: `NONE_IDENTIFIED`

The additive LiteLLM Connector projection is compatible with X-Insight M0
`m0.1` and does not alter the completed-execution Reference Connector or its
existing normalized evidence, provenance, Gap, idempotency, and read-model
semantics.

The reviewed projection maps shared `model.request.completed/v2` terminal
status `succeeded|failed` to X-Insight `model.request.succeeded` or
`model.request.failed`. Source-reported USD spend remains an observation under
`usage.extensions.source_reported_money`; it is never promoted to authoritative
billing or to the existing top-level CNY cost fields. The shared Source and
Event contracts preserve cache status as the exact tri-state
`hit|miss|unknown`; any product-local persistence of that fact must remain
lossless and must not collapse `unknown`.

The four declared Capture Gaps (`billing_authority`, `business_outcome`,
`downstream_side_effects`, and `routing_decision`) map to
`gap.capture.detected` with the frozen declared/derived field provenance.
Shared Source, Envelope, and product-local M0 hash domains remain separate.
Shared event identity and idempotency do not replace X-Insight local
identities. Mutable page, checkpoint, retry, and ingestion state remains
outside normalized event identity/hash and item-linked contracted-pull
provenance.

The protocol `1.0.0` Reference compatibility gate remains exact: 10 M0 event
IDs/hashes, 8 first-class Gap rows, 2 provenance IDs, 10 provenance links, and
the existing read-model expectations are unchanged.

## Verification

The Projection Owner independently verified:

- exact commit, tree, and content-digest reconstruction;
- the `model.request.completed/v2` schema, sanitized LiteLLM Source schema,
  Source-to-Event mapping, X-Insight projection mapping, compatibility matrix,
  Connector Manifest, Golden fixtures, Capture Gaps, and replay vectors;
- the USD source-reported boundary, cache tri-state, succeeded/failed mapping,
  M0 hash/idempotency separation, checkpoint isolation, and fail-closed
  conflict semantics;
- the corrected same-timestamp ordering by exact request-ID UTF-8 bytes,
  including the BMP/non-BMP boundary case where U+E000 precedes U+10000;
- deterministic artifact generation, candidate verification, exact upstream
  evidence, schema checks, 25 Python tests, Go tests and vet, and TypeScript
  typecheck/tests/offline build;
- byte-identical Go and TypeScript results for all 30 Reference cases and all
  20 LiteLLM cases;
- byte preservation of the protocol `1.0.0` Reference projection,
  compatibility seed, vectors, reports, and component digests;
- release-component and product-pin requirements, while keeping final release
  assembly distinct from this Owner approval.

The full independently exercised component gates passed. Final immutable
release-manifest generation, tag publication, and product CI pin acceptance
remain release-closure steps and are not claimed by this approval.

## Boundary

This approval covers only the exact protocol content digest above. Any
component-byte change requires a new content digest and a new Projection Owner
review.

It does not authorize or claim product runtime implementation, deployment,
credentials, live LiteLLM access, traffic, database changes, service
operations, or Cursor/Checkpoint mutation. Product-local X-Insight Connector
implementation and runtime/UI acceptance remain separate later-phase work.
