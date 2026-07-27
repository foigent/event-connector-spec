# UniRouter Source Owner B9 Exact B8 Review

status: `SOURCE_OWNER_B9_RELEASE_CANDIDATE_CONFIRM`

work_item_id: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

owner_role: `UniRouter Source Domain Owner`

material_semantic_conflict: `NONE_IDENTIFIED`

## Reviewed authority identity

- repository: `https://github.com/foigent/event-connector-spec`
- repository_id: `1313391565`
- exact commit:
  `404d1d753801fd32185eea8163d6a8f839c22a89`
- exact tree:
  `9aa5fe3f0e830631dc355d51c654928f97bdbd88`
- identity correction: the earlier `404d1d767c...` value was rejected because
  it is not a local Git object; the Coordinator corrected the authority commit
  to the exact value above without changing the tree or scope.

The integration worktree was used read-only. Every authority artifact was read
from the exact commit with `git show`; uncommitted integration-worktree files
were not used.

Historical protocol text baseline:

- Joint Candidate V3 SHA-256:
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- disposition: incorporated by the exact B8 authority artifacts

## Exact B8 artifact identities reviewed

| Artifact | SHA-256 |
| --- | --- |
| `spec/protocol-v1.md` | `3a0aac41075fde6645c9d07d80416142e4b8de110a0ff429ad96c7df974ed88e` |
| `schemas/event-envelope.v1.schema.json` | `6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26` |
| `schemas/model-request-completed.v1.schema.json` | `ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6` |
| `schemas/capture-gap.v1.schema.json` | `1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8` |
| `schemas/connector-lifecycle.v1.schema.json` | `bd5c730587041ddc7ad6f66bca4deca35edf5f9b5b92b761ac53701f37e18d5e` |
| `schemas/connector-manifest.v1.schema.json` | `a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf` |
| `schemas/event-batch.v1.schema.json` | `8e2133922bcb77cf032309290593665df1bf56cfa47e433dd573d0e42f36eef9` |
| `schemas/connector-checkpoint.v1.schema.json` | `8be2fd290d6db8d288a9b10ac6d9aa0b55a66ff21ea0fb55ac0af2d1b66bf800` |
| `schemas/connector-error.v1.schema.json` | `f449ba6314f1f730be5a0b188dc6d2cc2704e8f5d84a4eebecac576221e4ca56` |
| `schemas/operational-receipt.v1.schema.json` | `3c3b99e009e208456039d3bfe26d84af7e3f1af23589e7fa62a1e1a61e0fb3c6` |
| `manifests/foigent.unirouter.completed-execution-1.0.0.json` | `1d8b70dab02900e9d033ed0de9a5ce0c646d3556b80440a67354367eb83091f7` |
| `reference/unirouter/source-seeds.v1.json` | `5d75d1b1ddf596ae1b3ab3c2690e652e9f6d1b2aef93755c7553552f71f39981` |
| `fixtures/source/unirouter/error-cursor-expired.json` | `9f85ec830e0e61d0ac75656a980793d6d5c4020265d42ed192693659e1540437` |

The accepted independent B6 evidence remains unchanged: Go and TypeScript
match `30/30` cases and `14/14` required classes in the reviewed integration
tree. This B9 task did not edit canonical/golden protocol metadata, B6 reports,
runners, or Go pins.

## Reviewed UniRouter source identity

- repository: `https://github.com/foigent/unirouter.git`
- ref: `origin/main`
- commit: `bf91ea63a16952bb2925afd5438233cac597dcc1`
- tree: `ddadc277fbede49fac0cbc1cc561203312432ac3`

Exact Source seeds:

| Seed | SHA-256 |
| --- | --- |
| `contracts/completed-execution/v1/unirouter.completed-execution.v1.schema.json` | `4ae2897d4f8470c38624dfe21c54d72eaf6d995d2c9578c4420c94d244424fb2` |
| `contracts/completed-execution/v1/fixtures/valid-settled.json` | `5e9eda0a2630d52c5589d38b8ec480604c47c2cc77391b75a57b2a159db6dd27` |
| `contracts/completed-execution/v1/fixtures/valid-cancelled.json` | `31cbfeb23968c07d158b591c28efb3dd40cffba1fd6d1fd4202f43d63bfe9f2d` |

## Source Owner exact mapping disposition

1. Event and Payload: all 28 Source Snapshot fields and seven Feed wrapper
   facts now map to exact Envelope, `model.request.completed`, Capture Gap,
   Batch, Checkpoint, Manifest, or Source-seed JSON paths. Source-only inputs
   are explicitly non-wire. Declared fields, the scoped LP identity tuple,
   absent-tenant four-zero-byte encoding, idempotency output, independent
   Source/Envelope hash domains, and exact provenance profile are explicit.
2. Identity: `event_id=request_id` remains scoped by organization and project.
   The stable `source_instance` binds exact `/producer/instance`,
   `/producer_instance`, and the Manifest `/instance_binding`; project
   connection, credential, Outbox key, and Feed sequence identities remain
   product-local.
