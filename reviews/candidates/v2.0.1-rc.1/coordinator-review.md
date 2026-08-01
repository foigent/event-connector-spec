# Protocol 2.0.1 RC1 Coordinator Review

Role: `coordinator`

Status: `COORDINATOR_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility:
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed candidate identity

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2.0.1-projection-digest-erratum`
- reviewed content commit:
  `61e21ee6988814f2d4a785bcf1723f5ce9dc49b1`
- reviewed content tree:
  `9c152180d9132fa279c75b8b6cc4cfaac895d411`
- reviewed content digest:
  `sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba`
- proposed protocol version: `2.0.1`
- protocol status: `NOT_BINDING`
- immutable predecessor tag: `v2.0.0`
- predecessor commit:
  `a8ab25ef8c8dd1c12d073ec0cf23c376f5741744`
- predecessor tree:
  `981e2516154610c172c6a1607795512ad9c69f30`
- predecessor content digest:
  `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`
- predecessor release digest:
  `sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9`

The content commit and digest
`5223ce7536119854645e00d134059f38259e9f36` /
`sha256:7c4ec2bca634e3904756a6326c471261ada1ec607670acb60792af3b1fcef8e5`
and their earlier Projection evidence are superseded and are not inherited.
The reviewed candidate above corrects both evidence defects found during the
first Coordinator review.

## Exact role evidence

Projection / Consumer Owner evidence:

- status:
  `PROJECTION_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`
- evidence path:
  `reviews/candidates/v2.0.1-rc.1/projection-owner-review.md`
- evidence SHA-256:
  `7392bc406bdf5d1252f2e6f45a221713068542b7cbe76e6795de06afab33e18a`
- evidence commit:
  `58734925b167d97f19a6166fd789e45db049c2ec`
- evidence tree:
  `e48efd35086e715991d99a40b5e8199cbb2f8c24`

Source Domain Owner evidence:

- status:
  `SOURCE_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`
- evidence path:
  `reviews/candidates/v2.0.1-rc.1/source-owner-review.md`
- evidence SHA-256:
  `89e1e58dbfedeacc94e5073bf9ad295f23079bb132074e18a51b3cff4da9f5ff`
- evidence commit:
  `f95b4046589d307f984a22a8d04aeabe0e2470be`
- evidence tree:
  `ad4da41fd2b24f7bfaa4a0750d19ced3360ab1be`

Both role reviews independently bind the same content commit, tree, digest,
compatibility class and zero-runtime boundary. Neither reuses the invalidated
candidate identity or immutable `v2.0.0` release approvals.

## Defect and correction disposition

The immutable `v2.0.0` release contains one internally contradictory metadata
reference:

- the release manifest correctly binds
  `mappings/xinsight/openinference-span-to-m0-m0.1-v2.json` at
  `sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`;
- the OpenInference Connector Manifest embeds stale digest
  `sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2`
  for that same path.

The candidate changes the nested Manifest reference to the actual `d5abc...`
digest without changing the referenced projection bytes. It adds a validator
that resolves the exact path and compares its SHA-256, and a negative test
that restores the exact historical `b374...` value and proves fail-closed
rejection. The decision candidate now binds the exact current V2 work item.

No Event, Source, Envelope, Payload, Schema, lifecycle, Receipt, Checkpoint,
Error, canonicalization, identity, idempotency, hash, M0, Gap, provenance,
read-model, vector, report or implementation semantic changed. The five
OpenInference M0 identities/hashes, four OpenInference Gap Events, v1 10/8/2
compatibility identities, Source hash, idempotency key and Envelope hash
remain exact.

## SemVer decision

The Coordinator confirms version `2.0.1` and classification
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`.

Rationale:

- the released projection contract bytes and their semantics do not change;
- the correction makes an internal metadata reference agree with bytes already
  bound by the immutable predecessor release manifest;
- the validator and test prevent recurrence but add no protocol capability or
  product behavior;
- no required field, accepted value, identity, hash, canonicalization or
  compatibility guarantee changes.

The immutable `v2.0.0` tag, release manifest and component bytes must remain
unchanged. The erratum requires a new content digest, three new exact-digest
final approvals, a new release manifest and a new immutable `v2.0.1` tag.

## Independent Coordinator verification

The Coordinator reviewed an immutable archive of content commit
`61e21ee6988814f2d4a785bcf1723f5ce9dc49b1` and independently verified:

- two content-builder runs produced exact digest
  `sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba`;
- candidate and release unit tests passed `12/12`, including exact historical
  stale-reference rejection;
- the release validator passed 60 candidate components, 57 predecessor
  components, v1 `10/8/2`, OpenInference `5/4`, 83 cases and 29 classes;
- Schema audit passed 24 Schemas, three Manifests, three delivery modes and
  five Source fixtures;
- Go tests, vet, build and two deterministic 83-case reports passed and
  matched the stored report byte for byte;
- TypeScript typecheck, tests, build and two deterministic 83-case reports
  passed and matched the stored report byte for byte;
- Go and TypeScript observations matched for all 83 cases and 29 required
  classes;
- the current v1/LiteLLM compatibility kit passed 30/30 base and 30/30
  LiteLLM cases;
- the immutable v1.1.2 predecessor kit and exact release digest passed;
- the existing v2.0.0 builder rejected old Source approval because it does
  not bind the new content digest, proving approval non-inheritance.

## Minimum release-assembly requirements

The candidate review gate is satisfied, but the candidate is not a release.
The minimum local release assembly must:

1. archive this exact candidate identity and all three candidate reviews in a
   canonical v2.0.1 candidate manifest;
2. preserve and independently verify immutable v2.0.0 as the immediate
   predecessor;
3. version the stable specification, release-manifest and product-pin
   metadata to `2.0.1` without changing Event or Connector semantics;
4. bind every released component and all three new final-role approvals in a
   canonical `releases/v2.0.1/release-manifest.json`;
5. run the v1.1.2, v1/LiteLLM, immutable v2.0.0 and v2.0.1 exact release kits;
6. keep product migration `NOT_AUTHORIZED` and runtime mutation `NONE`.

Candidate approval does not authorize push, PR, merge, tag, publication,
product pin adoption, deployment, traffic, credentials, database, Cursor,
Checkpoint or runtime actions.

## Non-binding conclusion

Status remains
`COORDINATOR_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`.

This evidence closes the candidate semantic and SemVer gate only. Protocol
`2.0.1` becomes Binding only after exact release content, three fresh final
approvals, canonical release manifest, authority CI, reviewed merge, main CI
and immutable `v2.0.1` tag all identify the same bytes.

No product repository or runtime state was modified by this review.
