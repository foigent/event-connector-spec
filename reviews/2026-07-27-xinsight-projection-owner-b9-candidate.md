# X-Insight Projection Owner — B9 Release-Candidate Evidence

Status:
`PROJECTION_OWNER_B9_RELEASE_CANDIDATE_CONFIRM`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`.

This confirmation is limited to the X-Insight Projection/Consumer Owner
responsibility. It confirms that the exact B8 inputs below can be projected to
the current X-Insight M0 `m0.1` baseline without changing current evidence
identity, hash, Gap, provenance or read-model semantics. It does not authorize
Phase 2, deployment, product-repository mutation or runtime action.

## Exact baselines reviewed

- protocol authority:
  `https://github.com/foigent/event-connector-spec`
- exact integration commit:
  `404d1d753801fd32185eea8163d6a8f839c22a89`
- exact integration tree:
  `9aa5fe3f0e830631dc355d51c654928f97bdbd88`
- Joint Candidate V3 SHA-256:
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- X-Insight `origin/main` commit:
  `c27b39f67b0e72de7f60975ff8b0e94dfc05520f`
- X-Insight `origin/main` tree:
  `16a4930f014c35531b01cc4bd44c25bd29a53ae8`

The integration worktree was treated as read-only and every B8 artifact below
was read from the exact Git tree object, so unrelated working-tree changes
could not influence this review.

## Exact B8 artifact identities

| Artifact | SHA-256 |
| --- | --- |
| `spec/protocol-v1.md` | `3a0aac41075fde6645c9d07d80416142e4b8de110a0ff429ad96c7df974ed88e` |
| `schemas/event-envelope.v1.schema.json` | `6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26` |
| `schemas/model-request-completed.v1.schema.json` | `ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6` |
| `schemas/capture-gap.v1.schema.json` | `1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8` |
| `schemas/connector-lifecycle.v1.schema.json` | `bd5c730587041ddc7ad6f66bca4deca35edf5f9b5b92b761ac53701f37e18d5e` |
| `schemas/connector-manifest.v1.schema.json` | `a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf` |
| `schemas/connector-checkpoint.v1.schema.json` | `8be2fd290d6db8d288a9b10ac6d9aa0b55a66ff21ea0fb55ac0af2d1b66bf800` |
| `schemas/connector-error.v1.schema.json` | `f449ba6314f1f730be5a0b188dc6d2cc2704e8f5d84a4eebecac576221e4ca56` |
| `schemas/event-batch.v1.schema.json` | `8e2133922bcb77cf032309290593665df1bf56cfa47e433dd573d0e42f36eef9` |
| `schemas/operational-receipt.v1.schema.json` | `3c3b99e009e208456039d3bfe26d84af7e3f1af23589e7fa62a1e1a61e0fb3c6` |
| `manifests/foigent.unirouter.completed-execution-1.0.0.json` | `1d8b70dab02900e9d033ed0de9a5ce0c646d3556b80440a67354367eb83091f7` |
| `catalog/domain-catalog.v1.json` | `93d4c55dd181a7e168d17b90bc8527b89e6d2e3c1eac0549bd7a34e1857e3a06` |
| `vectors/canonical-vector-bundle.v1.json` | `98659630f3e1238d2684c2b4cba728334f4bdace67ff033652676d9d505caf33` |
| `fixtures/golden-fixture-bundle.v1.json` | `b56de610d4444b655e3f700e61ec490caa1fc1d8658db1660192686c0fc1a268` |
| `conformance/conformance-contract.v1.json` | `f3ae834265170ff22088943283fd23dcb562bc2308571ccc722414c2c896dc23` |
| `conformance/reports/go-v1.json` | `b80d90f62804b64a49396df51cc98dbdd37378f91f02483b76a2200cd0f9aea2` |
| `conformance/reports/typescript-v1.json` | `fb4bbfd8ab14f1175e31bdb28e1240dc9a84e6effcec28c95c59595e87723d57` |

The accepted B6 reports match `30/30` cases and `14/14` required classes.

## Exact projection disposition

### Event, time and numeric semantics

- `$.time.observed_at` is absent on the Reference parent Event.
- `$.time.occurred_at` is only a deterministic alias of
  `$.time.terminal_at`. Current M0 `occurred_at` and `observed_at` remain
  target-local emissions of that terminal instant.
- Fetch, receive, batch generation, checkpoint update and Consumer ingestion
  time remain outside the Event.
- Token counters remain canonical nonnegative decimal strings on the wire and
  are losslessly parsed to current signed `int64` M0 values only after grammar
  and `9223372036854775807` upper-bound validation.
