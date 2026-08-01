# Protocol 2.0.2 RC1 Coordinator Review

Role: `coordinator`

Status: `COORDINATOR_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact candidate disposition

The Coordinator independently reviewed the exact shared-authority candidate:

- repository: `https://github.com/foigent/event-connector-spec`;
- branch: `codex/v2.0.2-composite-action-portability`;
- content commit:
  `6f729d9a3cf819e5c538ba8bd3a16a85cdc42967`;
- content tree:
  `5fb49fb450257dd1c40e33f6f8358e6dd434a367`;
- candidate manifest:
  `docs/candidates/v2.0.2-rc.1/candidate-manifest.json`;
- candidate manifest SHA-256:
  `sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02`;
- reviewed content digest:
  `sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7`;
- proposed protocol version: `2.0.2`;
- protocol status: `NOT_BINDING`.

The candidate contains `103` unique regular components. It binds immutable
`v2.0.1` as its immediate predecessor:

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

No prior candidate or `v2.0.1` approval is inherited for this gate.

## Independent role evidence

Projection / Consumer Owner evidence:

- status:
  `PROJECTION_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`;
- evidence path:
  `reviews/candidates/v2.0.2-rc.1/projection-owner-review.md`;
- evidence SHA-256:
  `sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed`;
- evidence commit:
  `140dc19f8455ba38949b2b81a356767ccb070792`;
- evidence tree:
  `1891bee63c60394ae39d24829f575ed67c4a18d7`.

Source Domain Owner evidence:

- status:
  `SOURCE_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`;
- evidence path:
  `reviews/candidates/v2.0.2-rc.1/source-owner-review.md`;
- evidence SHA-256:
  `sha256:a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f`;
- evidence commit:
  `e1c2b5966c24dcac67662a768e8e19114f4a959c`;
- evidence tree:
  `f7e3383fcbdf6a6b149d3f8fd1a7b29e147b3773`.

Each role reviewed the same content commit, tree, manifest and digest. The
Source Owner independently executed both the no-`.git` consumer path and the
Git-history-dependent Authority path; it did not derive its conclusion from
the Projection review. The Coordinator independently revalidated the same
objects and executable boundaries before accepting either role record.

## Defect and bounded correction

The real X-Insight consumer job downloaded immutable `v2.0.1` as a GitHub
composite-action snapshot. That snapshot correctly contained the released
files but no `.git` directory. The old action invoked the Authority Release
Kit, whose immutable-predecessor gate starts with `git rev-parse`; the job
therefore failed before current release or product-pin verification.

Giving a product workflow a credential to clone the private authority
repository is not an acceptable correction. It would add an unnecessary
cross-repository secret and would still conflate authority-history proof with
consumer conformance.

The exact candidate separates the responsibilities:

1. The snapshot-safe Consumer Conformance Kit validates current release
   components, approvals, deterministic reports, Schemas, Go and TypeScript
   vectors, cross-language observations and the current v1/LiteLLM
   compatibility base without invoking Git or a predecessor kit.
2. The composite action then runs the existing strict product-pin verifier.
   Relative to `v2.0.1`, that verifier changes only the expected protocol
   version and tag literals. Component-set, component-SHA, approval-evidence,
   content-digest, release-digest, regular-file, no-symlink and path-containment
   checks remain fail closed.
3. The Authority Release Kit remains Git-history-dependent. Authority CI alone
   replays immutable `v1.1.2`, `v2.0.0` and `v2.0.1`, then validates current
   content and separately executes the exact action snapshot without `.git`.

This is a smaller and safer correction than adding credentials, vendoring an
editable protocol copy, or weakening predecessor verification.

## Semantic and compatibility conclusion

A direct Git object diff from immutable `v2.0.1` to the exact candidate is
empty for all Event, Source, Envelope, Schema, vector, fixture, mapping,
Manifest, catalog, compatibility, conformance report, implementation and
Schema-audit semantic trees. The validator independently proves `87`
predecessor components byte-identical and identifies only CI packaging,
release orchestration, version metadata and their tests as changed.

The candidate preserves exactly:

- ten existing UniRouter M0 Event IDs/hashes, eight Gap rows and two
  item-linked provenance IDs;
- five OpenInference M0 Event IDs/hashes and four first-class Gap Events;
- Source hashes, shared Envelope hashes and product-local M0 hashes;
- scoped idempotency and conflict semantics;
- canonical serialization and numeric/time/string rules;
- Operational Receipt lifecycle and data-plane semantics;
- Cursor, Checkpoint and mutable delivery exclusions;
- current UniRouter completed-execution and OpenInference projection/read-model
  compatibility.

No product or runtime behavior changes, and no product adoption is implied.

## SemVer decision

The Coordinator confirms version `2.0.2` and classification
`PATCH_COMPATIBLE_CI_PORTABILITY_FIX`.

The correction restores the already-intended remote composite-action
execution path. It adds no protocol capability, field, accepted value,
identity, hash, canonical form, Connector lifecycle behavior or product
runtime contract. A PATCH release is therefore the smallest truthful SemVer
change. Immutable `v2.0.1` remains unchanged and is the immediate predecessor.

## Independent Coordinator verification

The Coordinator independently performed the following checks against exact
candidate commit `6f729d9...`:

- candidate manifest builder `--check` and `--content-digest` reproduced exact
  digest `sha256:d58e09...`;
- validator passed `103` candidate components, `94` immediate-predecessor
  components and `87` preserved predecessor components;
- candidate and portability tests passed `7/7`;
- semantic Git object diff from `v2.0.1` was empty;
- an independently extracted exact candidate archive contained no `.git` and
  completed the Consumer Kit;
- current v1 and LiteLLM Go/TypeScript results passed `30/30` each and matched
  cross language;
- source-neutral Go and TypeScript each passed two deterministic `83/83` runs,
  matched stored reports and matched across all `29/29` required classes;
- Schema audit passed `24` Schemas, `3` Manifests, `3` delivery modes and `5`
  Source fixtures;
- preserved identities remained exact: v1 `10/8/2` and OpenInference `5/4`;
- Source Owner independently completed the full Authority Kit, replaying
  immutable `v1.1.2`, `v2.0.0`, `v2.0.1` and current candidate evidence.

## Candidate gate and remaining release gate

The three-role candidate gate is satisfied, but protocol `2.0.2` remains
non-binding. Release assembly must still:

1. bind this exact candidate and all three candidate evidence files;
2. create a new exact release-content digest without reusing prior approvals;
3. obtain fresh Projection, Source and Coordinator final approvals over that
   same digest;
4. generate one canonical `releases/v2.0.2/release-manifest.json`;
5. pass exact-head PR CI, reviewed merge and main CI;
6. publish one immutable annotated `v2.0.2` tag over the same tree.

Product adoption remains `NOT_AUTHORIZED` by this review. Runtime mutation is
`NONE`. No product repository, deployment, traffic, credential, database,
Cursor, Checkpoint, worker or service state was modified.
