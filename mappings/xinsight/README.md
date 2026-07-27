# X-Insight B9 release-candidate mappings

Status: `B9_RELEASE_CANDIDATE`

These Projection Owner artifacts bind the first Reference Connector to the
exact B8 authority tree while preserving the current X-Insight M0 `m0.1`
compatibility baseline. They are product-owned mappings and offline evidence;
they do not redefine shared Schema semantics, authorize a runtime change, or
replace product-local registry and EvidenceStore identities.

Authoritative inputs:

- protocol authority:
  `https://github.com/foigent/event-connector-spec`
- exact B8 integration commit:
  `404d1d753801fd32185eea8163d6a8f839c22a89`
- exact B8 integration tree:
  `9aa5fe3f0e830631dc355d51c654928f97bdbd88`
- protocol SHA-256:
  `3a0aac41075fde6645c9d07d80416142e4b8de110a0ff429ad96c7df974ed88e`
- Event Envelope/Payload/Capture Gap Schema SHA-256:
  `6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26`,
  `ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6`,
  `1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8`
- X-Insight `origin/main` commit:
  `c27b39f67b0e72de7f60975ff8b0e94dfc05520f`
- X-Insight `origin/main` tree:
  `16a4930f014c35531b01cc4bd44c25bd29a53ae8`

Artifacts:

- `model-request-completed-to-m0-m0.1-v1.json` — exact
  Source/shared/M0 projection and capture/provenance boundaries.
- `connector-lifecycle-to-current-xinsight-v1.json` — shared lifecycle axes
  projected onto current durable worker, service and read surfaces.
- `portable-connector-identity-to-current-xinsight-v1.json` — portable
  Connector identity projected onto current product-local registry identities.
- `completed-execution-compatibility-seed-v1.json` — synthetic settled and
  cancelled compatibility seeds, including the current ten M0 event
  identities/hashes, eight first-class Gap rows, two import provenance
  identities and read-model expectations, plus exact shared canonical,
  idempotency and Envelope-hash bindings.

Key boundaries:

- shared Event Envelope input is normalized through the versioned projection;
  it is never written directly as an M0 row;
- Manifest `$.payload_policy.ingestion_capture_mode` is a Connector control
  input and remains separate from Event
  `$.data_policy.payload_capture_mode`;
- EventBatch, Checkpoint, OperationalReceipt, retry and service state are
  mutable delivery/operational state and remain outside M0 identity/hash and
  item-linked import provenance;
- the exact Reference Manifest currently pins the earlier mapping digests.
  Updating those two compatibility digests after this local B9 commit is a
  Coordinator release-finalization action, not an M0 semantic change.

Offline verification against the exact B8 Git tree:

```text
FOIGENT_B8_REFERENCE_WORKTREE=/private/tmp/event-connector-spec-integration-b6-b9-20260727 FOIGENT_B8_TREE=9aa5fe3f0e830631dc355d51c654928f97bdbd88 python3 -m unittest tests.test_xinsight_projection_artifacts -v
```
