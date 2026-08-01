# Protocol v2.0.2 Coordinator Final Release Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_RELEASE_CONFIRM`

Reviewed content digest: `sha256:ce70c78af62858fefa29116092299c10dd82f0674922fdc2920e01c32d31152b`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Exact release-content identity

The Coordinator independently reviewed:

- repository: `https://github.com/foigent/event-connector-spec`;
- branch: `codex/v2.0.2-composite-action-portability`;
- release-content commit:
  `2e077a03db81c77b7293b885e370045493b35882`;
- release-content tree:
  `43812f4deb1534e5cff1511027791f3b85e5b7fa`;
- protocol version: `2.0.2`;
- compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`;
- release components: `103` unique regular files;
- reviewed content digest:
  `sha256:ce70c78af62858fefa29116092299c10dd82f0674922fdc2920e01c32d31152b`.

At the time of this approval, `releases/v2.0.2/release-manifest.json` is
absent. This file approves the exact release content only; any change to those
103 component bytes invalidates this approval.

## Bound candidate and role evidence

The release content archives the exact non-binding candidate:

- candidate commit/tree:
  `6f729d9a3cf819e5c538ba8bd3a16a85cdc42967` /
  `5fb49fb450257dd1c40e33f6f8358e6dd434a367`;
- original candidate-manifest SHA-256:
  `sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02`;
- original candidate digest:
  `sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7`;
- three-role archive manifest SHA-256:
  `sha256:303011d8cf8d7fb114451be92fa5573b4640085a05d041f20a9a9f0cb083dfc2`;
- three-role archive digest:
  `sha256:b2075e4ab9e4a01029322f515b8759ee5901a2902e41c55a9ed6005b0e676387`.

The archived candidate reviews are distinct and exact:

- Source Owner candidate evidence:
  `sha256:a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f`;
- Projection Owner candidate evidence:
  `sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed`;
- Coordinator candidate evidence:
  `sha256:5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429`.

Fresh final approval evidence over release digest `ce70c78...` is also
independent:

- Projection Owner:
  - status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`;
  - path: `reviews/releases/v2.0.2/projection-owner-approval.md`;
  - SHA-256:
    `sha256:cff1887efb650e1badc87ccbca9e892df6e2e55aeaa6205932b3fa80f5ccf156`;
  - commit/tree:
    `755a2bb82d806d297226083bec1557ad3744104e` /
    `fd533b1668ef96a7e1ec95b33ac98f1bd69c2880`;
- Source Domain Owner:
  - status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`;
  - path: `reviews/releases/v2.0.2/source-owner-approval.md`;
  - SHA-256:
    `sha256:ea5d66950f414830444451a3f0a17df388791286bade7067091968e8b572fb13`;
  - commit/tree:
    `eba2d33361f3d0f2cc997cfa11695742fcce26a7` /
    `f95ee667d3d1f4362939d739059072422a39c0e3`.

No candidate approval and no `v2.0.1` final approval is reused as a final
approval for `v2.0.2`.

## Immediate predecessor and compatibility

The exact immediate predecessor remains immutable `v2.0.1`:

- annotated tag object:
  `c24531c24955bc700133387dd7352a88e5ba82be`;
- commit/tree:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c` /
  `f967929dd98c5f34cd42fce4aa21489b72b000e0`;
- release-manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`;
- content/release digests:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e` /
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`.

A direct Git object diff is empty for all shared Event, Connector, Source,
Envelope, Schema, fixture, vector, report, mapping, Manifest, M0, Capture Gap,
provenance, identity, hash, canonicalization, Operational Receipt, Cursor and
Checkpoint semantic artifacts. The release preserves v1 compatibility
identities `10/8/2`, OpenInference identities `5/4`, and all `87` unchanged
predecessor components.

The only behavior repaired is CI packaging: remote composite actions execute
the snapshot-safe Consumer Kit and strict product-pin verifier without Git
history or a private-repository credential. Authority CI alone runs the
Git-history-dependent predecessor chain. The product pin's component/digest,
approval, regular-file, no-symlink and path-containment checks remain strict.

The Coordinator therefore reconfirms `2.0.2` as a PATCH-compatible CI
portability fix, not a protocol semantic release.

## Independent Coordinator verification

The Coordinator independently verified:

- release-content digest generation twice at exact `ce70c78...`;
- `103` unique release components, `94` immediate-predecessor components and
  `87` byte-identical preserved components;
- exact three-role candidate archive and all candidate evidence SHA values;
- fresh Projection and Source final evidence bytes and required approval
  tokens;
- no semantic Git object changes relative to immutable `v2.0.1`;
- candidate/portability tests `7/7`;
- an exact release-content archive without `.git` completing the full Consumer
  Kit;
- current v1/LiteLLM Go and TypeScript `30/30` reports and cross-language
  equality;
- source-neutral Go and TypeScript deterministic `83/83` reports and `29/29`
  cross-language classes;
- Schema audit: `24` Schemas, `3` Manifests, `3` delivery modes and `5` Source
  fixtures;
- the full Authority Kit replay of immutable `v1.1.2`, `v2.0.0`, `v2.0.1`
  and the current release content;
- the release builder failed closed while this exact Coordinator approval was
  absent and did not inherit any earlier approval.

## Final local release-content disposition

The exact three-role final content gate is satisfied. The canonical release
manifest may now be generated once from these unchanged bytes, then verified
before external publication.

This approval does not itself make `2.0.2` Binding and does not authorize
product adoption or runtime mutation. Binding still requires the canonical
manifest, exact-head authority PR CI, reviewed merge, main CI and one
immutable annotated `v2.0.2` tag over the same tree. No product repository,
deployment, traffic, credential, database, Cursor, Checkpoint, worker or
service state was modified by this approval.
