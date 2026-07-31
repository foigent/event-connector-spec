# Protocol 2.0.0 RC1 Coordinator Review

Role: `coordinator`

Status: `COORDINATOR_CONFIRM_NON_BINDING`

Semantic conflict: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority state

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2-source-neutral-candidate`
- reviewed candidate commit:
  `fc5ae57d21ca389ca5a73f6c95382a9874ed7152`
- reviewed candidate tree:
  `8a446c8404254198e648c1fd81c4ea52aad3a5ea`
- protocol version: `2.0.0`
- protocol status: `NOT_BINDING`
- candidate manifest:
  `docs/candidates/v2.0.0-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:ee046d1e06cbb3ab98a8565737ecd76ce71423be68e22d6f4f7b916ffcbb4b91`
- reviewed content digest:
  `sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`

This confirmation is exact-content evidence only. It cannot be inherited by a
different commit, tree, manifest or content digest.

## Independent owner evidence

The Coordinator reviewed two distinct role records over the same exact
candidate:

1. Projection / Consumer Owner:
   - path:
     `reviews/candidates/v2.0.0-rc.1/projection-owner-review.md`
   - review commit:
     `5d888212c45860dbc6c0866523d7eae51114d538`
   - review tree:
     `9d47861dcdbf2e094f7ebb5d446c612191641195`
   - file SHA-256:
     `sha256:56c50149c70758b2df3f029934a45b6185cf2fd2bba7b916420ecb53c0941e9a`
   - status:
     `PROJECTION_OWNER_V2_RELEASE_CANDIDATE_CONFIRM_NON_BINDING`
   - semantic conflict:
     `NONE_IDENTIFIED_WITH_SUPERSEDING_SHARED_CANDIDATE`
2. Source Domain Owner:
   - path:
     `reviews/candidates/v2.0.0-rc.1/source-owner-review.md`
   - file SHA-256:
     `sha256:f09ab63b939ed0595c1ba2877856038acc2edd3c4129f09da169293288907582`
   - status:
     `SOURCE_OWNER_CONFIRM_NON_BINDING`
   - semantic conflict:
     `NONE`

The Source record was authored by the Source Domain Owner. The Coordinator did
not infer or fabricate Source approval from Projection evidence.

## Superseded-candidate non-inheritance

The following content digests and their earlier reviews are superseded and
cannot satisfy any release gate:

1. `sha256:219401b98705b9787d4186b919dbf02d9d242a385cec956120b0870d401412ef`;
2. `sha256:d4403333a4e932a3383a72918d151a5c6a78f6df35eb29b6d0833e96f95247c1`;
3. `sha256:5591a6c3b4b86e3af2d39016a376961a19cf71aea71c3fcb9c6de755a08be163`;
4. `sha256:b0352139436ae9b58652cb3c19ef895a4b5a226eb638873cd6d4d760bc1b1f3c`.

The current exact candidate closes, in order, the previously identified
projection-proof gap, Operational Receipt cross-field and portability gaps,
lifecycle delivery-state contradiction and nested lifecycle Error
phase/operation/recovery contradiction. No earlier approval is carried
forward.

## Coordinator semantic conclusion

No material protocol, Source-domain, Projection-domain or governance
contradiction was identified in the exact candidate:

1. Connector Manifest v2 is a closed, single-mode union over `https_pull`,
   `otlp_http_push` and `bounded_offline`.
2. Cursor and Connector Checkpoint remain pull-only. Push request
   acknowledgement and bounded-offline bundle receipt remain operational state
   outside Event identity, hash and event-linked provenance.
3. Delivery completeness remains separate from execution-timeline
   completeness. Missing evidence remains represented by deterministic,
   first-class Capture Gaps.
4. Lifecycle/control operations use the exact mode-neutral `control` delivery
   state, all five counts are zero and no request, bundle, acknowledgement or
   Checkpoint is fabricated.
5. Data operations alone bind their mode-specific delivery state. Push durable
   acknowledgement, pull Checkpoint commit and offline receipt completion occur
   only for the corresponding completed data operation.
6. Retryable and permanent Receipt statuses require a complete Connector Error
   with matching retryability. Accepted and completed Receipts reject Error
   state.
7. A lifecycle/control Error binds its nested operation exactly to the outer
   operation. Its phase is `activate` for activate, `status` for
   pause/resume/start/rotate and `shutdown` for stop/retire.
8. Lifecycle/control recovery is limited to `automatic_retry`, `restart`,
   `reauthorize`, `operator_repair` or `none`. Data-plane recovery values fail
   closed in a control Receipt.
9. Data-plane Error phase, operation and recovery remain mode-specific; the
   lifecycle correction does not broaden or reinterpret them.
10. Receipt counts are JSON safe integers and independent implementations
    enforce exact arithmetic conservation without TypeScript number coercion.
11. Event Envelope v1, identity, canonicalization, Source hash, Envelope hash,
    M0 hash and mutable-delivery exclusion semantics remain unchanged.
12. OpenInference optional facts, conditional Gaps, status handling,
    multi-Span bound/order and same-Trace parent lookup are now covered by exact
    positive and negative cross-language evidence rather than prose alone.

## Compatibility conclusion

Compatibility:
`COMPATIBLE_WITH_FAIL_CLOSED_PRODUCT_MIGRATION_GATE`

Verified preservation:

- all 57 components of the Binding v1.1.2 predecessor are byte-exact;
- Binding UniRouter and LiteLLM manifests and compatibility matrices remain
  exact;
- UniRouter preserves 10 M0 Event ID/hash pairs, 8 first-class Gap rows,
  2 provenance identities and its current read-model expectations;
- OpenInference preserves 5 M0 Event ID/hash pairs and 4 first-class Gap
  Events;
- OpenInference Source hash, idempotency key and Envelope hash remain:
  - `sha256:533e33c2e02a6a67632107ae99f3993eee1a1da39835029521a4c3fe0ceb4708`;
  - `sha256:7e955832524e293df668d87d39c5a17303916c25b2e8ff87b5fbf4ca8bac851b`;
  - `sha256:02dc4475ff08b58ded11359de849f23c0b1d2dd378d376adfe6c2f09e7ea6819`.

Protocol compatibility does not make X-Insight activation-ready. Product
adoption remains fail-closed until X-Insight replaces the current
OpenInference pull/Checkpoint provenance shape with bounded-offline receipt
semantics and resolves parent presence by `trace_id + parent_span_id`, while
preserving the five existing M0 IDs/hashes.

## Independent Coordinator conformance evidence

The Coordinator created and reviewed an immutable archive from the exact
candidate:

- archive:
  `/private/tmp/coordinator-v2-420847-review.U8DwyH`
- candidate-manifest SHA-256:
  `sha256:ee046d1e06cbb3ab98a8565737ecd76ce71423be68e22d6f4f7b916ffcbb4b91`

The exact zero-network one-shot kit passed:

- Binding v1 Python compatibility: 29 tests with 6 intentional skips;
- Binding v1 Go and TypeScript conformance: 30/30 cases each;
- Binding LiteLLM Go and TypeScript conformance: 30/30 cases each;
- source-neutral v2 validator and Schema audit: 22 Schemas, 3 Manifests,
  3 delivery modes and 5 Source fixtures;
- source-neutral v2 Go conformance: 83/83 cases on two deterministic runs;
- source-neutral v2 TypeScript conformance: 83/83 cases on two deterministic
  runs;
- cross-language comparison: 83 byte-identical observations across 29 required
  classes after removing only permitted implementation identity fields;
- 36 Operational Receipt cases covering lifecycle/control and data operations,
  status/Error coupling, nested control Error phase/operation/recovery,
  mode-specific state, safe-integer boundaries, count conservation,
  acknowledgement and Checkpoint behavior;
- exact v1.1.2 predecessor digest and all 57 predecessor components;
- exact UniRouter and OpenInference compatibility seeds described above.

The independently verified component identities include:

- Operational Receipt Schema:
  `sha256:d2d091c2571d54df7a65329da049f13a4d7465af38b7916e4ae79e57255a04b6`;
- source-neutral vector bundle:
  `sha256:2a15ff7c2ecbac3829203fb4692c9a701b9d1fa8880a801e9c845b3e358ab13a`;
- Go report:
  `sha256:de1ed5bc6abd0159e43da885d776e2abf792d068e8ca1b56a630abe511acaea8`;
- TypeScript report:
  `sha256:f5c4d381fc18563863b26cf1ba43525953f25c10fc886b6dced27268412be8b7`.

## Non-binding disposition and remaining gates

The three-role exact-content review gate is locally evidenced for content
digest
`sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`.

This confirmation does not make protocol `2.0.0` Binding and does not authorize
product adoption or runtime change. Remaining governance work is:

1. reviewed authority integration and CI over the exact candidate plus the
   three distinct role records;
2. canonical immutable `v2.0.0` release manifest and tag only after that
   authority gate succeeds;
3. separately authorized X-Insight bounded-offline product migration;
4. separately reviewed implementation for any future live OTLP HTTP receiver.

No product repository, deployment, traffic, credential, database, Cursor,
Checkpoint or runtime state was changed during this review. This local evidence
assembly changes only the Source Owner and Coordinator review records; candidate
Schema, specification, vectors, mappings, implementations, reports and
candidate-manifest bytes remain unchanged.
