# Protocol 2.0.2 RC1 Corrected CI Candidate Coordinator Review

Role: `coordinator`

Status: `COORDINATOR_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

## Exact corrected candidate disposition

The Coordinator independently reviewed the corrected shared-authority
candidate:

- repository: `https://github.com/foigent/event-connector-spec`;
- branch: `codex/v2.0.2-composite-action-portability`;
- content commit: `c567b15904e1aa67dc33ff8a06c0cce2dface12b`;
- content tree: `1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`;
- candidate manifest:
  `docs/candidates/v2.0.2-rc.1/candidate-manifest.json`;
- candidate manifest SHA-256:
  `sha256:33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`;
- reviewed content digest:
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`;
- components: `104` unique regular files;
- protocol status: `NOT_BINDING`;
- canonical release manifest: `ABSENT`.

Any change to the commit, tree, Manifest bytes, component set or content digest
invalidates this review. The former `103`-component candidate, content digest
`sha256:d58e09...`, release-content digest `sha256:ce70c78...`, release digest
`sha256:f14810...`, former candidate/final approvals and former canonical
manifest are superseded and are not inherited.

## Independent role evidence

Projection / Consumer Owner evidence:

- path: `reviews/candidates/v2.0.2-rc.1/projection-owner-review.md`;
- SHA-256:
  `sha256:37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`;
- commit: `e5d6a4039d1a68835bc3a929899c97a255f35fd4`;
- tree: `289d14c6b81af2b833f0e2a8ed1ea09b7d311973`;
- status:
  `PROJECTION_OWNER_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`.

Source Domain Owner evidence:

- path: `reviews/candidates/v2.0.2-rc.1/source-owner-review.md`;
- SHA-256:
  `sha256:6a68c4da560190bed869495ad8808c66ef156b77e985e80862cfdbb6c8dd0906`;
- commit: `652663ba58f74d1b2b87450e84a116f6ee79e49c`;
- tree: `0d82066c4d553057e414aafcf9ada683f2f71c55`;
- status:
  `SOURCE_OWNER_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`.

The Source Owner independently reproduced both the no-`.git` Consumer path
and the Git-history-dependent Authority path. The Coordinator did not derive
Source conclusions from Projection evidence and independently revalidated the
same candidate objects and executable boundaries.

## Immediate predecessor integrity

The immutable immediate predecessor remains:

- version/tag: `v2.0.1`;
- annotated tag object: `c24531c24955bc700133387dd7352a88e5ba82be`;
- dereferenced commit: `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c`;
- tree: `f967929dd98c5f34cd42fce4aa21489b72b000e0`;
- release-manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`;
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`;
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`.

Immutable archive replay continues to verify all predecessor bytes for
`v1.1.2`, `v2.0.0` and `v2.0.1`.

## PR CI finding and bounded correction

PR #9 at former head `befb83f...` produced two distinct facts:

1. `Source-Neutral v2.0.2 Release` run `30698522856` passed the full Authority
   predecessor chain and exact no-`.git` Action snapshot.
2. Generic `Protocol Conformance` run `30698522854`, job `91365358737`, failed
   because `.github/workflows/ci.yml` still invoked the legacy
   `scripts/run-conformance-kit.sh`. Its global unittest discovery executed
   frozen v2.0.1 candidate/release snapshot tests against the v2.0.2 current
   tree and reported three `authority_readme` mismatches.

This was a current-tree CI orchestration defect, not a protocol, Source,
Projection, vector or implementation failure. The corrected candidate:

1. makes generic CI invoke only
   `scripts/run-v1-compatibility-current-kit.sh`;
2. binds `.github/workflows/ci.yml` as governed component
   `generic_current_tree_ci_workflow`, SHA-256
   `fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`;
3. adds a focused assertion that rejects any return to
   `run-conformance-kit.sh` from generic CI;
4. preserves the legacy runner byte-exact at
   `sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`;
5. limits the v1.1.2 current-tree PATCH allowlist to exactly
   `{authority_ci_workflow}` while immutable archive replay still verifies all
   57 predecessor components; and
6. proves a non-allowlisted Event Envelope mutation still fails closed.

This is smaller and safer than adding consumer credentials, vendoring an
editable protocol copy, weakening predecessor verification or changing any
wire/runtime contract.

## Semantic and SemVer conclusion

A direct Git-object diff from immutable `v2.0.1` to exact corrected candidate
`c567b159...` is empty for Schemas, specifications, vectors, fixtures,
mappings, Manifests, compatibility artifacts, conformance reports,
implementations, catalog and Schema-audit semantic trees. The validator proves
`87` non-PATCH predecessor components byte-exact.

The candidate preserves exactly:

- UniRouter compatibility: ten M0 Event IDs/hashes, eight Gap rows and two
  provenance IDs/read-model expectations;
- OpenInference compatibility: five M0 Event IDs/hashes and four Gap Events;
- Source, Envelope and M0 hash domains;
- scoped idempotency, canonicalization and conflict semantics;
- Operational Receipt lifecycle and data-plane semantics; and
- Cursor, Checkpoint and mutable delivery exclusions.

Version `2.0.2` with classification `PATCH_COMPATIBLE_CI_PORTABILITY_FIX` is
therefore the smallest truthful SemVer change. No protocol capability, accepted
value, identity, hash, canonical form, Connector behavior or product runtime
contract changes.

## Independent Coordinator verification

The Coordinator independently verified:

- candidate Manifest SHA and content digest reproduced exactly as
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`;
- `104/104` component paths are unique regular files;
- validator passed `104` candidate components, `94` immediate-predecessor
  components and `87` preserved components;
- focused candidate/action tests passed `9/9`;
- semantic directory Git diff from `v2.0.1` is empty;
- current v1/LiteLLM Go and TypeScript results passed `30/30` and matched
  cross-language;
- exact no-`.git` Consumer snapshot passed;
- deterministic Source-neutral Go and TypeScript runs passed `83/83`, matched
  stored reports and matched all `29/29` required classes;
- Authority Kit replayed immutable `v1.1.2`, `v2.0.0`, exact `v2.0.1` and the
  corrected current candidate; and
- the release builder rejects former final approvals because they do not bind
  the corrected content digest.

## Remaining release gate and boundary

The corrected three-role candidate gate is satisfied, but protocol `2.0.2`
remains non-binding. Release assembly must still:

1. bind this exact candidate and all three corrected candidate evidence files;
2. generate a new release-content digest;
3. obtain fresh Projection, Source and Coordinator final approvals over that
   exact digest;
4. generate one canonical release manifest;
5. push the corrected PR head and pass both exact-head workflows;
6. merge only that reviewed head, pass main CI, and publish one immutable
   annotated `v2.0.2` tag/release.

Product adoption remains `NOT_AUTHORIZED`. Runtime mutation remains `NONE`.
This review does not authorize changes to product repositories, deployment,
traffic, credentials, databases, Cursor, Checkpoint, workers or services.
