# Protocol v2.0.2 Projection Owner Final Release Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`

Reviewed content digest: `sha256:ce70c78af62858fefa29116092299c10dd82f0674922fdc2920e01c32d31152b`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact reviewed release content

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2.0.2-composite-action-portability`
- release-content commit:
  `2e077a03db81c77b7293b885e370045493b35882`
- release-content tree:
  `43812f4deb1534e5cff1511027791f3b85e5b7fa`
- protocol version: `2.0.2`
- compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`
- release components: `103` unique regular files
- canonical release manifest: `ABSENT_NOT_AUTHORIZED_IN_THIS_STEP`

The release-content builder independently produced the reviewed content
digest twice with byte-identical output. This approval binds only the exact
commit, tree, component set and content digest above. Any later content change
invalidates this approval and requires a superseding Projection review.

## Bound candidate gate

The release content archives and validates the exact three-role candidate:

- candidate commit:
  `6f729d9a3cf819e5c538ba8bd3a16a85cdc42967`;
- candidate tree:
  `5fb49fb450257dd1c40e33f6f8358e6dd434a367`;
- original candidate-manifest SHA-256:
  `sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02`;
- original candidate content digest:
  `sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7`;
- three-role candidate archive manifest SHA-256:
  `sha256:303011d8cf8d7fb114451be92fa5573b4640085a05d041f20a9a9f0cb083dfc2`;
- three-role candidate archive content digest:
  `sha256:b2075e4ab9e4a01029322f515b8759ee5901a2902e41c55a9ed6005b0e676387`.

Independent candidate evidence bound by that archive:

- Source Owner:
  `sha256:a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f`;
- Projection Owner:
  `sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed`;
- Coordinator:
  `sha256:5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429`.

No candidate or final approval from `v2.0.1` is reused.

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
- ingestion/payload capture separation and all mutable delivery exclusions;
- all 87 predecessor semantic and non-release-tooling components byte-exact;
- deterministic Go and TypeScript 83/83 source-neutral reports across 29/29
  required classes.

The change remains a PATCH-compatible CI portability repair: Authority history
proof stays in the Authority Kit, while the composite action uses the
snapshot-safe Consumer Kit and strict product-pin verifier without authority
credentials or Git history.

## Verification evidence

Fresh zero-network verification used Go `1.24.3`, Deno `2.7.13`, vendored Go
modules and disabled remote Deno/npm resolution:

- candidate/release-content builders and validator passed deterministically;
- current v1/LiteLLM Go and TypeScript 30-case stored-report and
  cross-language checks passed;
- source-neutral Schema audit passed 24 Schemas, three Manifests, three modes
  and five Source fixtures;
- source-neutral Go tests/vet/reproducible build and two 83-case runs passed;
- TypeScript typecheck/tests/build and two 83-case runs passed;
- stored-report and cross-language comparison passed 83/83 and 29/29;
- exact `git archive` action snapshot contained no `.git` and passed the
  complete Consumer Kit;
- the full Authority Kit replayed immutable `v1.1.2`, `v2.0.0`, exact
  `v2.0.1`, current v1/LiteLLM and exact v2.0.2 release content successfully.

## Remaining release and product boundary

This is Projection Owner final approval evidence only. Protocol `2.0.2`
remains non-Binding until fresh Source Owner and Coordinator final approvals
bind the same content digest, one canonical release manifest is generated and
verified, exact-head authority CI passes, and a separately authorized release
process completes.

This approval authorizes no canonical manifest generation, push, pull request,
merge, tag, publication, product adoption, X-Insight repository change,
deployment, traffic, credential, database, Cursor, Checkpoint, worker or
service-state mutation.
