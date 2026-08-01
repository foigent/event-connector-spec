# Foigent Event & Connector Specification

This private repository is the single editable authority for the Foigent shared event protocol and Connector conformance governance.

## Current status

- Governance authority: established under B7.
- Corrected candidate: `2.0.2`, a patch-compatible CI portability fix over
  `2.0.1`. The prior candidate and final evidence were invalidated by a
  current-tree CI orchestration correction. Fresh exact three-role review,
  final approval, a canonical release manifest and immutable tag are required.
- Independent Go/TypeScript source-neutral conformance: 83/83 cases across
  29/29 required classes with byte-identical results.
- Binding identity: the immutable `v2.0.1` tag and its verified release
  manifest. The `2.0.2` branch and candidate are not authoritative.
- Protocol `2.0.1` is the immediate immutable predecessor for `2.0.2`;
  `1.1.2` remains the preserved v1 compatibility base.
- The additive LiteLLM Connector contract and Conformance Kit were introduced
  in `1.1.0`; `1.1.1` is a coverage-wording erratum. Protocol `1.1.2`
  additionally recognizes the pinned LiteLLM writer's exact string `"None"`
  as the existing normalized cache state `unknown`, while preserving all
  Source/Event Schemas, identities, hashes, cursors, provenance and M0 output.
  Product-local runtime adoption remains independently isolated.
- Protocol `2.0.0` adds source-neutral pull, push, and bounded-offline
  transport contracts plus the OpenInference bounded-offline Reference
  Connector. Product migration and runtime activation remain separately
  gated and are not part of this release.
- Protocol `2.0.1` corrects only the OpenInference Manifest's nested
  X-Insight projection digest to the projection bytes already bound by the
  `2.0.0` release manifest. It changes no Event, Schema, vector, report,
  mapping, identity, hash, Gap, provenance or M0 semantic.
- Protocol candidate `2.0.2` separates the Git-history-dependent Authority
  Release Kit from a snapshot-safe Consumer Conformance Kit. The composite
  action needs no authority checkout, history or consumer credential; all
  protocol and product semantics remain byte-identical to `2.0.1`.
- Runtime credentials, live traffic, checkpoints, cursors, and product
  databases are never protocol-repository content.

The first reference integration remains the existing UniRouter
completed-execution feed. It is a compatibility baseline and Reference
Connector, not the shared protocol authority. The second integration is the
LiteLLM `v1.93.0` spend-log Connector, which proves that the shared protocol
and SDK can add a source without modifying the first Connector.

## Authority scope

This repository may contain:

- shared Event Envelope, Batch, Checkpoint, Receipt, error, and lifecycle contracts;
- immutable release manifests and compatibility mappings;
- canonical cross-language vectors, Golden fixtures, and negative/replay vectors;
- Connector SDK conformance contracts and runner specifications;
- governance decisions and versioning rules.

This repository must not contain:

- product runtime implementations, live credentials, customer data, or deployment state;
- editable product-local copies of shared protocol definitions;
- product-specific IAM, routing, billing, analytics, or UI business logic;
- a universal plugin runtime shared by all products.

Product repositories consume immutable, digest-pinned releases from this authority. Each product retains its own event model, registry identity, execution runtime, and operational lifecycle.

## Current decision lineage

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

- Joint Candidate V3 SHA-256: `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- UniRouter Source Owner V3 response SHA-256: `494844ef35e63fc1b5f173c024c496087f38bca4ffc936e31226d2d82335cd12`
- X-Insight Projection Owner V3 response SHA-256: `c670914cdbf117b527d447e58c6adb3658ee361dc2a1bc954b55f2345786ef63`
- Coordinator disposition SHA-256: `add651b694d2a597deca7b164aa3eb658ecf39188637dd513b0f6b8e6d74dc6b`

These identities record the decision lineage incorporated into protocol
`1.0.0`. The immutable release manifests separately bind the exact released
artifacts, compatibility evidence, conformance reports, and three role
approvals.

## Release and consumption gates

- the release manifest must verify all component and approval digests;
- authority CI and an immutable release tag must identify the same bytes;
- UniRouter and X-Insight must pin that release and run the shared Conformance
  Kit in their own CI;
- every product runtime remains separately authorized, deployed, and operated.

See [GOVERNANCE.md](GOVERNANCE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [Decision 0001](docs/decisions/0001-authority-and-governance.md).
