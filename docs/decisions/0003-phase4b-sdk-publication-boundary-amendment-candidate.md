# Decision 0003: Phase 4B SDK publication-boundary amendment candidate

- Status: candidate, non-binding
- Date: 2026-07-30
- Authorization: local stages 0-2 only
- Parent candidate:
  `313b990a52415971a4fd18c47416a9998cb3c755`
- Parent tree:
  `9ffc6913a67dc389530e35206946acb56b0d88f3`
- Protocol release examined: immutable `v1.1.2`

## Decision

Reclassify SDK `0.1.0-candidate.2` as:

`CHARACTERIZATION_PROTOTYPE_NOT_PUBLICATION_BASELINE`

The candidate proved that deterministic protocol mechanics can converge
across Go and TypeScript without importing product runtime authority. It did
not prove that every extracted parser, compatibility tuple, transition
interface, or in-memory helper belongs in a stable public SDK.

Before any package publication or product consumption, the local successor
candidate must narrow the supported public boundary.

## What remains accepted

This amendment does not reopen or weaken these Phase 4A decisions:

1. `foigent/event-connector-spec` is the unique editable shared authority.
2. The shared library remains pure and source-neutral.
3. Product runtimes retain network, credential, IAM, persistence, scheduling,
   retry, deployment, registry, projection, Cursor and Checkpoint authority.
4. UniRouter Source bytes/outbox/Feed and X-Insight M0/EvidenceStore/read model
   remain product-local.
5. Source hash, Envelope hash, shared idempotency and product-local event hash
   remain separate domains.
6. No universal plugin runtime, dynamic loader, shared database, broker,
   Marketplace or public ingress is introduced.
7. The unchanged released runners remain independent byte authorities until a
   later release explicitly replaces them.

## Boundary correction

### Stable candidate surface

Only the following may be presented as the future stable V0 surface:

- bounded strict parsing for shared protocol wire bytes;
- canonical bytes and hash-domain helpers;
- scoped identity and idempotency construction;
- exact time, decimal-string and Unicode boundary helpers;
- versioned protocol validation whose production entry point requires Domain
  Payload Schema validation;
- immutable validated results or canonical bytes; and
- self-contained Conformance vectors and consumer test adapters.

### Experimental candidate surface

The steady-page convergence/checkpoint planner may remain only under an
explicit `experimental` namespace. Its API is not stable until a third
heterogeneous Connector demonstrates that the transition is source-neutral.

### Product-local surface

The stable shared SDK must not publish provider-owned orchestration ports for:

- fetch;
- normalize;
- commit;
- Checkpoint load/CAS;
- Receipt persistence; or
- Ack.

Products may define narrow local interfaces around the shared pure functions.
The shared repository may retain design examples in non-runtime
documentation, but those examples are not compatibility commitments.

The mutable in-memory replay helper belongs in test tooling only. It must not
be named or presented as a durable production ledger.

## Single-authority correction

Released JSON Schemas and semantic vectors remain the machine-readable
contract authorities. Language implementations may contain checks that JSON
Schema cannot express, but they must have an explicit drift test against the
authority artifacts.

The SDK compatibility catalog must have one digest-pinned data representation.
Go and TypeScript must not each embed an independently editable copy of
product/Connector tuples. SDK code validates the catalog shape, digest and
selected tuple; a catalog update alone must not require reimplementing
canonical or protocol algorithms.

## Fail-closed public API correction

The future production Envelope/Batch entry point must not silently skip Domain
Payload Schema validation. Structure-only inspection, if retained, must have a
name that states its weaker guarantee.

A validated result must not expose mutable backing maps/objects whose content
can change while previously derived identity/hash fields remain unchanged.

All protocol APIs must be versioned before publication so a future protocol
major does not silently change an existing type or parser.

## Evidence for the correction

The parent candidate added 49 files and 55,820 lines. Vendored
`golang.org/x/text` accounts for 49,361 added lines; the remaining candidate
still contains 4,795 lines of core Go/TypeScript implementation. The
handwritten Go and TypeScript protocol validators contain 1,227 and 1,573
lines respectively.

The parent also:

- expresses the compatibility tuples in JSON, Go and TypeScript;
- exports Fetch, Commit, Checkpoint, Receipt and Ack interfaces before a third
  Connector exists;
- exposes a mutable in-memory `ReplayLedger` from the public kernel;
- allows a nil/optional Domain Payload validator;
- exposes mutable parsed protocol values;
- packages tests that assume the authority repository root is present; and
- proves Deno source-tree consumption, not an ordinary Node/npm fresh install.

These facts do not invalidate the local behavior proof. They make publication
without boundary correction premature.

## Versioning impact

The parent candidate's integer-token and year-range choices remain
candidate-only behavior. Under the current governance, changes or
clarifications that alter canonicalization, time meaning, or accepted wire
syntax are semantic and require:

- an explicit SemVer classification;
- cross-language boundary vectors;
- Source Owner approval;
- Projection Owner approval; and
- Coordinator disposition.

No successor SDK may turn its preferred parser behavior into protocol law.

## Required successor work

The local successor candidate must:

1. record the exact JSON-number and timestamp behavior matrix;
2. produce a non-binding semantic and SemVer decision;
3. narrow and version the public SDK surface;
4. replace embedded compatibility copies with one catalog authority;
5. separate experimental page planning and test-only replay state;
6. make production payload validation mandatory;
7. make validated results immutable by construction;
8. qualify self-contained consumer packages outside the authority checkout;
9. add bounded fuzz/property/resource checks; and
10. preserve all released `v1.1.2` bytes unless a later separately authorized
    protocol release is created.

## Non-authorization

This candidate does not authorize:

- push, pull request, merge, tag, release or package publication;
- mutation of immutable `v1.1.2` artifacts;
- product dependency or pin changes;
- product repository changes;
- runtime, database, credential, Cursor, Checkpoint or traffic changes;
- deployment, Development, Target or Production activity; or
- restoration of the retired LiteLLM runtime.

## Owner review questions

### Source Domain Owner

1. Does removing shared orchestration ports preserve Source fetch, Feed,
   outbox, ack, retention and Cursor ownership?
2. Does the proposed stable surface still cover every proven shared Source
   identity/hash invariant?
3. Would any proposed compatibility-catalog validation redefine a
   Source-owned runtime registration?

### Projection / Consumer Owner

1. Does the narrower public surface preserve X-Insight M0, EvidenceStore,
   projection-profile and product-hash ownership?
2. Is mandatory payload validation sufficient to prevent a structure-only
   Envelope from being accepted as production-valid?
3. Does removing shared orchestration ports leave all product persistence and
   convergence atomicity under X-Insight authority?
