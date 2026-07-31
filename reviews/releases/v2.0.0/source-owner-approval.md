# Protocol v2.0.0 Source Domain Owner Final Release Approval

Role: `source_domain_owner`

Status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item:
`FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed release content

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2-source-neutral-candidate`
- reviewed content commit:
  `05f859c3663012099289495ed5c0372135173fa3`
- reviewed content tree:
  `d3fcf2a18ac83c23257628ecb5333e6048b3caf0`
- protocol version: `2.0.0`
- release component count: `93`
- Reviewed content digest: `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`

This approval applies only to the exact content commit, tree, component set,
and digest above. The rejected release content digest
`sha256:47642f562a47579d000a78961428f91829fa9053d15d647e26fbad9ea72a5b15`
is superseded and is not inherited. Candidate content digest
`sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`
and its role reviews remain historical, non-binding evidence and are not
inherited.

## Source and Receipt conclusion

Compatibility: `COMPATIBLE_WITH_PRODUCT_MIGRATION_NOT_AUTHORIZED`

The exact reviewed release preserves these Source-domain boundaries:

- the completed-execution Reference Connector covers only authenticated,
  admitted, project-scoped requests that reached a durable UniRouter billing
  terminal; pre-admission and pre-billing rejections remain outside coverage;
- `source_instance` binds exactly, byte for byte, to `producer.instance`, and
  a changed instance starts a new Connector identity domain;
- Source hash, Envelope hash, shared idempotency identity, and product-local
  normalized identity/hash remain separate domains;
- Cursor, high-watermark, request, page, retry, receipt, ingestion, and
  acknowledgement state remain outside Event identity/hash and
  item/event-linked provenance;
- pull delivery remains at least once, commits its Checkpoint only after every
  item converges, treats same-identity/same-hash replay as duplicate-noop, and
  fails closed on same-identity/different-hash conflict or empty-page Cursor
  advancement;
- Parent Event observation time remains absent where the Source does not own
  it, while Source terminal time and its deterministic occurrence alias remain
  immutable Source facts;
- protocol-controlled strings use the NFC profile, opaque Source UTF-8 remains
  byte-preserving, and token counters remain canonical nonnegative decimal
  int64 strings;
- Capture Gaps remain deterministic first-class evidence with stable linkage,
  provenance, replay identity, and declared severity.

The corrected stable Operational Receipt semantics now agree with the binding
Schema and independent implementations:

- a lifecycle/control Error binds only `error.operation` exactly to the outer
  Receipt operation;
- phase maps `activate` to `activate`, `pause`/`resume`/`start`/`rotate` to
  `status`, and `stop`/`retire` to `shutdown`;
- lifecycle/control recovery is restricted to `automatic_retry`, `restart`,
  `reauthorize`, `operator_repair`, or `none`; data-plane recovery values are
  forbidden in control Receipts;
- lifecycle/control counts remain zero and never fabricate request, bundle,
  acknowledgement, or Checkpoint state;
- pull, push, and bounded-offline operations retain their distinct
  Checkpoint, acknowledgement, and bundle completion semantics.

## Compatibility and immutable-boundary conclusion

The review confirmed:

- exact immutable v1.1.2 tag commit/tree and release digest;
- all 57 predecessor components and original v1 artifact bytes remain
  unchanged;
- 10 existing X-Insight M0 Event ID/hash pairs, eight first-class Gap row
  identities, two item-linked provenance identities, and settled/cancelled
  read-model expectations remain exact;
- five OpenInference M0 ID/hash pairs and four first-class Gap Events remain
  exact;
- the UniRouter and LiteLLM v1 compatibility paths remain byte-preserving;
- the OpenInference Reference Connector remains behind its fail-closed
  product-local migration gate;
- protocol release changes shared authority only and does not authorize
  product code migration, deployment, traffic, credentials, database,
  Cursor, Checkpoint, or runtime mutation.

## Independent verification evidence

The fresh review used an immutable archive of the exact content commit and
passed the following zero-network checks:

- content builder: exact 93-component digest
  `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`;
- immutable v1.1.2 predecessor kit: 25 Python tests with six intentional
  skips, 14-Schema audit, 30/30 base cases, 30/30 LiteLLM cases, and exact
  release digest
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`;
- current v1 compatibility kit: 35 Python tests with six intentional skips,
  24-Schema audit, 30/30 base cases, and 30/30 LiteLLM cases;
- release validator: 60 candidate components, 57 predecessor components,
  10/8/2 v1 identities, 5/4 OpenInference identities, and explicit
  `product_migration=not_authorized` / `runtime_mutation=none`;
- corrected stable-prose guard: independent negative probes for operation
  binding, phase mapping, recovery domain, forbidden data-plane recovery, and
  the superseded contradictory equality all failed closed;
- source-neutral Schema audit: 24 Schemas, three Manifests, three delivery
  modes, and five Source fixtures;
- Go implementation: test, vet, build, two deterministic 83-case runs, and
  exact stored report SHA-256
  `3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- TypeScript implementation: typecheck, tests, build, two deterministic
  83-case runs, and exact stored report SHA-256
  `eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`;
- cross-language comparison: 83/83 cases across all 29 required classes.

## Approval boundary

This file is Source Domain Owner evidence for the exact release content digest
only. It does not independently make protocol `2.0.0` Binding. Binding still
requires the exact Projection Owner and Coordinator approvals, canonical
release manifest, exact-head authority CI, merge/main CI, and immutable
`v2.0.0` tag over the same bytes.

No product repository or runtime state was modified by this review.