3. Lifecycle: project/global stopped facts and credential facts map only to
   valid exact lifecycle enum values. UniRouter Outbox and Feed
   materialization states do not masquerade as Connector `/processing`.
4. Checkpoint and errors: Source receiver acknowledgement remains product-local
   and is not the Consumer durable Checkpoint. Cursor outside retention maps to
   exact Checkpoint error fields and the exact
   `completed_execution_feed.cursor_expired` error form.
5. Operational results: exact same-content duplicates map to
   `/counts/duplicate_noop`; content conflicts map to `/counts/conflict` and
   error `/category=conflict`.
6. Manifest: connector identity, source/payload Schema, event identity profile,
   HTTPS pull route, page DTO, capability, coverage, activation-forward
   bootstrap, opaque Cursor ownership, source revision, timeline/finality,
   metadata-only policy, four gaps, and `7d` retention are exact.
7. Provenance and gaps: Source direct fields, derived linkages, and declared
   constants remain distinct; the four fixed gaps retain the frozen shared
   order and exact field provenance.

## Compatibility proof boundary

The mapping changes no UniRouter source semantics:

- exact Source Snapshot bytes and `snapshot_sha256` remain unchanged;
- request records and billing results remain unchanged;
- transactional Outbox event identity, ordering, terminal semantics, revision,
  and materialization rules remain unchanged;
- Feed endpoint, page DTO, maximum page behavior, data results, opaque Cursor,
  retention behavior, and credential capability remain unchanged;
- activation-forward coverage, settled/cancelled finality, four fixed gaps,
  privacy exclusions, and no-X-Insight-critical-path boundary remain unchanged.

The exact B8 token-counter wire is the decimal-string range
`0..9223372036854775807`. This remains a lossless superset of currently emitted
Source values; it does not retroactively claim that the Source JSON Schema or
PostgreSQL `INTEGER` storage declares that maximum.

## Source-owned release-candidate artifacts

| Artifact | SHA-256 |
| --- | --- |
| `mappings/unirouter/README.md` | `f922ba58abf88ba18eaa2275ed350e7482c607b842dd6e51760525154c8bdcf7` |
| `mappings/unirouter/source-snapshot-to-model-request-completed.v1.json` | `340628c75c2f9523e1b0d5187fd6270403b2d29672d523be3ea8085d7abe06cb` |
| `mappings/unirouter/source-lifecycle-to-shared-axes.v1.json` | `95095328ce8495147c0f65ddd3b81a1c8913e57da2e04f2e2c1efe771e47a858` |
| `mappings/unirouter/connector-identity-to-source-local.v1.json` | `6f30459c063d7a058c93b9e64be3f98c7ccc240fdd024820bcfd8c57c394f98d` |
| `mappings/unirouter/source-contract-seeds.v1.json` | `5de2b2d6322e6a4ae03e3879751016b1350b9bbf967e3f0346e9ebc3cd0f6fb8` |
| `scripts/validate_unirouter_source_mappings.py` | `6adbf5547911f00d1916401c26930609f3c3a12fc9b4dddfbf2e3efb36bf6247` |
| `tests/test_unirouter_source_mappings.py` | `b9fa05d563459d0bce9cc4afb38c009a692d3f7f0610ad22c4c272bde881f14b` |

## Offline verification

The exact-object validator must finish with:

```text
status: ok
release_candidate_status: B9_EXACT_B8_RELEASE_CANDIDATE
artifact_count: 4
field_mapping_count: 28
lifecycle_mapping_count: 21
source_identity_mapping_count: 5
source_seed_count: 3
source_commit_verified: true
source_tree_verified: true
source_seed_bytes_verified: 3
source_evidence_paths_verified: 21
b8_commit_verified: true
b8_tree_verified: true
b8_artifact_bytes_verified: 13
b8_json_path_bindings_verified: 142
joint_candidate_verified: true
```

The unit suite covers duplicate-key rejection, old symbolic placeholder
rejection, exact B8 Digest mutation, product-local lifecycle leakage,
Source-seed mutation, exact Manifest value mismatch, lifecycle-enum mismatch,
absent-tenant identity encoding mutation, and exact Source/B8/V3 Git-object
evidence.

## Final Source Owner statement

status: `SOURCE_OWNER_B9_RELEASE_CANDIDATE_CONFIRM`

remaining_source_blockers: `NONE`

This confirms the Source-owned B9 exact mapping against the reviewed B8
commit/tree. It does not itself publish a shared release, make the protocol
Binding, authorize Phase 2, or authorize runtime/product changes. Shared
release metadata and any final cross-owner/coordinator disposition remain
outside this Source-only commit.

zero_mutation:

- UniRouter product repository files: unchanged
- integration B8 files: unchanged
- runtime, deployment, traffic, credentials, Cursor/Checkpoint, database:
  unchanged
- canonical/golden metadata, B6 runners/reports, Go pins: unchanged
- network action, push, pull request, CI: not performed
