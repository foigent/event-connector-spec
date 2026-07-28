# Protocol 1.1.2 Source Domain Owner Approval

Role: `source_domain_owner`

Status: `SOURCE_DOMAIN_OWNER_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- candidate commit: `f3e3bc2db008ba075401d8e0c062e628b0a35c32`
- candidate tree: `23174dbf39f4b8138f7beb3733122229f2657ccb`
- protocol version: `1.1.2`
- reviewed content digest:
  `sha256:60c063bee465d341de4dc1c640ec5555b78985be8d20e528c168f41373ccb60c`

## Disposition

Semantic conflict: `NONE_IDENTIFIED`

Protocol `1.1.2` adds one compatibility rule for the pinned LiteLLM
`v1.93.0` `GET /spend/logs/v2` Source contract. The exact upstream
`cache_hit` string `"None"` maps to the existing normalized
`cache_status="unknown"`.

JSON `null` and the empty string retain their existing `unknown` semantics.
JSON booleans and the exact strings `"True"` and `"False"` retain their
existing `hit` and `miss` semantics. Lowercase `"none"`, string `"null"`,
and every other unrecognized string remain fail-closed with
`invalid_cache_hit`.

## Compatibility and verification

The Source Domain Owner verified:

- the candidate commit, tree, and reconstructed content digest above;
- exact preservation of Source Schemas, Event Envelope Schemas, the X-Insight
  M0 projection contract, identities, idempotency, hashes, Cursor,
  Checkpoint, provenance, and normalized Golden case outputs;
- exact preservation of all 20 previously released LiteLLM conformance case
  result hashes;
- 10 new upstream cache-status cases in both independent Go and TypeScript
  implementations, including Golden and negative behavior, with identical
  cross-language results and 30 passing LiteLLM cases per implementation;
- deterministic LiteLLM artifact generation and pinned upstream evidence;
- 25 Python verification tests with 6 expected skips and schema audit of
  14 Schemas, 2 Manifests, and 5 envelopes/payloads; and
- Go tests and vet plus TypeScript typecheck, 10 tests, and offline build.

GitHub Actions run `30397542814` reproduced all technical and cross-language
checks above. It then failed closed only because the exact-candidate
three-role approval set and final `v1.1.2` release manifest were intentionally
not yet assembled.

## Boundary

This approval covers only the exact candidate and content digest above. Any
component-byte change requires a new content digest and new three-role review.

It does not authorize or claim product code changes, runtime deployment,
credentials, live LiteLLM access, traffic, database changes, service
operations, Cursor or Checkpoint mutation, merge, tag publication, or release
assembly.
