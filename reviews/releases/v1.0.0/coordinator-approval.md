# Protocol 1.0.0 Coordinator Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_APPROVAL`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- repository ID: `1313391565`
- commit: `302215d6464159734828ca07df30291001e7c808`
- tree: `9f96358d64043108691b55d7c0396c7c80176f96`
- protocol version: `1.0.0`
- reviewed content digest:
  `sha256:e2400b992f7cd35a4485c7d7ad3a9151268d7295f9f0c7a3604fde3ec7f89984`

## Disposition

The release content preserves the agreed architecture:

- products share an Event/Connector protocol, schemas, mappings, SDK
  interfaces, and Conformance Kit;
- products do not share a universal high-privilege plugin runtime;
- the UniRouter completed-execution feed remains the first Reference
  Connector and its current product behavior remains the compatibility
  baseline;
- shared Event identity, idempotency, canonical bytes, hashes, Capture Gaps,
  lifecycle axes, Batch, Checkpoint, Receipt, and error semantics are
  independently versioned and fail closed;
- mutable delivery state remains outside Event identity/hash and item-linked
  provenance;
- X-Insight keeps its current M0 identity/hash/provenance/read-model semantics
  through an explicit projection contract.

No material semantic conflict remains.

## Verification

The Coordinator independently verified:

- 12 shared schemas, one Reference Manifest, and two Envelope/Payload fixtures;
- 30 Go and 30 TypeScript conformance cases with byte-identical reports and all
  14 required result classes;
- exact Go/TypeScript report reproducibility;
- 25 product mapping tests with explicit Git-object inputs and no skips;
- UniRouter Source mappings, lifecycle/identity boundaries, negative tests,
  Source baseline pins, and Reference Manifest bindings;
- X-Insight projection/lifecycle/identity mappings, 10 M0 IDs/hashes, 8 Gap
  rows, 2 provenance IDs, and stable read-model compatibility seeds;
- final Reference Manifest and compatibility matrix component digests;
- a clean authority working tree before the approval request.

The approval covers the exact content digest above. Any component-byte change
requires a new digest and three-role reapproval.

## Boundary

This approval authorizes publication and product CI pinning of protocol
`1.0.0`. It does not authorize Phase 2 runtime extraction, deployment,
credentials, traffic, service operations, Cursor/Checkpoint mutation, or
database changes.
