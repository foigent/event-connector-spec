# Protocol v2.0.0 Coordinator Final Release Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_RELEASE_CONFIRM`

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

This approval is limited to the exact content commit, tree, component set, and
digest above. The rejected final-release digest
`sha256:47642f562a47579d000a78961428f91829fa9053d15d647e26fbad9ea72a5b15`
and its Projection approval are superseded and are not inherited. Candidate
digest
`sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`
and its reviews remain historical, non-binding evidence and cannot satisfy
this final-release gate.

## Exact role evidence

Projection / Consumer Owner evidence:

- status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`
- evidence path:
  `reviews/releases/v2.0.0/projection-owner-approval.md`
- evidence SHA-256:
  `9baa2d4f7fb1bcff5b67c8b9c5db32071629f557e88c110dfecb8006fedf75c8`
- evidence commit:
  `a97281a99713e6e99115c8ff44a335fe8a366150`
- evidence tree:
  `56099c05b57e11251f88ef7d6df745d19d525394`

Source Domain Owner evidence:

- status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`
- evidence path:
  `reviews/releases/v2.0.0/source-owner-approval.md`
- evidence SHA-256:
  `41d20655385397e6f9d21d2945be630f84430f837d551fffe3022475d29362db`
- evidence commit:
  `256d5b4494e08cdaef1fcfec8c99e5dd3ae46777`
- evidence tree:
  `0bb702a61be7e5f18cc448e5ebfc21f135b14547`

Both approvals bind the same corrected content digest and explicitly record
`Semantic conflict: NONE`, `Product migration: NOT_AUTHORIZED`, and
`Runtime mutation: NONE`. Their conclusions were independently produced and
were not derived from one another.

## Coordinator semantic and governance conclusion

Compatibility:
`COMPATIBLE_WITH_FAIL_CLOSED_PRODUCT_MIGRATION_GATE`

The corrected stable Operational Receipt text now agrees with the binding
Schema and independent implementations:

- only `error.operation` equals the outer lifecycle/control operation;
- phase maps `activate` to `activate`, `pause`/`resume`/`start`/`rotate` to
  `status`, and `stop`/`retire` to `shutdown`;
- control recovery is limited to `automatic_retry`, `restart`, `reauthorize`,
  `operator_repair`, or `none`;
- the data-plane recovery values `explicit_resync`, `resubmit_request`, and
  `reimport_bundle` remain forbidden for control Errors.

The release validator checks all four positive rules and rejects the
superseded contradictory equality. The focused negative test proves that a
phase-prose drift fails closed. This closes the only material conflict found
in the rejected final-release content.

The release preserves the shared architecture boundaries:

- one editable protocol authority with immutable, digest-pinned releases;
- distinct Source, shared Envelope, and product-local identity/hash domains;
- mutable request, delivery, retry, receipt, acknowledgement, ingestion,
  Cursor, and Checkpoint state outside Event identity/hash and item-linked
  provenance;
- operation-discriminated pull, push, bounded-offline, and mode-neutral
  lifecycle/control Receipts;
- deterministic capture-gap identity, provenance, linkage, and replay;
- product-local registries, projections, runtimes, databases, credentials,
  and lifecycle control remain outside shared protocol release authority.

The exact compatibility gates preserve all 57 v1.1.2 predecessor components,
10 existing X-Insight M0 Event ID/hash pairs, eight Gap row identities, two
item-linked provenance identities, five OpenInference M0 ID/hash pairs, four
OpenInference Gap Events, the UniRouter and LiteLLM compatibility paths, and
the existing Source/idempotency/Envelope hash seeds. OpenInference product
adoption remains blocked behind its explicit product-local migration gate.

## Independent Coordinator verification

The Coordinator reviewed an immutable archive of exact content commit
`05f859c3663012099289495ed5c0372135173fa3` and independently verified:

- content builder twice produced exact digest
  `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`;
- release validator passed 60 archived-candidate components, 57 predecessor
  components, 10/8/2 v1 identities, 5/4 OpenInference identities, 83 cases,
  29 classes, `product_migration=not_authorized`, and
  `runtime_mutation=none`;
- corrected release tests passed 10/10, including the prose-drift negative
  gate;
- v2 Schema audit passed 24 Schemas, three Manifests, three delivery modes,
  and five Source fixtures;
- Go test, vet, build, and two deterministic 83-case runs matched stored
  report SHA-256
  `3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- TypeScript typecheck, tests, build, and two deterministic 83-case runs
  matched stored report SHA-256
  `eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`;
- cross-language observations matched for all 83 cases and 29 required
  classes;
- the current v1 compatibility kit passed 35 Python tests with six intentional
  skips, a 24-Schema audit, 30/30 base cases, and 30/30 LiteLLM cases;
- the immutable v1.1.2 predecessor kit passed 25 Python tests with six
  intentional skips, a 14-Schema audit, 30/30 base cases, 30/30 LiteLLM
  cases, and exact release digest
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`;
- legacy v1 workflow, shared action, builder, verifier, and comparator Git
  blobs remain byte-identical to immutable tag `v1.1.2`;
- all 93 release component paths are unique regular files and no symlink is
  present in the reviewed content tree.

The corrected Projection approval remained byte-exact throughout Source and
Coordinator review. Adding the Source approval did not alter the reviewed
content digest.

## Approval boundary

This file is Coordinator evidence for the exact corrected release content and
the two exact role approvals above. It does not by itself create a Binding
release. Binding still requires a canonical release manifest, exact-head
authority CI, reviewed merge, successful main CI, and immutable `v2.0.0` tag
over the same bytes.

No release manifest, push, pull request, merge, tag, product repository
change, deployment, traffic, credential, database, Cursor, Checkpoint, or
runtime mutation was performed by this review.