- Protocol-controlled strings are NFC-validated; Source-derived opaque UTF-8
  remains byte-preserved and is neither normalized silently nor rejected only
  for being non-NFC.

### Capture, Gap and provenance semantics

- Connector ingestion capture is the exact Reference Manifest control
  `$.payload_policy.ingestion_capture_mode=api_import`; it is not Event
  content.
- Parent payload capture is Event
  `$.data_policy.payload_capture_mode=metadata_only`; each Gap uses
  `$.payload.capture_gaps[*].payload_capture_mode=none`.
- Each accepted Source item still projects to one terminal M0 event, four
  first-class Gap M0 events and four first-class Gap rows.
- Contracted-pull item provenance remains bound only to immutable source
  payload SHA-256, revision `"1"`, terminal time and
  `timeline_complete=true`. Source/import watermarks remain empty.
- Batch cursor, high-watermark, generated/observed/update time, retry state and
  worker/service state remain Connector checkpoint/status or non-event-linked
  operational receipt values. They never enter normalized M0 identity/hash or
  item-linked provenance.

### Identity, lifecycle and local ownership

- Portable Connector/Manifest identity is bound to the exact
  `source_instance`/Event `$.producer.instance`/Checkpoint
  `$.producer_instance` UTF-8 identity domain.
- Portable identity does not replace current fixed `source_system_id`,
  `adapter_manifest_id`, projection profile, cursor key, credential binding or
  authorization reference.
- Configuration, authentication, transport, processing, checkpoint and health
  remain six independent shared axes. Current adapter, worker, service and
  investigation state is explicitly classified as exact mapped state,
  derived state, or product-local non-wire state.
- Current APIs/UI still do not expose a combined Connector lifecycle read
  model. That remains a future product implementation gap, not a B9
  compatibility change.

## Exact compatibility gate

The synthetic settled/cancelled compatibility bundle preserves and
independently recomputes:

- 10 current M0 event IDs and hashes;
- all 10 Source refs, local idempotency keys and import cursors;
- 8 first-class Gap row IDs and stable fields;
- 2 immutable import provenance IDs and all 10 event links;
- 2 deterministic execution IDs and all pinned read-model expectations.

The byte-stable compatibility payload comprising `synthetic_only`, `seeds`,
`compatibility_totals` and `cross_seed_read_model` has SHA-256
`d22374a34e4f496cc05f7e56e7538cd2f3fc4bb3d9428cd9ac38883a81a909b5`.
Shared LP idempotency and Envelope hashes are validated separately and do not
replace current target-local M0 identities or hashes.

## Semantic conflict assessment

No material Projection Owner conflict was found against the exact B8 tree.

One release-metadata follow-up remains: the exact Reference Manifest reviewed
here still contains the earlier candidate SHA-256 pins for the X-Insight
projection and compatibility mapping files. After this B9 local commit, the
Coordinator must repin those two Manifest compatibility digests and finalize
shared release metadata. This is outside Projection Owner scope and does not
alter Event, M0, Gap, provenance, replay or read-model semantics.

## Verification boundary

The local commit is gated on:

- JSON parsing for all four X-Insight mapping files;
- exact-tree SHA-256 verification for every B8 artifact used by the mapping;
- rejection of prior waiting/unknown-field statuses and disclaimers;
- byte-stable compatibility payload digest;
- independent reconstruction of all 10 M0 IDs/hashes, 8 Gap-row IDs, 2
  provenance IDs and read-model expectations;
- `git diff --check`.

Recorded offline result:

- full Python discovery: `18 tests`, `OK`, with two unrelated optional
  Source/Joint path checks skipped because their environment variables were
  not supplied; the exact B8 tree check was supplied and passed;
- shared candidate verifier: `2 envelopes`, `4 identities`, passed;
- all four X-Insight JSON mapping files parsed successfully;
- `git diff --check`: passed.

No live data, database, service, worker, endpoint, deployment or CI
verification is required or authorized.

## Zero mutation

This work:

- changed only the designated authority worktree
  `/private/tmp/event-connector-spec-b6-typescript-20260727` on
  `codex/b6-typescript`;
- used only synthetic fixtures and exact Git-object evidence;
- did not modify `/Users/m4/Desktop/projects/X-Insight`;
- did not modify shared B8 Schema, Manifest, protocol, canonical/golden vector,
  conformance-contract or TypeScript runner pins;
- did not deploy, start/stop/restart a service, run a worker, send traffic,
  access credentials, mutate Cursor/Checkpoint or touch a database;
- did not push, open a PR or run CI.
