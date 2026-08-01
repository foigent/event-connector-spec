# Protocol 2.0.2 RC1 Source Domain Owner Review

Role: `source_domain_owner`

Status: `SOURCE_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority and separate Projection evidence

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2.0.2-composite-action-portability`
- reviewed candidate commit:
  `6f729d9a3cf819e5c538ba8bd3a16a85cdc42967`
- reviewed candidate tree:
  `5fb49fb450257dd1c40e33f6f8358e6dd434a367`
- candidate manifest:
  `docs/candidates/v2.0.2-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02`
- reviewed content digest:
  `sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7`
- proposed protocol version: `2.0.2`
- protocol status: `NOT_BINDING`

Immediate immutable predecessor:

- version/tag: `v2.0.1`
- annotated tag object:
  `c24531c24955bc700133387dd7352a88e5ba82be`
- dereferenced commit:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c`
- tree: `f967929dd98c5f34cd42fce4aa21489b72b000e0`
- release manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`

Separately bound Projection evidence:

- evidence commit:
  `140dc19f8455ba38949b2b81a356767ccb070792`
- evidence tree:
  `1891bee63c60394ae39d24829f575ed67c4a18d7`
- path:
  `reviews/candidates/v2.0.2-rc.1/projection-owner-review.md`
- SHA-256:
  `sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed`
- status:
  `PROJECTION_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`

The Projection evidence identity is recorded as a separate governance input.
Its semantic conclusion was not inherited or reused. This Source review was
performed independently against the exact candidate commit, tree, manifest,
component bytes and executable kits above.

## Source-domain and byte-compatibility conclusion

No Source-domain semantic conflict was identified. A direct Git object diff
between immutable `v2.0.1` and the exact candidate is empty for `schemas/`,
`vectors/`, `conformance/`, `mappings/`, `manifests/`, `fixtures/`, `catalog/`,
`compatibility/`, `spec/`, both source-neutral implementations and the Schema
audit. The candidate changes CI packaging, orchestration, release metadata and
their tests only.

The following Source and shared semantic component identities remain exact:

- protocol specification:
  `sha256:4a8efd02b07c29f4ce19fb30bd5fa9f256254ba6cfe92420bf8e6a268b22702d`;
- Event Envelope Schema:
  `sha256:6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26`;
- Capture Gap Schema:
  `sha256:1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8`;
- Checkpoint Schema:
  `sha256:80bf1e98b24424a25a14985f36aa179c838363c4deb540c7521b20582eccdd6b`;
- Operational Receipt Schema:
  `sha256:d2d091c2571d54df7a65329da049f13a4d7465af38b7916e4ae79e57255a04b6`;
- UniRouter Reference Connector Manifest:
  `sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79`;
- Source Snapshot mapping:
  `sha256:5425ab384bebcd9d4a7e81882bfa1bb1700df7cc397863b91f69e2855df12928`;
- Source lifecycle mapping:
  `sha256:1618c86e3d8fae206322e1d928b8b5f0401865623b4267f5b685d7ac02b2968f`;
- Source identity mapping:
  `sha256:0cdbcdcf42658ee12d14ae13ef5d43b54488dca7cec8182055047585eb62e890`;
- UniRouter compatibility matrix:
  `sha256:03fb035134b173165e6a03f348d40a58fe1d28d82c24bacb1dec553c8b769c89`;
- source-neutral vector bundle:
  `sha256:9e50bb4570dcc1ff07157ad6198641e937357b641ae052cddcb3420b52ad11ed`;
- stored Go report:
  `sha256:3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`;
- stored TypeScript report:
  `sha256:eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`.

Therefore Source Snapshot bytes/hash, completed-execution coverage, Event and
Outbox identity, scoped idempotency, canonicalization, terminal/finality and
revision rules, Capture Gap and provenance semantics, Receipt behavior,
Cursor/Checkpoint exclusions, Feed endpoint/page/cursor behavior and current
UniRouter compatibility identities remain unchanged.

## Consumer, product-pin and Authority Kit conclusion

