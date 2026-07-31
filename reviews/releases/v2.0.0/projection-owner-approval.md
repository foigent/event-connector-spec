# Protocol v2.0.0 Projection Owner Final Release Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item:
`FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed release content

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2-source-neutral-candidate`
- reviewed content commit:
  `3b09ecc8a0f8ff1d33aa50842403e6aedba1e50f`
- reviewed content tree:
  `f6957977c7c4cf8f9eb83cc0653aa62248b78bdb`
- protocol version: `2.0.0`
- release component count: `93`
- Reviewed content digest: `sha256:47642f562a47579d000a78961428f91829fa9053d15d647e26fbad9ea72a5b15`

This approval applies only to the exact content commit, tree, component set,
and digest above. Candidate approval
`sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`
is historical and is not inherited.

## Projection and compatibility conclusion

Compatibility:
`COMPATIBLE_WITH_FAIL_CLOSED_PRODUCT_MIGRATION_GATE`

The final release content preserves:

- the Binding v1.1.2 predecessor release manifest, all 57 predecessor
  components, and exact immutable tag commit/tree;
- 10 existing X-Insight M0 Event IDs/hashes;
- eight first-class Gap row IDs;
- two item-linked import provenance IDs;
- settled/cancelled read-model expectations;
- five OpenInference M0 IDs/hashes and four first-class Gap Events;
- the OpenInference Source hash, idempotency key, and Envelope hash;
- `time.observed_at` absence and the deterministic
  `occurred_at=terminal_at` alias;
- decimal int64 token counters, protocol NFC rejection, and opaque Source
  UTF-8 preservation;
- separate ingestion and payload capture modes;
- mutable delivery, receipt, retry, request, bundle, Cursor, Checkpoint, and
  ingestion state outside Event identity/hash and event-linked provenance.

The stable v2 release artifacts use `protocol_status=binding`, while branches
and untagged commits remain non-authoritative. The immutable candidate manifest
and candidate reviews remain exact historical evidence.

The X-Insight OpenInference activation gate remains
`blocked_product_migration_required`. Protocol release does not authorize the
product-local bounded-offline provenance/receipt migration, trace-scoped parent
resolution change, protocol pin, deployment, traffic, credentials, database,
Cursor, or Checkpoint mutation.

## Verification evidence

The following zero-network checks passed against the reviewed content:

- immutable v1.1.2 archive suite:
  25 Python tests with 6 intentional skips, 14-Schema audit, 30/30 base cases,
  30/30 LiteLLM cases, and exact v1.1.2 release digest;
- current v1 compatibility suite:
  34 Python tests with 6 intentional skips, 24-Schema compilation, 30/30 base
  cases, and 30/30 LiteLLM cases;
- source-neutral v2 Schema audit:
  24 Schemas, three Manifests, three delivery modes, and five Source fixtures;
- source-neutral v2 Go:
  tests/vet/build, two deterministic 83-case runs, and exact stored report;
- source-neutral v2 TypeScript:
  typecheck/tests/build, two deterministic 83-case runs, and exact stored
  report;
- cross-language comparison:
  83/83 cases across 29/29 required classes;
- release validator:
  60 candidate components, 57 predecessor components, 10/8/2 v1 identities,
  5/4 OpenInference identities, and no product/runtime mutation;
- v1 release builder:
  exact release digest
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`;
- v2 release content builder:
  two successive invocations produced the same reviewed content digest.

Key final component identities:

- source-neutral contract:
  `sha256:f820936448590144156c2e499134eb4b3142ca0265275b6e9bdf1e5cd7855e14`;
- source-neutral vector bundle:
  `sha256:9e50bb4570dcc1ff07157ad6198641e937357b641ae052cddcb3420b52ad11ed`;
- Go report:
  `sha256:3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- TypeScript report:
  `sha256:eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`;
- Go implementation manifest:
  `sha256:e8bf8b401f60c25dddf9d9c272706eb08368d15c2b85baeff22540f39ff1be25`;
- TypeScript implementation manifest:
  `sha256:bdce6862459236933de2378c2680fec9e5593b8a0e73e13f576d8350233296dd`;
- v1-to-v2 compatibility matrix:
  `sha256:bdc2527ca947bf7b6a9c1feb2d5a97a9426b5b3ec602690a2d7b23d3f85ace52`;
- preserved X-Insight v1 compatibility seed:
  `sha256:5cd40aa6c0256a70ad7317c05e078759685e0469be77a3e960a976adc3158e8e`;
- OpenInference-to-X-Insight compatibility matrix:
  `sha256:0dd606acf3ee1111987d2d74a2f8ad3b9881ca5daf4ad5920351ba5c643e4f60`.

## Approval boundary

This is Projection / Consumer Owner evidence for the exact release content
digest only. It does not by itself make protocol `2.0.0` Binding. Binding
still requires an exact Source Domain Owner approval, Coordinator approval,
canonical release manifest, exact-head authority CI, merge/main CI, and an
immutable `v2.0.0` tag over the same bytes.

No X-Insight product repository or runtime state was modified.
