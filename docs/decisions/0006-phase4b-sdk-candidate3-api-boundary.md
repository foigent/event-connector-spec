# Decision 0006: Phase 4B SDK candidate.3 API boundary

- Status: candidate, non-binding
- Date: 2026-07-30
- Authorization: local stages 0-2 only
- Implementation parent:
  `89043916a4ecc1706e3cf7a7616e2789bf62942e`
- Implementation parent tree:
  `bdd52f60406d556a7511291028f3b442598c8bf5`
- Depends on: Decisions 0003 and 0005
- Candidate version: `0.1.0-candidate.3`
- Protocol disposition: `V2_SEMANTICS_CANDIDATE_NOT_BINDING`

## Decision

Candidate.3 narrows the shared SDK to deterministic, source-neutral protocol
mechanics. It does not publish a Connector runtime, product workflow, or
v1-compatible replacement.

The future-major wire parser is named and packaged as
`protocol/v2candidate` in Go and `protocol/v2-candidate` in TypeScript. This
prevents the candidate exact-decimal and four-digit-year profile from silently
changing an unversioned or v1 parser.

## Candidate public surface

The stable candidate namespaces are:

- Go `canonical`: bounded strict JSON, canonical bytes, hash domains, identity,
  decimal-string, Unicode, and timestamp helpers;
- Go `compatibility`: load and validate one caller-supplied exact-digest
  compatibility catalog;
- Go `protocol/v2candidate`: immutable validation results for Envelope, Batch,
  Checkpoint, Connector Error, Operational Receipt, and Lifecycle;
- TypeScript `.`, `./canonical`, `./compatibility`, and
  `./protocol/v2-candidate` with the equivalent boundaries.

The TypeScript canonical entry point exports only public byte, hash, identity,
time, Unicode, strict-JSON, and value types. Artifact-structure helpers used
inside the protocol implementation are not package exports.

Go strict-JSON `Value` is opaque and immutable. Its container accessors return
copies, and member replacement returns a new value. Go protocol result fields
are private and byte accessors copy on read. TypeScript parse trees are frozen
recursively; protocol results and Batch event lists are frozen; byte accessors
return copies.

## Explicitly unstable or test-only

- Go `experimental/pageplan` and TypeScript `./experimental/page-plan` are
  source-neutral scalar experiments, not compatibility commitments.
- Go `testkit` and TypeScript `./testkit` own conformance adapters.
- Replay classification exists only under testkit. It is an in-memory test
  helper, not a durable ledger, deduplication store, or product state machine.
- Connector Manifest characterization code is not exported. Released Manifest
  Schema and conformance artifacts remain the authority.

## Mandatory payload-validator boundary

Envelope, Envelope-hash-input, and Batch parsing fails closed when a
`PayloadValidator` is absent. Each Envelope supplies the callback with:

1. exact `schema_ref`;
2. exact `schema_version`; and
3. copy-isolated canonical Payload bytes.

The callback contract requires resolution to immutable local Schema bytes,
offline validation, and return of the verified lowercase Schema SHA-256.
The SDK checks callback presence, invocation, error propagation, and digest
shape, and retains the receipt on the validated Envelope.

This is a delegation boundary, not cryptographic proof of callback honesty.
The SDK cannot determine whether arbitrary consumer code really loaded the
pinned Schema or performed validation. Before product adoption, consumer
qualification must test a concrete offline validator against the
digest-pinned Schema authority and negative Payload fixtures.

## One compatibility authority

The sole tuple data representation is:

`sdk/compatibility-catalog.v1.json`

Its exact candidate digest is:

`sha256:57c02943a7b1b569f4431890cabc5877dae0f84a88c7427fa8f2986956174226`

Go and TypeScript contain the expected authority metadata and digest but no
compiled product/Connector tuple copies. Both loaders require caller-supplied
bytes, reject digest or shape drift, reject duplicates, and fail closed for an
unknown tuple. Loading the catalog does not activate a Connector or mutate a
product registry.

## Product-local boundary

No stable or experimental shared package defines provider-owned Fetch,
Normalize, Commit, Checkpoint load/CAS, Receipt persistence, Ack, retry,
activation-forward, registry, credential, network, database, scheduler,
outbox, M0, EvidenceStore, product provenance, or product Cursor codec.

The experimental page planner receives copied scalar inputs only. It cannot
perform persistence, prove transaction atomicity, or establish product
convergence.

## Productization review

Candidate.3 deliberately does not solve these later gates:

1. **Ordinary consumer packaging.** Deterministic local archives are not proof
   of a fresh Go-module or Node/npm consumer installation. The npm package
   also expects catalog bytes from outside the package; their distribution
   and pin lifecycle need one explicit design before publication.
2. **Schema-validator qualification.** The interface is mandatory, but no
   production adapter is selected or qualified in this stage.
3. **Generated versus handwritten validation.** The future-major wire
   validators still duplicate structural checks already represented by JSON
   Schema. Before publication, the project should choose a generated or
   compiled-Schema core plus a small semantic-extension layer, or explicitly
   accept and test the maintenance cost of handwritten dual-language code.
4. **Internal characterization residue.** Unexported Connector Manifest
   characterization remains for local comparison. It should be removed or
   replaced by the released Schema runner before publication so dead code
   cannot become a second authority.
5. **Robustness qualification.** Bounded fuzz, property, adversarial resource,
   and fresh-consumer tests remain required by Decision 0003.
6. **Major protocol process.** Candidate.3 has no released discriminator,
   negotiation, migration, rollback, or compatibility story and therefore
   cannot be adopted by either product.

These are intentional HOLDs, not evidence that candidate.3 is publishable.
Adding a registry, plugin host, shared orchestration ports, or a universal
runtime would not resolve them and would recreate the over-design rejected by
Decision 0003.

## Acceptance for local stage 2

Local stage 2 is complete only when:

- Go and TypeScript implement the same active number/time boundary vectors;
- released `v1.1.2` authority paths remain byte-identical;
- no shared product workflow ports remain;
- compatibility tuples exist only in the digest-pinned catalog;
- validated results resist caller mutation;
- both language suites, static checks, and deterministic local package checks
  pass from an exact clean commit; and
- Source and Projection Owners confirm the boundary as non-binding.

## Non-authorization

This decision does not authorize:

- push, pull request, merge, tag, release, or package publication;
- a protocol v2 release or any mutation of released v1 artifacts;
- product dependency, pin, repository, runtime, data, Cursor, Checkpoint, M0,
  EvidenceStore, or deployment changes; or
- any external write.
