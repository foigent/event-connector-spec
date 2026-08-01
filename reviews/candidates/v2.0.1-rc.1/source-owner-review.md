# Protocol 2.0.1 RC1 Source Domain Owner Review

Role: `source_domain_owner`

Status: `SOURCE_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility:
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

This review supersedes any Source Owner disposition concerning content commit
`5223ce7536119854645e00d134059f38259e9f36` or content digest
`sha256:7c4ec2bca634e3904756a6326c471261ada1ec607670acb60792af3b1fcef8e5`.
Neither superseded identity is approved or inherited.

## Reviewed authority and Projection evidence

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2.0.1-projection-digest-erratum`
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
- superseding Projection review commit:
  `58734925b167d97f19a6166fd789e45db049c2ec`
- superseding Projection review tree:
  `e48efd35086e715991d99a40b5e8199cbb2f8c24`
- Projection review path:
  `reviews/candidates/v2.0.1-rc.1/projection-owner-review.md`
- Projection review SHA-256:
  `sha256:7392bc406bdf5d1252f2e6f45a221713068542b7cbe76e6795de06afab33e18a`
- Projection review status:
  `PROJECTION_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING`

The Projection review stored in the reviewed content commit has historical
SHA-256
`sha256:0269bc9b61306199ce60095ed6286cd1857a6070f257694d84e5ed2928d47a93`.
It is superseded and was not used as current approval evidence. This Source
review binds the corrected Projection evidence identified above separately
from the exact reviewed content object.

## Defect and correction conclusion

The immutable `v2.0.0` release manifest binds
`mappings/xinsight/openinference-span-to-m0-m0.1-v2.json` at its actual
SHA-256:

`sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`.

The released OpenInference Connector Manifest retained the stale nested value

`sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2`.

The exact candidate corrects only that nested digest to `d5abc...`. It does
not change the referenced projection bytes. The candidate also adds a
fail-closed validator that requires the exact path, resolves that file inside
the authority repository and compares its SHA-256. The negative test restores
the exact historical `b374...` value and proves that it is rejected.

Both previously identified evidence defects are closed:

1. the decision candidate now records the exact V2 source-neutral work item;
2. the negative-test description and executable stale input both use the exact
   historical `b374...` digest.

Reviewed changed-component identities are:

- corrected OpenInference Connector Manifest:
  `sha256:363123d5837741ed78c134e305593d3fd0fdf68040cebff068d3f76d5bc62a1b`;
- unchanged X-Insight OpenInference projection:
  `sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`;
- fail-closed release validator:
  `sha256:9a31d23d26ea621f41797a9118289b7f8730109ceb1d894b8e9f48d8aeb61dd8`;
- validator tests:
  `sha256:5c334bdee3267901a49b01fd70b1a377b444891e5aaed9aae9707e67f5f67231`;
- non-binding decision candidate:
  `sha256:f56df3004eea11c83860b361295b22f370929113b0c104711dc6d08777c65a5c`.

## Source-domain and compatibility conclusion

No UniRouter Source-domain semantic changed. Relative to immutable `v2.0.0`,
all normative Schemas, specifications, catalogs, vectors, fixtures, mappings,
conformance reports and implementations are byte-identical. The exact
UniRouter component identities remain:

- Reference Connector Manifest:
  `sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79`;
- Source Snapshot mapping:
  `sha256:5425ab384bebcd9d4a7e81882bfa1bb1700df7cc397863b91f69e2855df12928`;
- Source lifecycle mapping:
  `sha256:1618c86e3d8fae206322e1d928b8b5f0401865623b4267f5b685d7ac02b2968f`;
- Source identity mapping:
  `sha256:0cdbcdcf42658ee12d14ae13ef5d43b54488dca7cec8182055047585eb62e890`;
- UniRouter-to-X-Insight compatibility matrix:
  `sha256:03fb035134b173165e6a03f348d40a58fe1d28d82c24bacb1dec553c8b769c89`.

Therefore the completed-execution Feed coverage, Source Snapshot bytes and
hash, Event and Outbox identities, terminal/finality and revision rules,
Capture Gaps, canonicalization, idempotency, Cursor/Checkpoint exclusions,
endpoint/page/cursor compatibility and Source-owned runtime boundaries remain
unchanged. No product migration is implied.

The correction repairs a contradictory metadata reference without changing
the referenced contract or any Event, payload, lifecycle, identity, hash,
Gap, provenance, receipt or projection semantic. The proposed classification
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM` is confirmed.

## Independent verification evidence

Fresh zero-network verification against an archive of the exact reviewed
content commit produced:

- content digest:
  `sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba`;
- candidate and release tests: `12/12` passed;
- release validator: `60` candidate components, `57` predecessor components,
  `10/8/2` v1 compatibility identities, `5` OpenInference M0 identities,
  `4` OpenInference Gap Events, `83` conformance cases and `29` required
  classes;
- source-neutral artifact check: `5` Envelopes and `83` cases;
- Schema audit: `24` Schemas, `3` Manifests, `3` delivery modes and `5`
  Source fixtures;
- Go: tests, vet, build and two deterministic `83`-case runs,
  each byte-identical to the stored report;
- TypeScript: typecheck, `2/2` tests, build and two deterministic `83`-case
  runs, each byte-identical to the stored report;
- Go/TypeScript comparison: `83/83` cases across `29/29` required classes;
- `git diff --check`: passed.

The existing final-release builder rejected the old Source approval because it
does not bind the new content digest. That is the expected fail-closed result.
A canonical `2.0.1` candidate/release manifest and exact-digest final approvals
remain separate release-governance work.

## Non-binding and zero-mutation boundary

This file records Source Domain Owner candidate evidence only. It does not:

- make protocol `2.0.1` Binding;
- authorize a release, tag, push, pull request or merge;
- authorize product adoption, Schema/SDK/Connector implementation or runtime
  activation;
- authorize deployment, traffic, credentials, database, Cursor, Checkpoint or
  service-state mutation;
- modify immutable `v2.0.0` bytes or its tag.

The review modified only this Source Owner evidence file in the shared
authority worktree. It did not modify a product repository or runtime state.
