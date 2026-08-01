# Protocol v2.0.2 Corrected Coordinator Final Release Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_RELEASE_CONFIRM`

Reviewed content digest: `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact corrected release-content identity

The Coordinator independently reviewed:

- repository: `https://github.com/foigent/event-connector-spec`;
- branch: `codex/v2.0.2-composite-action-portability`;
- release-content commit: `4ea213cbc109d81a756ed43604a4436986394e60`;
- release-content tree: `a2f4878b7c717b09bd4cd33ca0856eb9666ff2a9`;
- protocol version: `2.0.2`;
- compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`;
- components: `104` unique regular files;
- reviewed content digest:
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`;
- canonical release manifest: `ABSENT`.

This approval binds only the exact commit, tree, component set and content
digest above. Any release-content change invalidates it. Former v2.0.2 content
digest `sha256:ce70c78...`, release digest `sha256:f14810...`, approvals and
canonical manifest are superseded and are not inherited.

## Corrected candidate archive and evidence

The release content archives the exact corrected non-binding candidate:

- candidate commit/tree:
  `c567b15904e1aa67dc33ff8a06c0cce2dface12b` /
  `1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`;
- original corrected candidate-manifest SHA-256:
  `sha256:33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`;
- original corrected candidate digest:
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`;
- three-role archive manifest SHA-256:
  `sha256:cb83e96e852733694dba25e7b8ac9a70f9a9ee22f03ddce3f6b3217a70d36c77`;
- three-role archive content digest:
  `sha256:76fe407299b1385dce689a8767364e7419abc6b3bb5604d7ad270028b3bc8282`.

The archived candidate evidence is distinct and exact:

- Source Owner:
  `sha256:6a68c4da560190bed869495ad8808c66ef156b77e985e80862cfdbb6c8dd0906`;
- Projection Owner:
  `sha256:37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`;
- Coordinator:
  `sha256:8921ba43fceaae49cc402dff4dae3263bf1ded32b9e574f6dc621cbf4b057337`.

No former candidate review is used as final release approval.

## Fresh final role evidence

Projection / Consumer Owner:

- path: `reviews/releases/v2.0.2/projection-owner-approval.md`;
- SHA-256:
  `sha256:bc1fdc37e8cc213dd4812cacf2ef46ce3ff5bf6d56a079c081ff708f770e0cc6`;
- commit/tree:
  `813c0aafc9593fbb30866fcd9e8af26bf39f2719` /
  `296cbe1accb0b3a9402a2fe00164ee4aa30acbef`;
- status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`;
- reviewed digest:
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`.

Source Domain Owner:

- path: `reviews/releases/v2.0.2/source-owner-approval.md`;
- SHA-256:
  `sha256:59c2aae90922cc62a6782fd4618ea619b514ae7170f1ca407abd1c2f77b614cf`;
- commit/tree:
  `65f71dc7ccef8bef1f1c47e1aea35cedc09451b6` /
  `40c05cd1682bfdde5410c84376560bda00fe526f`;
- status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`;
- reviewed digest:
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`.

The Source Owner independently executed both Consumer and Authority paths.
The Coordinator independently reviewed the exact content and evidence bytes;
neither role conclusion is derived from Projection evidence.

## Immediate predecessor and compatibility

The exact immutable predecessor remains `v2.0.1`:

- tag object: `c24531c24955bc700133387dd7352a88e5ba82be`;
- commit/tree:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c` /
  `f967929dd98c5f34cd42fce4aa21489b72b000e0`;
- release-manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`;
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`;
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`.

Immutable archive replay also verifies `v1.1.2` and `v2.0.0`.

A direct Git-object diff from immutable `v2.0.1` to exact release content is
empty for all protocol specifications, Schemas, vectors, fixtures, mappings,
Manifests, compatibility artifacts, conformance reports, implementations,
catalog and Schema-audit semantic trees. The release preserves exactly:

- UniRouter compatibility identities `10/8/2`;
- OpenInference compatibility identities `5/4`;
- Source, Envelope and M0 hash domains;
- scoped idempotency, canonicalization and conflict behavior;
- Capture Gap, provenance and Operational Receipt semantics; and
- Cursor, Checkpoint and mutable delivery exclusions.

## Corrected CI and SemVer conclusion

The generic current-tree workflow is now a governed component at
`sha256:fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`
and invokes only `scripts/run-v1-compatibility-current-kit.sh`. The historical
`run-conformance-kit.sh` remains byte-exact at
`sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`.

The `v1.1.2` current-tree PATCH allowlist is exactly
`{authority_ci_workflow}`; non-allowlisted semantic mutation remains
fail-closed, while immutable archive replay still verifies all predecessor
components. Consumer workflows require neither `.git` nor a private authority
credential; Authority CI alone owns predecessor history proof.

The Coordinator reconfirms `2.0.2` and
`PATCH_COMPATIBLE_CI_PORTABILITY_FIX`. This restores intended CI execution and
adds no protocol capability, field, accepted value, identity, hash, canonical
form, Connector behavior or product-runtime contract.

## Independent Coordinator verification

The Coordinator independently verified:

- release-content digest generation at exact
  `sha256:9dce6081e15be0028441513291808f8d58becb25f00887ae66299031bc79c1c0`;
- `104/104` unique regular release components;
- exact three-role candidate archive and all candidate evidence SHA values;
- fresh Projection and Source final evidence bytes and required tokens;
- validator `104/94/87` and focused tests `9/9`;
- no semantic Git-object changes relative to immutable `v2.0.1`;
- current v1/LiteLLM Go/TypeScript `30/30` and cross-language equality;
- deterministic Source-neutral Go/TypeScript `83/83` and `29/29` required
  classes;
- an exact release-content archive without `.git` completing the Consumer Kit;
- the Authority Kit replaying immutable `v1.1.2`, `v2.0.0`, `v2.0.1` and the
  corrected release content; and
- the release builder rejecting former final approvals before the fresh Source
  and Coordinator approvals were installed.

## Final local release-content disposition

The corrected three-role final content gate is satisfied. One canonical
`releases/v2.0.2/release-manifest.json` may now be generated from these
unchanged bytes and independently verified.

This approval does not itself make `2.0.2` Binding and does not authorize
product adoption or runtime mutation. Binding still requires the canonical
manifest, exact-head PR CI, reviewed merge, main CI, and one immutable annotated
`v2.0.2` tag/release over the same tree. No product repository, deployment,
traffic, credential, database, Cursor, Checkpoint, worker or service state was
modified.
