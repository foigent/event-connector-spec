# Protocol v2.0.1 Coordinator final release approval

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

Role: `coordinator`

Status: `COORDINATOR_FINAL_RELEASE_CONFIRM`

Reviewed content digest: `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

## Exact release-content identity

- Repository: `https://github.com/foigent/event-connector-spec`
- Branch: `codex/v2.0.1-projection-digest-erratum`
- Content commit: `0daadd07ace75afa4233e5a1b28a95f1704e2440`
- Content tree: `d4f6ffc276ff58e5a1225b8dc5e1d01dcdea9933`
- Protocol version: `2.0.1`
- Compatibility: `PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`
- Candidate manifest: `docs/candidates/v2.0.1-rc.1/candidate-manifest.json`
- Candidate manifest SHA-256: `155441d07d25d7b63831072a9ce04dace65ee2be32abb826c89f000c3e18e0e9`
- Immediate predecessor: immutable `v2.0.0`, commit `a8ab25ef8c8dd1c12d073ec0cf23c376f5741744`, tree `981e2516154610c172c6a1607795512ad9c69f30`
- Immediate-predecessor content digest: `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`
- Immediate-predecessor release digest: `sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9`

The superseded `v2.0.1` candidate digest
`sha256:7c4ec2bca634e3904756a6326c471261ada1ec607670acb60792af3b1fcef8e5`
and Projection review SHA-256
`0269bc9b61306199ce60095ed6286cd1857a6070f257694d84e5ed2928d47a93`
are historical and cannot satisfy this release gate.

## Exact independent role evidence

Projection / Consumer Owner:

- Status: `PROJECTION_OWNER_FINAL_RELEASE_APPROVAL`
- Path: `reviews/releases/v2.0.1/projection-owner-approval.md`
- SHA-256: `e316bb81c23f3fc2ccfc8b5006013a52cc823f762802c5b41069437e4ec55a8c`
- Evidence commit: `a2624e311309bc866541954018af289375f2cdee`
- Evidence tree: `06f78595eefb5b405652ace520fc44c8857ecb24`

Source Domain Owner:

- Status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`
- Path: `reviews/releases/v2.0.1/source-owner-approval.md`
- SHA-256: `bd4052092548a2141701a2c901b84f7f892a47ad0670c22f5a5960e745892aa0`
- Evidence commit: `5af88e55811c0ead0f15459090c38375fc476a90`
- Evidence tree: `531d749c635ef50e69caf713a58750c81cb49b3c`

Both role owners independently bind the exact reviewed content digest and
record `Semantic conflict: NONE`, `Product migration: NOT_AUTHORIZED`, and
`Runtime mutation: NONE`. The Coordinator did not author either role record.

## Coordinator semantic and SemVer conclusion

The release is correctly classified as a patch-compatible metadata integrity
erratum. Relative to immutable `v2.0.0`, the only protocol-component change is
one nested SHA-256 value in
`manifests/foigent.openinference.otlp-spans-1.0.0.json`: the stale digest
`sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2`
is replaced by the actual digest
`sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`
of the already released X-Insight projection. The projection bytes do not
change.

All Event, Envelope, Source payload, lifecycle, identity, idempotency, hash,
canonicalization, Capture Gap, provenance, Operational Receipt, Schema,
vector, conformance-report, mapping and product M0 semantics remain unchanged.
The release validator preserves the UniRouter `10/8/2` M0/Gap/provenance
compatibility identities and the OpenInference `5/4` M0/Gap identities. Mutable
delivery, acknowledgement, ingestion, retry, Cursor and Checkpoint state remain
outside Event identity, Event hash and item-linked provenance.

The release governance correctly treats immutable `v2.0.0` as the immediate
predecessor, archives the exact three-role non-binding candidate evidence, and
requires fresh `v2.0.1` final approvals. It cannot inherit `v2.0.0` approvals.
The canonical `releases/v2.0.1/release-manifest.json` remains absent at this
approval step.

## Independent Coordinator verification

The Coordinator independently verified:

- a Git archive of exact content commit `0daadd07...` reproduced content digest
  `sha256:b3fd6a...e3e` before any final approval was considered;
- the content tree and both role-evidence trees match the exact identities
  above, and both approval file SHA-256 values match byte-for-byte;
- the diff from immutable `v2.0.0` contains exactly the one nested Manifest
  digest correction plus versioned release/governance/validation evidence;
  `schemas/`, `vectors/`, `conformance/`, `implementations/`, and `mappings/`
  have no byte diff;
- the release validator passed with 66 candidate components, 93 immediate
  predecessor components, 57 v1 predecessor components, `10/8/2` v1
  identities, `5/4` OpenInference identities, 83 cases, 29 classes,
  `product_migration=not_authorized`, and `runtime_mutation=none`;
- candidate and release Python tests passed `13/13`, and the candidate manifest
  check passed;
- the Schema audit passed 24 Schemas, three Manifests, three delivery modes and
  five Source fixtures;
- the immutable v1.1.2 predecessor kit, current v1/LiteLLM compatibility kit,
  and immutable v2.0.0 predecessor kit completed successfully before the
  current-host disk-space limit was reached;
- current Go tests passed using the bounded reused-cache path, and a fresh
  83-case report matched stored report SHA-256
  `3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- current TypeScript typecheck and `2/2` tests passed using the bounded existing
  Deno cache, and a fresh 83-case report matched stored report SHA-256
  `eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`;
- the fresh Go and TypeScript observations matched for `83/83` cases and
  `29/29` required classes;
- content-digest generation before and after the bounded verification remained
  exactly `sha256:b3fd6a...e3e`.

One combined full-kit invocation was not counted as a pass: it reached the
current Go build after the three predecessor/compatibility kits, Python tests
and Schema audit had passed, then the host filesystem returned
`no space left on device`. No cache or directory was deleted. The missing
current Go/TypeScript stages were rerun independently with existing bounded
caches as recorded above. This environment limitation does not alter the
semantic or governance conclusion, but remains explicit evidence rather than
being hidden by an aggregate PASS claim.

## Approval boundary

This file completes only the local three-role final review gate for the exact
release content above. It does not itself make protocol `2.0.1` Binding.
Binding still requires the canonical release manifest to be generated and
verified from these exact approval bytes, followed by separately authorized
push, pull request, authority CI, reviewed merge, main CI and immutable
`v2.0.1` tag/publication.

No release manifest, push, pull request, merge, tag, publication, product
repository change, migration, deployment, traffic, credential, database,
Cursor, Checkpoint or runtime action was performed by this review.
