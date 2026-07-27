# UniRouter Source Owner B9 Candidate Evidence

status: `SOURCE_OWNER_B9_CANDIDATE_NOT_BINDING`

work_item_id: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

owner_role: `UniRouter Source Domain Owner`

## Scope and authority

This record covers only the first bounded Source Owner deliverable for B9. It
records source-owned mappings and immutable current-source seed identities. It
does not freeze B8, close B9, make the protocol binding, authorize Phase 2, or
authorize any runtime or product mutation.

Authority repository:

- repository: `https://github.com/foigent/event-connector-spec`
- repository_id: `1313391565`
- base commit: `5036659978c74922342c5d59a3c830a35c7ffe3b`
- base tree: `d1d69476ece61e11c025c7aa2f294e88623f1ae6`
- working branch: `codex/b6-b9-source`

Reviewed joint candidate:

- path:
  `/Users/m4/Desktop/projects/UniRouter-X-Insight Cooperation/decisions/2026-07-27-foigent-event-connector-platform-v1-phase1-joint-decision-candidate-v3.md`
- SHA-256:
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- status: `JOINT_DECISION_CANDIDATE_V3_NOT_BINDING`

Reviewed UniRouter baseline:

- repository: `https://github.com/foigent/unirouter.git`
- ref: `origin/main`
- commit: `bf91ea63a16952bb2925afd5438233cac597dcc1`
- tree: `ddadc277fbede49fac0cbc1cc561203312432ac3`
- subject: `fix(completed-feed): align terminal timestamp precision (#237)`

## Source-owned candidate artifacts

| Artifact | SHA-256 |
| --- | --- |
| `mappings/unirouter/README.md` | `8f1432f8fba04688b09f2b5e8839f264bd8828d5103a9be262aa03b8a1090902` |
| `mappings/unirouter/source-snapshot-to-model-request-completed.v1.json` | `a13a2fa04e0f2ae86c78eb3499795162627aad01cba0e5e0771da130beea2f7c` |
| `mappings/unirouter/source-lifecycle-to-shared-axes.v1.json` | `fd3a9099c3c9c4bc105d7e231d23181927fcec98fa0b00d13e071cb529be28a2` |
| `mappings/unirouter/connector-identity-to-source-local.v1.json` | `53687f61c645b4758392380b97326e1432ca0f71a080b9afb3d16fb615dccf69` |
| `mappings/unirouter/source-contract-seeds.v1.json` | `ec234a7b2995d1a3044767411853c2f79111e9f957407de07fe24c4f12bdff81` |
| `scripts/validate_unirouter_source_mappings.py` | `1f7db91b6ab21eeeaee061ac3fe2b1c9bf56dcf310760d54b1ca3cfcd831eac8` |
| `tests/test_unirouter_source_mappings.py` | `89cda8c2fa2aa56461f9898a84bced622db07c90d75a37ddb67c46e63cd36d73` |

The four JSON artifacts use
`artifact_format=foigent.source-mapping-candidate.v1` and
`status=B9_SOURCE_CANDIDATE_NOT_BINDING`. They refer to V3 semantic fields
without defining Envelope, Batch, Checkpoint, Cursor, Manifest, or shared
Payload schemas.

## Evidence covered

The candidate artifacts record:

1. all 28 fields in the exact current
   `unirouter.completed-execution.v1` Source Snapshot, plus the feed wrapper
   projection and exact source-byte/source-hash boundary;
2. source lifecycle, transactional outbox, feed transport, authentication, and
   acknowledgment facts mapped onto V3's orthogonal axes without collapsing
   them into one state machine;
3. the portable connector identity candidate mapped to current UniRouter
   request, outbox, feed-item, connection, credential, route, capability, and
   `source_instance` identities;
4. activation-forward coverage, settled/cancelled terminal semantics, revision
   `1`, the four fixed capture gaps, and the exclusions for cursor, checkpoint,
   connector processing, consumer projection, and runtime health;
5. the exact current source JSON Schema and settled/cancelled fixture byte
   identities, plus fail-closed boundary and negative-test requirements.

Current source seeds:

| Seed | SHA-256 |
| --- | --- |
| `contracts/completed-execution/v1/unirouter.completed-execution.v1.schema.json` | `4ae2897d4f8470c38624dfe21c54d72eaf6d995d2c9578c4420c94d244424fb2` |
| `contracts/completed-execution/v1/fixtures/settled.json` | `5e9eda0a2630d52c5589d38b8ec480604c47c2cc77391b75a57b2a159db6dd27` |
| `contracts/completed-execution/v1/fixtures/cancelled.json` | `31cbfeb23968c07d158b591c28efb3dd40cffba1fd6d1fd4202f43d63bfe9f2d` |

## Verification

The validator was executed offline against the pinned UniRouter Git objects and
the exact V3 bytes:

```text
status: ok
artifact_count: 4
field_mapping_count: 28
lifecycle_mapping_count: 21
source_identity_mapping_count: 5
source_seed_count: 3
source_seed_bytes_verified: 3
source_evidence_paths_verified: 21
source_commit_verified: true
source_tree_verified: true
joint_candidate_verified: true
```

The standard-library unit suite completed with `6 tests` and `OK`. It includes
fail-closed checks for duplicate JSON object keys, source seed digest mutation,
and an attempted invented B8 schema key, plus verification of the exact V3 and
UniRouter Git-object evidence when their paths are explicitly supplied.

No live data, network endpoint, credential, cursor, checkpoint, database, or
runtime state was read or mutated by these checks.

## Semantic review

material_semantic_conflict: `NONE_IDENTIFIED`

One source precision boundary must remain explicit in B8 and B9 evidence:

- the current Go snapshot counters are `int`;
- the current source JSON Schema requires JSON integers at or above zero but
  does not declare a maximum;
- the current journal storage uses PostgreSQL `INTEGER`;
- V3's shared canonical counter wire allows decimal strings over
  `0..9223372036854775807`.

The V3 shared wire range is therefore not contradicted by currently emitted
source values, but it is a shared-wire range rather than an exact statement of
the current source field type or storage limit. A future authoritative B8
artifact must preserve that distinction and must not retroactively claim that
the current source schema declares the V3 maximum.

## Remaining blockers

- B8 remains open: no authoritative Envelope, Batch, Checkpoint, Manifest, or
  shared Payload artifacts have been supplied or frozen.
- B6 remains open: independent Go and TypeScript canonicalization/hash vectors
  cannot start until the exact coordinator-authored B8 candidate/vector bundle
  is supplied.
- B9 remains open: this Source Owner candidate still needs authoritative B8
  references, independent conformance evidence, Projection Owner review, and
  coordinator disposition before freeze.

zero_mutation:

- UniRouter product repository files: unchanged
- runtime, deployment, traffic, credentials, cursor/checkpoint, database:
  unchanged
- push, pull request, CI: not performed
- protocol binding or Phase 2 authorization: not granted