The immutable `v2.0.1` composite action invoked a Git-history-dependent
Authority Release Kit from a downloaded action snapshot. The reviewed fix
separates that responsibility without weakening consumer verification:

1. The composite action invokes the Consumer Conformance Kit with `--release`
   from `GITHUB_ACTION_PATH`. The Consumer and Current Release kits contain no
   Git command and invoke no predecessor kit.
2. After the Consumer Kit, the action still invokes the strict product-pin
   verifier. Relative to `v2.0.1`, that verifier changes only the two expected
   version/tag literals from `2.0.1`/`v2.0.1` to `2.0.2`/`v2.0.2`.
3. The verifier still requires the exact release-manifest format, authority,
   release content digest, three confirmed approval roles and evidence SHA,
   release digest, product/version/release pin, exact product component set,
   every component SHA, regular non-symlink files and paths contained beneath
   the action root.
4. The Source product pin continues to require all 19 exact Source/shared
   components, including the Reference Manifest, Source mappings, Event,
   lifecycle, Checkpoint, Error and Receipt Schemas, vector bundle and
   Consumer Kit digest.
5. The Authority Release Kit remains Git-history-dependent and independently
   replays the immutable `v1.1.2`, `v2.0.0` and immediate `v2.0.1` tag,
   commit, tree, archive and release-manifest evidence before current content.

An archive made directly from exact candidate commit `6f729d9...` contained no
`.git` directory and passed the complete Consumer Kit. The candidate's own
action-snapshot kit also proved that the extracted action snapshot contains no
Git metadata and successfully executed the same Consumer Kit.

## SemVer conclusion

The proposed `2.0.2` patch version is correct. The candidate repairs a broken
CI consumption path while keeping all protocol, Source, Event, mapping,
identity, hash, Receipt, Cursor and Checkpoint semantics byte-identical to
`2.0.1`. It introduces no new required field, changes no field meaning, wire
identity, canonical form, SDK behavior or product runtime contract. The
classification `PATCH_COMPATIBLE_CI_PORTABILITY_FIX` is confirmed.

## Independent verification evidence

Fresh local verification used Go `1.24.3`, Deno `2.7.13`, vendored Go modules,
no remote Deno/npm resolution and no authority credential:

- candidate commit/tree and immutable predecessor tag/commit/tree: exact;
- candidate manifest SHA-256: exact;
- candidate content digest: independently reproduced by the candidate builder,
  validator and a separate canonical JSON SHA-256 calculation;
- validator: `103` candidate components, `94` immediate-predecessor
  components and `87` preserved predecessor components;
- candidate/portability tests: `7/7` passed;
- exact semantic Git object diff: empty;
- exact no-`.git` candidate archive Consumer Kit: passed;
- candidate action-snapshot portability kit: passed;
- full Authority Kit: immutable `v1.1.2`, `v2.0.0`, `v2.0.1` and current
  `v2.0.2` candidate passed;
- current v1/LiteLLM Go and TypeScript reports: deterministic `30/30` and
  cross-language equal;
- source-neutral Schema audit: `24` Schemas, `3` Manifests, `3` delivery modes
  and `5` Source fixtures;
- source-neutral Go and TypeScript reports: two deterministic `83/83` runs per
  language, exact stored-report equality and `29/29` required-class
  cross-language equality;
- preserved compatibility identities: `10` v1 M0 ID/hash pairs, `8` v1 Gap
  rows, `2` v1 provenance IDs, `5` OpenInference M0 ID/hash pairs and `4`
  OpenInference Gap Events.

## Non-binding and zero-mutation boundary

This file records Source Domain Owner candidate evidence only. It does not:

- make protocol `2.0.2` Binding;
- authorize a release manifest, immutable tag, push, pull request or merge;
- authorize product adoption, Schema/SDK/Connector implementation or runtime
  activation;
- authorize deployment, traffic, credentials, database, Cursor, Checkpoint or
  service-state mutation;
- modify immutable `v2.0.1` bytes, tag or release manifest.

The review modified only this Source Owner evidence file in the designated
shared-authority worktree. It did not modify the candidate components, a
product repository or runtime state.
