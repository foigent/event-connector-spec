# Protocol 1.1.2 Projection Owner Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- candidate commit: `45b03dbeffe59d170828863e6c1902cd0a5e5443`
- candidate tree: `9c779273142ddb702383198f80e4b4f91ef6656b`
- protocol version: `1.1.2`
- reviewed content digest:
  `sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813`

## Disposition

Semantic conflict: `NONE_IDENTIFIED`

The Projection Owner independently reviewed the exact two-file release-truth
correction over the already approved protocol `1.1.2` component candidate.
`README.md` and `spec/protocol-v1.md` now describe `1.1.2` as the stable
protocol version whose binding authority is only the immutable `v1.1.2` tag
and its verified release manifest, replacing the transitional candidate and
`v1.1.1`-binding wording. No protocol or projection semantic changes.

The previously reviewed compatibility evidence remains applicable. Protocol
`1.1.2` adds one pinned LiteLLM `v1.93.0` upstream lexical compatibility rule:
only the exact string `"None"` maps to the existing normalized
`cache_status="unknown"`.

JSON `null` and the empty string preserve their existing `unknown` semantics.
JSON booleans and exact strings `"True"` and `"False"` preserve their existing
`hit` and `miss` semantics. Lowercase `"none"`, string `"null"`, and every
other unrecognized string continue to fail closed as `invalid_cache_hit`.

## Compatibility and verification

The Projection Owner confirmed:

- the candidate commit, tree, and reconstructed content digest above;
- byte-exact preservation of the LiteLLM Source Schema, shared Event Envelope
  and model-request-completed V2 Schemas, Source-to-Envelope mapping,
  X-Insight M0 projection mapping, compatibility contract, Checkpoint and
  operational-receipt contracts;
- byte-exact preservation of all three Source fixtures and all three shared
  Envelope hash-input fixtures;
- preservation of every Golden Source digest, shared-fixture digest, Envelope
  hash, idempotency key, terminal status and Capture Gap count; the Golden
  bundle container changes only its protocol-version metadata;
- byte-exact preservation of all prior 20 LiteLLM conformance observations in
  both Go and TypeScript reports;
- exactly 10 additive upstream cache-status vectors with byte-identical Go and
  TypeScript results, including the exact `"None"` acceptance and fail-closed
  lexical negatives; and
- deterministic artifact generation, pinned upstream evidence, Schema audit,
  Python verification, Go test/vet/build, TypeScript typecheck/tests/build,
  and cross-language 30-case conformance.

No X-Insight M0 event ID, event hash, local idempotency key, normalized Golden
result, Gap identity, provenance identity, read-model behavior, cursor,
high-watermark or Checkpoint algorithm changes. Product-local runtime adoption
remains separately isolated and authorized.

## Boundary

This approval covers only the exact candidate and content digest above. Any
component-byte change requires a new content digest and new three-role review.

The current Draft PR intentionally leaves the immutable release manifest stale
until all three final `v1.1.2` approval records are rebound to this exact
candidate and the manifest is reproducibly regenerated. It must remain
merge-held until final release assembly is complete and exact-head authority
CI is green.

This approval does not authorize or claim product code changes, runtime
deployment, credentials, live LiteLLM access, traffic, database changes,
service operations, or Cursor/Checkpoint mutation.
