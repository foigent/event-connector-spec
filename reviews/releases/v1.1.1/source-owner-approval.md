# Protocol 1.1.1 Source Domain Owner Approval

Role: `source_domain_owner`

Status: `SOURCE_DOMAIN_OWNER_FINAL_APPROVAL`

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

Protocol `1.1.1` is a wording-only immutable erratum over `1.1.0`. It
corrects the LiteLLM Connector coverage statement without changing the
released `litellm_start_time_boundary_v1` algorithm.

At poll time `T`, the Connector computes the internal UTC-microsecond
eligibility fence `F = floor_microsecond(T - 60s)`. The pinned LiteLLM
`GET /spend/logs/v2` endpoint accepts SQL-style second-precision query times,
so the actual inclusive upstream upper bound is
`Q = floor_second(F)`, sent as `end_date=Q`. The protocol does not claim
microsecond Source-query precision.

Rows with `Q < startTime <= F` are deferred to a later overlapping poll. The
durable Checkpoint cannot advance beyond the greatest row actually returned,
which cannot exceed `Q`; the next query rounds its lower bound down to a whole
second and the Connector applies the exact Checkpoint and boundary request IDs
locally.

The Connector still cannot guarantee zero loss for arbitrary-duration
requests or late Source writes. A row that becomes visible only after the
committed Checkpoint has advanced past its `startTime` remains outside V1
coverage. A future arbitrary-duration lossless design requires a Source cursor
or outbox ordered by terminal visibility, or a separately enforced bounded
duration/write-lag contract.

## Compatibility and verification

The Source Domain Owner verified:

- the candidate commit, tree, and reconstructed content digest above;
- exact preservation of all Schemas, Source/Event and M0 mappings, fixtures,
  Golden identities and hashes, canonical and LiteLLM vectors, conformance
  reports, and Go/TypeScript implementations;
- deterministic LiteLLM artifact generation and upstream evidence;
- 25 Python verification tests with 6 expected skips and schema audit of
  14 Schemas, 2 Manifests, and 5 envelopes/payloads;
- Go tests and vet, TypeScript typecheck/tests/build, and byte-identical
  historical outputs for 30 Reference and 20 LiteLLM cases in each language.

## Boundary

This approval covers only the exact candidate and content digest above. Any
component-byte change requires a new content digest and new three-role review.

It does not authorize or claim product code changes, runtime deployment,
credentials, live LiteLLM access, traffic, database changes, service
operations, or Cursor/Checkpoint mutation.
