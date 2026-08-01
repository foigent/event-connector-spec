# Protocol v2.0.2 Corrected Projection Owner Final Release Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`

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

The release-content builder independently produced the reviewed content
digest twice before commit and twice again from the exact committed tree. All
four outputs were byte-identical. This approval binds only the exact commit,
tree, component set and content digest above. Any later content change
invalidates this approval.

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

Independent corrected-candidate evidence bound by that archive:

- Source Owner:
  `sha256:6a68c4da560190bed869495ad8808c66ef156b77e985e80862cfdbb6c8dd0906`;
- Projection Owner:
  `sha256:37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`;
- Coordinator:
  `sha256:8921ba43fceaae49cc402dff4dae3263bf1ded32b9e574f6dc621cbf4b057337`.

No prior v2.0.2 candidate or final approval is reused.

## Immediate predecessor

The exact immutable predecessor remains:

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

## Projection compatibility conclusion

No Event, Connector, Source, Envelope, payload, lifecycle, Checkpoint, Error,
Operational Receipt, Schema, fixture, vector, report, mapping, M0 Event,
Capture Gap, provenance, identity, idempotency, hash, canonicalization, Cursor
or read-model semantic changed from immutable `v2.0.1`.

The exact release content preserves:

- ten Reference Connector M0 IDs/hashes, eight Gap rows, two provenance IDs
  and settled/cancelled read-model expectations;
- five OpenInference M0 IDs/hashes and four first-class Gap Events;
- ingestion/payload capture separation and all mutable-delivery exclusions;
- all 87 non-PATCH v2.0.1 predecessor components byte-exact;
- deterministic Go and TypeScript `83/83` reports across `29/29` required
  classes.

The generic current-tree workflow is independently bound at
`sha256:fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`
and invokes only the current v1/LiteLLM compatibility kit. The historical
`run-conformance-kit.sh` remains byte-exact at
`sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`
for immutable predecessor replay.

## Verification evidence

Fresh zero-network verification used Go `1.24.3`, Deno `2.7.13`, vendored Go
modules and disabled remote Deno/npm resolution:

- candidate archive builder, validator and focused tests passed (`9/9`);
- release-content builder produced four byte-identical digest results;
- current v1/LiteLLM Go and TypeScript `30/30` stored-report and
  cross-language checks passed; six established optional tests remained
  skipped and no test failed;
- source-neutral Schema audit passed 24 Schemas, three Manifests, three modes
  and five Source fixtures;
- source-neutral Go tests/vet/reproducible build and two `83/83` runs passed;
- TypeScript typecheck/tests/build and two `83/83` runs passed;
- stored-report and cross-language comparison passed `83/83` and `29/29`;
- exact `git archive` action snapshot contained no `.git` and passed the
  complete Consumer Kit in release-content-candidate mode;
- the full Authority Kit replayed immutable `v1.1.2`, `v2.0.0`, `v2.0.1`,
  current v1/LiteLLM and exact corrected v2.0.2 release content successfully.

## Superseded evidence and remaining release boundary

The former v2.0.2 final approvals binding
`sha256:ce70c78af62858fefa29116092299c10dd82f0674922fdc2920e01c32d31152b`
and the former release digest
`sha256:f14810e19501c65fb9697935bd607695d7e0a2210629907cf748bff78b1f0113`
remain invalid and superseded.

This is fresh Projection Owner final approval evidence only. Protocol `2.0.2`
remains non-Binding until fresh Source Owner and Coordinator final approvals
bind the exact corrected release-content digest, one canonical release manifest
is generated and verified, exact-head authority CI passes, and a separately
authorized release process completes.

This approval authorizes no canonical manifest generation, push, pull request,
merge, tag, publication, product adoption, X-Insight repository change,
deployment, traffic, credential, database, Cursor, Checkpoint, worker or
service-state mutation.
