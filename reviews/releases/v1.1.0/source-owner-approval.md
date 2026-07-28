# Protocol 1.1.0 Source Domain Owner Approval

Role: `source_domain_owner`

Status: `SOURCE_DOMAIN_OWNER_FINAL_APPROVAL`

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

The additive LiteLLM Source Connector is compatible with the shared protocol
and does not alter the UniRouter completed-execution Reference Connector.
Reference Manifest, Source/projection mappings, Golden fixtures, canonical
vectors, compatibility seeds, and Go/TypeScript 30-case reports retain their
protocol `1.0.0` component digests.

The LiteLLM Connector binds exact upstream release `v1.93.0`, commit
`052b5a2169d8d3082e1d66e69f200a72b0c1e274`, image index digest
`sha256:a1745e629abfb17d434426ff48b115f54f4f4c4a0f5af241de569e93c63c411e`,
and the declared Linux amd64/arm64 manifest digests. The released official
cosign public-key bytes hash to
`sha256:ff8869bf14ba9d10af7b64b9d479543b44daec0165e715753c43ff8a998f6dd3`;
the two pinned cosign verification statements bind the same image index
digest. The four reviewed upstream Source-contract paths and SHA-256
identities match the exact upstream commit.

## Source contract and delivery findings

The reviewed contract:

- projects raw `GET /spend/logs/v2` rows through an explicit allowlist into a
  strict sanitized Source record and forbids retention, logging, or emission
  of raw prompt, response, proxy request, API key, user, end-user, IP,
  metadata, cache, session, team, or organization data;
- rejects unknown sanitized Source fields and preserves a canonical sanitized
  Source hash distinct from Envelope and X-Insight M0 hash domains;
- freezes `null|success -> succeeded` and `failure -> failed`, preserves cache
  as `hit|miss|unknown`, uses canonical nonnegative decimal strings, enforces
  exact token totals, and normalizes Source time to UTC microseconds;
- requires a complete uncapped window bounded by 20 pages, 2,000 unique
  request IDs, and 8 MiB, with unique count equal to the reported total;
- orders each complete window by `(startTime, request_id UTF-8 bytes)`, including
  the explicit BMP/non-BMP boundary vector;
- keeps page, fetch, retry, ingestion, and mutable delivery state outside Event
  identity, hashes, and item-linked provenance;
- advances the structured start-time boundary checkpoint only after every item
  converges, preserves same-timestamp request IDs, fails content conflict and
  incomplete windows closed, and keeps activation forward-only without broad
  backfill.

## Verification

The Source Domain Owner independently verified:

- exact commit, tree, and content-digest reconstruction;
- the official LiteLLM tag/commit, public-key bytes, four upstream source-file
  digests, GHCR image index, and Linux amd64/arm64 manifest digests;
- Source schema, upstream allowlist, Source-to-Event mapping, Connector
  Manifest, declared Capture Gaps, identity/hash exclusions, compatibility
  matrix, Golden fixtures, replay vectors, and release component closure;
- strict privacy rejection, cache tri-state, canonical decimal/time handling,
  same-identity replay, conflict, partial-page replay, activation fence,
  complete-window failure, and same-timestamp UTF-8 boundary behavior;
- Go tests and vet, TypeScript typecheck/tests/build, schema audit, 25 Python
  verification tests, and deterministic artifact generation;
- byte-identical Go and TypeScript results for all 30 Reference cases and all
  20 LiteLLM cases;
- exact preservation of the protocol `1.0.0` Reference component digests.

The full Conformance Kit passed every component-independent gate. Its final
release-manifest check stopped only because the three protocol `1.1.0` approval
files and generated release manifest had not yet been assembled; that expected
release-closure step is not presented as already complete.

## Boundary

This approval covers only the exact protocol content digest above and may be
used as Source Domain Owner evidence for the immutable protocol `1.1.0`
release candidate. Any component-byte change requires a new content digest and
new approval.

It does not authorize product runtime adoption, deployment, credentials, live
LiteLLM access, traffic, database changes, service operations, or
Cursor/Checkpoint mutation. It does not claim a deployed Connector,
Development acceptance, or Production readiness.
