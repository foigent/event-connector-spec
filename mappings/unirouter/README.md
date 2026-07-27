# UniRouter Source B9 Release Mappings

Status: `B9_RELEASE_COMPONENT`

This directory contains the released Source Domain Owner mapping from the
current UniRouter completed-execution Reference Connector to the exact B8
artifacts at:

- authority repository: `https://github.com/foigent/event-connector-spec`
- commit: `404d1d753801fd32185eea8163d6a8f839c22a89`
- tree: `9aa5fe3f0e830631dc355d51c654928f97bdbd88`

The mappings remain pinned to the unchanged UniRouter source:

- repository: `https://github.com/foigent/unirouter.git`
- commit: `bf91ea63a16952bb2925afd5438233cac597dcc1`
- tree: `ddadc277fbede49fac0cbc1cc561203312432ac3`

Every shared destination is an exact JSON path in an authority artifact.
UniRouter facts with no lossless shared destination are explicitly classified
as product-local or non-wire; they are not forced into a Connector lifecycle,
Checkpoint, identity, or Event field.

## Exact B8 identities

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

## Files

- `source-snapshot-to-model-request-completed.v1.json` maps all 28 Source
  Snapshot fields and seven Feed wrapper facts to exact Envelope, Payload,
  Capture Gap, Batch, Checkpoint, Manifest, and Source-seed paths, including
  the complete declared-field, scoped-idempotency, Source-hash, Envelope-hash,
  and provenance construction rules.
- `source-lifecycle-to-shared-axes.v1.json` maps Source-local connection,
  credential, duplicate/conflict, and Cursor facts to exact orthogonal
  lifecycle, receipt, Checkpoint, and error paths. Outbox and Feed
  materialization states remain product-local.
- `connector-identity-to-source-local.v1.json` binds the exact Reference
  Manifest, route, capability, source instance, and portable identity while
  preserving project connection, credential, Outbox, and Feed sequence
  identities as product-local.
- `source-contract-seeds.v1.json` pins the exact current Source Schema and
  settled/cancelled fixture bytes and retains the boundary and negative
  requirements already exercised by B6 conformance.

The mapping preserves the existing Source Snapshot bytes and
`snapshot_sha256`, request and billing results, Outbox identity, Feed endpoint,
page DTO, opaque Cursor behavior, activation-forward coverage, revision `1`,
terminal/finality semantics, four fixed capture gaps, and data exclusions.

It does not change UniRouter code, runtime, traffic, credentials, database,
Cursor/Checkpoint state, or product behavior. It also does not change the B8
Schemas, Manifest, canonical/golden metadata, B6 runners, or Go pins.

## Offline validation

```bash
python3 -B scripts/validate_unirouter_source_mappings.py \
  --source-repo /path/to/UniRouter \
  --b8-repo /path/to/exact-authority-worktree \
  --joint-candidate /path/to/joint-candidate-v3.md
```

The validator reads only Git objects at the pinned commits. It verifies exact
B8 artifact bytes and JSON paths, exact current Source seed identities, and
fails closed on legacy symbolic placeholders or obsolete boundary wording.
