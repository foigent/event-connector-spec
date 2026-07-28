# Protocol 1.1.1 Coordinator Approval

Role: `coordinator`

Status: `COORDINATOR_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- repository ID: `1313391565`
- candidate commit: `48b8b055bac547c97243d1d2550c95761c5757d3`
- candidate tree: `ce82ace433de802589b84f77bc6efdeca3f08e79`
- protocol version: `1.1.1`
- reviewed content digest:
  `sha256:c7204f26dbfe313da2da135369346156852ef8bd8d822efeb41359a9fe650651`
- Source Domain Owner approval SHA-256:
  `9a1f5655dce54785d3ae182661a4a2353b35fb4636e284e141da7930348f3599`
- Projection Owner approval SHA-256:
  `b7c1b9236f73b75416dd86575690b2908bb570c1fe5f56417be164a0e14803cc`

## Disposition

No material semantic conflict remains.

The Coordinator independently reviewed the exact five-file candidate and
reproduced its content digest. Protocol `1.1.1` is a coverage-wording erratum
over immutable `1.1.0`; it does not alter the LiteLLM Connector algorithm,
Schemas, Source/Event or X-Insight M0 mappings, Golden identities/hashes,
vectors, reports, or implementations.

The corrected contract distinguishes:

- the internal UTC-microsecond start-time fence
  `F = floor_microsecond(T - 60s)`;
- the pinned LiteLLM endpoint's actual inclusive second-precision query bound
  `Q = floor_second(F)`, sent as `end_date=Q`;
- whole-second query overlap and exact local Checkpoint/boundary-ID selection,
  which defer rather than discard same-second rows above `Q`; and
- the explicit absence of an arbitrary-duration or late-visibility zero-loss
  guarantee without a terminal-visibility cursor/outbox or separately
  enforced duration/write-lag bound.

## Verification and compatibility

The Coordinator confirmed:

- exact candidate commit, tree, and content digest;
- exact preservation of immutable tag `v1.1.0` and its Git object;
- zero diff for Schemas, vectors, conformance reports, mappings, fixtures, and
  Go/TypeScript implementations;
- deterministic LiteLLM artifacts and pinned upstream evidence;
- schema audit, 25 Python tests, Go tests/vet, TypeScript
  typecheck/tests/build, and byte-identical 30 Reference plus 20 LiteLLM
  conformance cases per language; and
- Source Domain Owner and Projection Owner candidate-bound compatibility
  approvals.

## Boundary

This approval authorizes immutable protocol `1.1.1` release assembly, PR/CI,
merge, main CI, and tag publication for the exact candidate above. Any
component-byte change requires a new content digest and three-role review.

It does not authorize or claim product code changes, product CI repins,
runtime deployment, credentials, live LiteLLM access, traffic, database
changes, service operations, or Cursor/Checkpoint mutation.
