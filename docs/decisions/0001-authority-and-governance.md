# Decision 0001: Shared protocol authority and governance

- Date: 2026-07-27
- Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`
- Status: accepted for B7 governance establishment
- Protocol status: not binding
- Phase 2 status: not authorized

## Decision

Establish the private repository `foigent/event-connector-spec` as the single editable authority for the Foigent shared Event and Connector protocol.

Use a shared protocol plus Connector SDK/conformance model with multiple product-appropriate isolation runtimes. Do not create one universal plugin runtime for UniRouter, Tool Gateway, MCP Gateway, and X-Insight.

The first Reference Connector remains the current UniRouter completed-execution feed. Extraction must preserve its accepted source and X-Insight M0 behavior; it does not become the shared authority by itself.

## Three-party candidate lineage

- Joint Candidate V3: `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- Source Owner V3 confirmation: `494844ef35e63fc1b5f173c024c496087f38bca4ffc936e31226d2d82335cd12`
- Projection Owner V3 confirmation: `c670914cdbf117b527d447e58c6adb3658ee361dc2a1bc954b55f2345786ef63`
- Coordinator non-binding disposition: `add651b694d2a597deca7b164aa3eb658ecf39188637dd513b0f6b8e6d74dc6b`

This lineage proves exact-text alignment only.

## Authority rules

- Shared protocol artifacts are edited only in this repository.
- Binding releases require immutable SemVer, canonical release manifest, SHA-256 artifact digests, independent conformance evidence, compatibility classification, and all three role approvals.
- Product repositories pin exact version and digest and keep their own event model, registry, runtime, IAM, and operational state.
- Repository administrators are custodians, not unilateral semantic owners.
- Mutable delivery state remains outside events and item-linked provenance.

## Explicit non-goals

This decision does not:

- create or freeze Schemas, fixtures, vectors, SDKs, or mapping tables;
- authorize code extraction or Phase 2;
- change either product repository;
- deploy, start, stop, or configure any runtime;
- change credentials, traffic, cursor/checkpoint, or databases;
- reopen the completed Development campaign.

## Remaining gates

- B6: independent Go and TypeScript canonical/hash/replay vectors.
- B8: exact immutable artifacts and release manifest.
- B9: exact UniRouter source mapping and X-Insight projection/compatibility artifacts.
- Final three-party release approval.

B7 is complete at the governance-authority level. Protocol freeze remains incomplete.
