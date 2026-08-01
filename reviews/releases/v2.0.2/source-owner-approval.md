# Protocol v2.0.2 Corrected Source Domain Owner Final Release Approval

Role: `source_domain_owner`

Status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`

Reviewed content digest: `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact reviewed release content

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2.0.2-composite-action-portability`
- release-content commit:
  `4ea213cbc109d81a756ed43604a4436986394e60`
- release-content tree:
  `a2f4878b7c717b09bd4cd33ca0856eb9666ff2a9`
- protocol version: `2.0.2`
- compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`
- release components: `104` unique regular files
- canonical release manifest: `ABSENT_NOT_AUTHORIZED_IN_THIS_STEP`

The release-content builder independently produced the reviewed content digest
twice with byte-identical output. This approval binds only the exact commit,
tree, component set and content digest above. Any later release-content change
invalidates this approval and requires a superseding Source review.

## Bound corrected candidate gate

The release content archives and validates the exact corrected candidate:

- corrected candidate commit:
  `c567b15904e1aa67dc33ff8a06c0cce2dface12b`;
- corrected candidate tree:
  `1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`;
- original corrected candidate-manifest SHA-256:
  `sha256:33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`;
- original corrected candidate content digest:
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`;
- three-role corrected-candidate archive manifest SHA-256:
  `sha256:cb83e96e852733694dba25e7b8ac9a70f9a9ee22f03ddce3f6b3217a70d36c77`;
- three-role corrected-candidate archive content digest:
  `sha256:76fe407299b1385dce689a8767364e7419abc6b3bb5604d7ad270028b3bc8282`.

The archive binds three distinct corrected-candidate reviews:

- Source Owner:
  `sha256:6a68c4da560190bed869495ad8808c66ef156b77e985e80862cfdbb6c8dd0906`;
- Projection Owner:
  `sha256:37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`;
- Coordinator:
  `sha256:8921ba43fceaae49cc402dff4dae3263bf1ded32b9e574f6dc621cbf4b057337`.

Those confirmations remain candidate evidence only. This file is a fresh
Source final approval over the exact corrected release-content digest; no
former candidate or final approval is inherited.

## Separately bound Projection final evidence

- path: `reviews/releases/v2.0.2/projection-owner-approval.md`
- SHA-256:
  `sha256:bc1fdc37e8cc213dd4812cacf2ef46ce3ff5bf6d56a079c081ff708f770e0cc6`
- evidence commit:
  `813c0aafc9593fbb30866fcd9e8af26bf39f2719`
- evidence tree:
  `296cbe1accb0b3a9402a2fe00164ee4aa30acbef`
- status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`
- reviewed digest:
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`

The Projection evidence identity is recorded as a separate governance input.
Its semantic conclusion was not inherited or reused.

## Immediate predecessor integrity

The exact immutable immediate predecessor remains:

- version/tag: `v2.0.1`;
- annotated tag object:
  `c24531c24955bc700133387dd7352a88e5ba82be`;
- dereferenced commit:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c`;
- tree: `f967929dd98c5f34cd42fce4aa21489b72b000e0`;
- release-manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`;
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`;
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`.

The Authority Kit also retained immutable replay of `v1.1.2` and `v2.0.0`.

## Source-domain and compatibility conclusion

No Event, Connector, Source, Envelope, payload, lifecycle, Checkpoint, Error,
Operational Receipt, Schema, fixture, vector, report, mapping, Capture Gap,
provenance, identity, idempotency, hash, canonicalization, Cursor, Feed or
Source finality semantic changed from immutable `v2.0.1`.

A direct Git-object diff from `v2.0.1` to exact release content `4ea213c...`
is empty for all Schema, vector, conformance, mapping, Manifest, fixture,
catalog, compatibility, protocol specification, source-neutral implementation
and Schema-audit directories.

The UniRouter Source baseline remains byte-exact, including completed-execution
coverage, Source Snapshot bytes and source hash, request/Event/Outbox identities,
terminal/finality and revision rules, data policy, endpoint/page/cursor behavior,
and all Cursor/Checkpoint exclusions. Preserved identities include:

- Reference Connector Manifest:
  `sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79`;
- Source Snapshot mapping:
  `sha256:5425ab384bebcd9d4a7e81882bfa1bb1700df7cc397863b91f69e2855df12928`;
- Source lifecycle mapping:
  `sha256:1618c86e3d8fae206322e1d928b8b5f0401865623b4267f5b685d7ac02b2968f`;
- Source identity mapping:
  `sha256:0cdbcdcf42658ee12d14ae13ef5d43b54488dca7cec8182055047585eb62e890`;
- UniRouter compatibility matrix:
  `sha256:03fb035134b173165e6a03f348d40a58fe1d28d82c24bacb1dec553c8b769c89`;
- source-neutral vector bundle:
  `sha256:9e50bb4570dcc1ff07157ad6198641e937357b641ae052cddcb3420b52ad11ed`;
- stored Go report:
  `sha256:3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- stored TypeScript report:
  `sha256:eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`.

