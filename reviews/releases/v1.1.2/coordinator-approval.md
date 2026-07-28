# Protocol 1.1.2 Coordinator Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- repository ID: `1313391565`
- candidate commit: `45b03dbeffe59d170828863e6c1902cd0a5e5443`
- candidate tree: `9c779273142ddb702383198f80e4b4f91ef6656b`
- protocol version: `1.1.2`
- reviewed content digest:
  `sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813`
- Source Domain Owner approval SHA-256:
  `0f4dc90c4b0896e90cac860504cbced07b95d60470ae90cacce5163ca1840395`
- Projection Owner approval SHA-256:
  `964e96ef9c6c16e548c7746a56c0ed1a1dcff80bd5945e7246efec2ee034c0ca`

## Disposition

Semantic conflict: `NONE_IDENTIFIED`

The Coordinator independently reviewed the exact two-file release-truth
correction over merged main
`500f465ec8d1182f464fdc2ef3fcc6511deaa814` and reproduced its commit, tree
and content digest. `README.md` and `spec/protocol-v1.md` now describe
`1.1.2` as the stable protocol version whose binding authority is only the
immutable `v1.1.2` tag and its verified release manifest. No protocol,
Connector, projection or runtime semantic changes are introduced.

The previously reviewed compatibility evidence remains applicable. Protocol
`1.1.2` adds one pinned LiteLLM `v1.93.0`
`GET /spend/logs/v2` compatibility rule: only the exact upstream string
`"None"` maps to the existing normalized `cache_status="unknown"`.

JSON `null` and the empty string retain their existing `unknown` semantics.
JSON booleans and exact strings `"True"` and `"False"` retain their existing
`hit` and `miss` semantics. Lowercase `"none"`, string `"null"`, and every
other unrecognized string continue to fail closed as `invalid_cache_hit`.

## Verification and compatibility

The Coordinator confirmed:

- exact candidate commit, tree, content digest, the exact two-file
  release-truth diff, and the two independent candidate-bound Owner approvals
  above;
- byte-exact preservation of all protected Schemas, Source/Event and X-Insight
  M0 mappings, compatibility contracts, Source and shared hash-input fixtures,
  canonical vectors, Checkpoint algorithm, operational receipts, identity,
  idempotency, hash, Cursor and provenance contracts;
- byte-exact preservation of every prior 20 LiteLLM conformance observation
  in both Go and TypeScript;
- exactly 10 additive upstream cache-status vectors, with byte-identical Go
  and TypeScript results and strict negative lexical cases;
- deterministic LiteLLM artifacts and pinned upstream evidence;
- candidate content digest reconstruction;
- Schema audit, Python verification, Go test/vet/build, TypeScript
  typecheck/tests/build, and 30-case cross-language conformance; and
- GitHub Actions run `30399053454`, whose only failure was the intentional
  stale three-role approval and release-manifest binding before this final
  assembly.

No Source Schema, Event Envelope, X-Insight M0 event ID or hash, product-local
idempotency key, normalized Golden result, Gap identity, provenance identity,
read-model behavior, Cursor, high-watermark or Checkpoint algorithm changes.

## Boundary

This approval authorizes final immutable protocol `1.1.2` release assembly,
exact-head PR CI, merge, main CI, and `v1.1.2` tag publication for the exact
candidate and content digest above. Any component-byte change requires a new
content digest and new three-role review.

It does not itself authorize or claim product runtime deployment, credentials,
live LiteLLM access, traffic, database changes, service operations, or
Cursor/Checkpoint mutation. Product CI repinning and bounded Development
adoption remain separately gated by the already approved Phase 2C sequence.
