# Protocol 2.0.2 RC1 Corrected Candidate Projection Owner Review

Role: `projection_owner`

Status: `PROJECTION_OWNER_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact reviewed candidate

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2.0.2-composite-action-portability`
- corrected candidate commit:
  `c567b15904e1aa67dc33ff8a06c0cce2dface12b`
- corrected candidate tree:
  `1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`
- candidate manifest:
  `docs/candidates/v2.0.2-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`
- candidate content digest:
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`
- candidate components: `104` unique regular files
- protocol status: `NOT_BINDING`
- release-content identity: `NOT_ASSEMBLED`
- canonical release manifest: `ABSENT`

Immediate immutable predecessor:

- version/tag: `v2.0.1`
- annotated tag object:
  `c24531c24955bc700133387dd7352a88e5ba82be`
- dereferenced commit:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c`
- tree: `f967929dd98c5f34cd42fce4aa21489b72b000e0`
- release manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`

## Verified PR CI defect

PR #9 exact head `befb83f11ddcb0a2b94bfad581d5f50db65d887e`
failed generic Protocol Conformance job `91365358737`. Its log proves that
`.github/workflows/ci.yml` invoked `scripts/run-conformance-kit.sh`, whose
legacy unittest discovery executed frozen v2.0.1 candidate/release snapshot
tests against the v2.0.2 current tree. The three exact errors were
`authority_readme` archive drift. The direct v2.0.2 validator, focused tests
and separate Source-Neutral release workflow did not identify a protocol
semantic regression.

## Corrected architecture and CI boundary

The corrected generic workflow invokes only
`scripts/run-v1-compatibility-current-kit.sh`, the explicit current v1 and
LiteLLM compatibility scope already reused by the Consumer and Authority
kits. A focused test requires this entry and rejects a return to
`run-conformance-kit.sh` from generic current-tree CI.

The historical `scripts/run-conformance-kit.sh` remains byte-exact at
`sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`
for immutable predecessor replay. The generic workflow is now independently
bound into candidate and release component sets at
`sha256:fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`.

The v1.1.2 current-tree compatibility check allows only its historical
`authority_ci_workflow` component to differ. It still validates the remaining
56 components byte-exact, while the immutable v1.1.2 archive kit continues to
verify all 57 predecessor components from the tag. A negative test proves a
non-allowlisted Event Envelope mutation still fails closed.

## Projection and compatibility conclusion

No Event, Connector, Source, Envelope, payload, lifecycle, Checkpoint, Error,
Operational Receipt, Schema, fixture, vector, report, mapping, M0 Event,
Capture Gap, provenance, identity, idempotency, hash, canonicalization, Cursor
or read-model semantic changed.

The corrected candidate preserves exactly:

- ten Reference Connector M0 IDs/hashes, eight Gap rows, two provenance IDs
  and settled/cancelled read-model expectations;
- five OpenInference M0 IDs/hashes and four first-class Gap Events;
- ingestion/payload capture separation and all mutable-delivery exclusions;
- all 87 non-PATCH v2.0.1 predecessor components byte-exact;
- deterministic Go and TypeScript 83/83 reports across 29/29 required classes.

The change remains a PATCH-compatible CI portability correction. It adds no
product capability and changes no wire or projection semantics.

## Verification evidence

Fresh zero-network verification used Go `1.24.3`, Deno `2.7.13`, vendored Go
modules and disabled remote Deno/npm resolution:

- candidate builder check: `104/104` unique regular components and stable
  content digest;
- v2.0.2 validator: PASS with `94` immediate predecessor components and `87`
  preserved non-PATCH components;
- focused candidate/action tests: `9/9` PASS;
- generic current v1/LiteLLM kit: Go and TypeScript `30/30`, stored-report and
  cross-language comparison PASS; six established optional tests remained
  skipped and no test failed;
- source-neutral Schema audit: 24 Schemas, three Manifests, three modes and
  five Source fixtures PASS;
- source-neutral Go and TypeScript: two deterministic `83/83` runs per
  language, stored-report identity and `29/29` cross-language classes PASS;
- exact `git archive` snapshot: `.git` absent and Consumer candidate kit PASS;
- full Authority Kit: immutable `v1.1.2`, `v2.0.0`, `v2.0.1`, current
  v1/LiteLLM and exact corrected v2.0.2 candidate PASS.

## Superseded evidence and remaining gates

The prior candidate identity `6f729d9...`, release-content digest
`sha256:ce70c78a...`, release digest `sha256:f14810e1...`, all prior v2.0.2
candidate/final approvals and the prior canonical manifest are superseded and
must not be reused.

This document is Projection / Consumer Owner candidate evidence only. Fresh
Source Owner and Coordinator candidate review must bind the exact corrected
candidate above before release content may be assembled. That later exact
release content then requires three fresh final approvals before one canonical
manifest may be generated. Exact-head CI, merge, tag and publication remain
separate gates.

Product migration remains `NOT_AUTHORIZED`; runtime mutation remains `NONE`.
No X-Insight repository, deployment, traffic, credential, database, Cursor,
Checkpoint, worker or service state was changed.
