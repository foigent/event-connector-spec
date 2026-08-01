# Protocol 2.0.1 RC1 Projection Owner Review

Role: `projection_owner`

Status: `PROJECTION_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility:
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority state

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2.0.1-projection-digest-erratum`
- reviewed candidate commit:
  `5223ce7536119854645e00d134059f38259e9f36`
- reviewed candidate tree:
  `28b82703224a63b6d5eb68566354182ae7952a52`
- proposed protocol version: `2.0.1`
- protocol status: `NOT_BINDING`
- reviewed candidate content digest:
  `sha256:7c4ec2bca634e3904756a6326c471261ada1ec607670acb60792af3b1fcef8e5`
- immutable predecessor version/tag: `v2.0.0`
- predecessor commit:
  `a8ab25ef8c8dd1c12d073ec0cf23c376f5741744`
- predecessor tree:
  `981e2516154610c172c6a1607795512ad9c69f30`
- predecessor release digest:
  `sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9`
- predecessor content digest:
  `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`

## Verified defect and correction

The immutable `v2.0.0` release manifest binds
`mappings/xinsight/openinference-span-to-m0-m0.1-v2.json` at its actual
SHA-256:

`sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`.

The released OpenInference Manifest embedded the superseded value
`sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2`
for that same path. The reviewed candidate changes only that nested reference
to `d5abc...`; it does not change the projection bytes.

Reviewed component identities:

- corrected OpenInference Manifest:
  `sha256:363123d5837741ed78c134e305593d3fd0fdf68040cebff068d3f76d5bc62a1b`;
- unchanged X-Insight OpenInference projection:
  `sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`;
- fail-closed release validator:
  `sha256:9a31d23d26ea621f41797a9118289b7f8730109ceb1d894b8e9f48d8aeb61dd8`;
- validator tests:
  `sha256:ab3cccdc0d9978eb8b5dba17f52cc326cccfdcdef60bb9e656b9de3bd4d5cb25`;
- non-binding decision candidate:
  `sha256:5d311cc8528ef30ee90a892aa53d81d9656d02c194d1bfb3981ea538fc3907f4`.

The validator now resolves the Manifest's X-Insight projection path inside the
authority repository and compares the exact referenced digest. Its negative
test restores the stale `b374...` value in memory and proves that the release
validator rejects it. This closes the class of defect in which the top-level
release component list is correct while a nested Manifest reference is stale.

## Projection and compatibility conclusion

No Event, Source, Envelope, payload, lifecycle, receipt, Checkpoint, Error,
canonicalization, identity, idempotency, hash, M0, Gap, provenance or read-model
semantic changed.

The reviewed candidate preserves exactly:

- five OpenInference M0 Event IDs/hashes and four first-class Gap Events;
- ten existing Reference Connector M0 Event IDs/hashes, eight Gap rows and two
  item-linked provenance IDs;
- settled/cancelled read-model expectations;
- the OpenInference Source hash, idempotency key and Envelope hash;
- the separation of `ingestion_capture_mode` and `payload_capture_mode`;
- exclusion of receipt, request, bundle, Cursor, Checkpoint, retry and
  ingestion state from Event identity/hash and item-linked provenance;
- the fail-closed product migration gate for bounded-offline provenance,
  durable Operational Receipt and trace-scoped parent resolution.

The proposed `2.0.1` classification is therefore a patch-compatible metadata
integrity erratum. The immutable `v2.0.0` tag and bytes must not be rewritten.

## Verification evidence

The following zero-network checks passed against the reviewed candidate:

- `python3 -m unittest tests.test_source_neutral_v2_candidate
  tests.test_source_neutral_v2_release`: 12/12 tests;
- source-neutral v2 Schema audit: 24 Schemas, three Manifests, three delivery
  modes and five Source fixtures;
- source-neutral v2 Go: tests, vet, reproducible build and two deterministic
  83-case runs matching the stored report;
- source-neutral v2 TypeScript: typecheck, two tests, build and two
  deterministic 83-case runs matching the stored report;
- Go/TypeScript comparison: 83/83 cases across 29/29 required classes;
- immutable v1.1.2 predecessor kit;
- current v1 compatibility kit;
- release validator: 60 candidate components, 57 predecessor components,
  5 OpenInference M0 identities, 4 OpenInference Gaps and exact v1 10/8/2
  compatibility identities.

The existing `v2.0.0` release-manifest builder did not pass and must not pass
for these changed bytes. It rejected the former Source Owner approval because
that approval does not bind the new content digest
`sha256:7c4ec2bca634e3904756a6326c471261ada1ec607670acb60792af3b1fcef8e5`.
This is the expected fail-closed result; it prevents old approvals from being
reused for the erratum candidate.

## Remaining governance and product boundaries

This review is Projection / Consumer Owner candidate evidence only. It does
not make `2.0.1` Binding and does not authorize a release.

The exact candidate still requires:

1. Source Domain Owner review over the same reviewed content;
2. Coordinator review, exact SemVer disposition and evidence sufficiency;
3. a canonical `2.0.1` candidate/release manifest and three exact-digest final
   approvals;
4. exact-head authority CI and an immutable `v2.0.1` tag only after all release
   gates pass;
5. separate X-Insight product pin adoption and separately authorized runtime
   activation.

No product repository, runtime, deployment, traffic, credential, database,
Cursor, Checkpoint or service state was changed by this review.
