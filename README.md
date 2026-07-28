# Foigent Event & Connector Specification

This private repository is the single editable authority for the Foigent shared event protocol and Connector conformance governance.

## Current status

- Governance authority: established under B7.
- Protocol version: `1.1.2`.
- B6 independent Go/TypeScript conformance: complete and byte-identical.
- B8 shared contracts and reproducible release tooling: complete.
- B9 UniRouter source and X-Insight projection mappings: complete.
- Binding identity: only the immutable `v1.1.2` tag and its verified release
  manifest; branches and working-tree copies are not authoritative.
- Phase 2A and the completed-execution Reference runtime adoption are closed.
- The additive LiteLLM Connector contract and Conformance Kit were introduced
  in `1.1.0`; `1.1.1` is a coverage-wording erratum. Protocol `1.1.2`
  additionally recognizes the pinned LiteLLM writer's exact string `"None"`
  as the existing normalized cache state `unknown`, while preserving all
  Source/Event Schemas, identities, hashes, cursors, provenance and M0 output.
  Product-local runtime adoption remains independently isolated.
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
`1.0.0`. The immutable release manifest separately binds the exact released
artifacts, compatibility evidence, conformance reports, and three role
approvals.

## Release and consumption gates

- the release manifest must verify all component and approval digests;
- authority CI and an immutable release tag must identify the same bytes;
- UniRouter and X-Insight must pin that release and run the shared Conformance
  Kit in their own CI;
- every product runtime remains separately authorized, deployed, and operated.

See [GOVERNANCE.md](GOVERNANCE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [Decision 0001](docs/decisions/0001-authority-and-governance.md).