## Corrected generic CI boundary

The governed generic workflow remains exact at
`sha256:fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`
and invokes only the current v1/LiteLLM compatibility kit. The immutable
historical `run-conformance-kit.sh` remains byte-exact at
`sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`
for predecessor replay.

The `v1.1.2` current-tree PATCH allowlist remains exactly
`{authority_ci_workflow}`; a non-allowlisted Event Envelope mutation fails
closed. The no-Git Consumer path and the Git-history-dependent Authority path
remain separate without weakening component, approval, product-pin or
predecessor verification.

## Independent verification evidence

Fresh offline verification established:

- exact release-content digest reproduced twice as
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`;
- corrected candidate archive Manifest SHA and content digest reproduced
  exactly, including all three corrected-candidate evidence SHAs;
- validator passed `104` release components, `94` immediate-predecessor
  components and `87` preserved non-PATCH components;
- focused candidate/action tests passed `9/9`;
- Source compatibility evidence remained ten v1 M0 ID/hash pairs, eight Gap
  rows, two provenance IDs, five OpenInference M0 ID/hash pairs and four
  OpenInference Gap Events;
- an exact `4ea213c...` Git archive contained no `.git` and passed the full
  Consumer Kit in release-content-candidate mode;
- current v1/LiteLLM Go and TypeScript stored-report checks passed `30/30` and
  matched cross-language;
- the Source-neutral Schema audit passed 24 Schemas, three Manifests, three
  modes and five Source fixtures;
- deterministic Go and TypeScript Source-neutral runs each passed `83/83` and
  matched stored reports and all `29/29` required cross-language classes;
- the full Authority Kit passed immutable `v1.1.2`, `v2.0.0`, exact `v2.0.1`,
  current v1/LiteLLM and the exact corrected 104-component release content;
- before this file was replaced, the release builder rejected the former
  Source final approval because it did not bind the corrected digest.

The Authority execution used current HEAD only after verifying its sole delta
from `4ea213c...` was the separately bound Projection final evidence file,
outside the 104 governed release-content components.

## Remaining release and product boundary

The former v2.0.2 final approvals binding
`sha256:ce70c78af62858fefa29116092299c10dd82f0674922fdc2920e01c32d31152b`
and the former canonical release manifest are superseded and were not reused.

This is Source Domain Owner final approval evidence only. Protocol `2.0.2`
remains non-Binding until a fresh Coordinator final approval binds the same
corrected content digest, one canonical release manifest is generated and
independently verified, exact-head authority CI passes, and a separately
authorized release process completes.

This approval authorizes no canonical manifest generation, push, pull request,
merge, tag, publication, product adoption, UniRouter repository change,
deployment, traffic, credential, database, Cursor, Checkpoint, worker or
service-state mutation.

Only this Source final approval file was updated in the designated authority
worktree. No release-content component, product repository or runtime state was
modified.
