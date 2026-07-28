# Protocol 1.1.1 Projection Owner Approval

Role: `projection_owner`

Status: `PROJECTION_OWNER_FINAL_APPROVAL`

Compatibility conclusion: `COMPATIBLE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

Reviewed authority state:

- repository: `https://github.com/foigent/event-connector-spec`
- candidate commit: `48b8b055bac547c97243d1d2550c95761c5757d3`
- candidate tree: `ce82ace433de802589b84f77bc6efdeca3f08e79`
- protocol version: `1.1.1`
- reviewed content digest:
  `sha256:c7204f26dbfe313da2da135369346156852ef8bd8d822efeb41359a9fe650651`

## Disposition

Semantic conflict: `NONE_IDENTIFIED`

The Projection Owner independently reviewed the exact five-file candidate
against immutable protocol `1.1.0`. It accurately separates the internal
UTC-microsecond eligibility fence
`F = floor_microsecond(T - 60s)` from the actual inclusive
second-precision upstream bound `Q = floor_second(F)`.

The whole-second lower-bound overlap plus exact local Checkpoint and boundary
request-ID selection preserves later eligibility of same-second rows above
`Q`. The corrected coverage also explicitly excludes zero-loss claims for
arbitrary-duration requests and rows that become visible only after the
Checkpoint has advanced past their `startTime`.

## Compatibility and verification

The erratum changes no Checkpoint algorithm, Schema, Source/Event or X-Insight
M0 mapping, Golden identity/hash, canonical or LiteLLM vector, conformance
report, or implementation byte. It requires no X-Insight runtime, database,
or M0 change.

The Projection Owner confirmed candidate-bound compatibility with the existing
X-Insight projection and product-local identity, hash, idempotency, Gap,
provenance, and read-model semantics. Product CI repinning remains gated on the
immutable `v1.1.1` tag and verified release manifest.

## Boundary

This approval covers only the exact candidate and content digest above. Any
component-byte change requires a new content digest and new three-role review.

It does not authorize or claim product code changes, runtime deployment,
credentials, live LiteLLM access, traffic, database changes, service
operations, or Cursor/Checkpoint mutation.
