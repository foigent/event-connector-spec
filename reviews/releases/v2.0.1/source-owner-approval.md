# Protocol v2.0.1 Source Domain Owner final release approval

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

Role: `source_domain_owner`

Status: `SOURCE_OWNER_FINAL_RELEASE_CONFIRM`

Reviewed content digest: `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`

Semantic conflict: `NONE`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

## Exact release-content identity

- Commit: `0daadd07ace75afa4233e5a1b28a95f1704e2440`
- Tree: `d4f6ffc276ff58e5a1225b8dc5e1d01dcdea9933`
- Candidate manifest: `docs/candidates/v2.0.1-rc.1/candidate-manifest.json`
- Candidate manifest SHA-256: `155441d07d25d7b63831072a9ce04dace65ee2be32abb826c89f000c3e18e0e9`
- Projection final approval: `reviews/releases/v2.0.1/projection-owner-approval.md`
- Projection approval SHA-256: `e316bb81c23f3fc2ccfc8b5006013a52cc823f762802c5b41069437e4ec55a8c`
- Projection evidence commit: `a2624e311309bc866541954018af289375f2cdee`
- Projection evidence tree: `06f78595eefb5b405652ace520fc44c8857ecb24`
- Immediate predecessor: immutable `v2.0.0`, commit `a8ab25ef8c8dd1c12d073ec0cf23c376f5741744`, tree `981e2516154610c172c6a1607795512ad9c69f30`
- Immediate predecessor content digest: `sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69`
- Immediate predecessor release digest: `sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9`
- Immediate predecessor release-manifest SHA-256: `4a0800e0117e351606e91177bac0beb3276dbfcdc22bd6a6718bdcdec1d6289d`

## Source-domain and compatibility conclusion

The assembled `2.0.1` content is a `PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM` over immutable `2.0.0`. The only protocol-component correction is the OpenInference Connector Manifest's nested digest for the already-released X-Insight projection: the stale `b374f7a...` reference becomes the projection's actual `d5abcab...` SHA-256. The referenced projection bytes do not change.

All Source/Event/Envelope/payload/lifecycle/identity/idempotency/hash/canonicalization/Capture Gap/provenance/Operational Receipt semantics and conformance vectors remain unchanged. The UniRouter Source baseline remains exact, including completed-execution Feed coverage, Source Snapshot bytes and source hash, request/Event/Outbox identities, terminal/finality and revision rules, data policy, endpoint/page/cursor behavior, and Cursor/Checkpoint exclusions.

Preserved UniRouter component identities are:

- Reference Connector Manifest: `sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79`;
- Source Snapshot mapping: `sha256:5425ab384bebcd9d4a7e81882bfa1bb1700df7cc397863b91f69e2855df12928`;
- Source lifecycle mapping: `sha256:1618c86e3d8fae206322e1d928b8b5f0401865623b4267f5b685d7ac02b2968f`;
- Source identity mapping: `sha256:0cdbcdcf42658ee12d14ae13ef5d43b54488dca7cec8182055047585eb62e890`;
- UniRouter-to-X-Insight compatibility matrix: `sha256:03fb035134b173165e6a03f348d40a58fe1d28d82c24bacb1dec553c8b769c89`.

No Source semantic conflict or product migration requirement was identified.

## Independent verification evidence

- Exact `0daadd0...` Git archive independently reproduced reviewed content digest `sha256:b3fd6a...e3e` and candidate-manifest content digest `sha256:3e2f0904dae2341909ce8252f58ac554c44eee67c4eec33e49ffb957d442b444`.
- Release validator passed against both the exact archive and current content: 66 candidate components, 93 immediate-predecessor components, 57 v1 predecessor components, preserved `10/8/2` v1 compatibility identities, 5 OpenInference M0 identities, 4 OpenInference Capture Gap Events, 83 conformance cases and 29 required classes.
- Candidate/release Python tests passed: `13/13`.
- Source-neutral artifact check passed: 5 Envelopes and 83 cases.
- Schema audit passed: 24 Schemas, 3 Manifests, 3 delivery modes and 5 Source fixtures.
- Go tests and vet passed using the bounded reused-cache path. Two fresh 83-case reports were byte-identical to each other and to stored report `sha256:3265dd58f91fa3c010f4d022507c6e68cae4609978490842fd21c0da658152f8`.
- TypeScript typecheck, `2/2` tests and build passed. Two fresh 83-case reports were byte-identical to each other and to stored report `sha256:eb0139c27eb774e8acf4a077107260b6a7a0fd5d5d18abe1e4227f3d670e5d5b`.
- Fresh Go/TypeScript comparison passed: `83/83` cases across `29/29` required classes.
- The immutable `v2.0.0` predecessor's existing independently generated Go and TypeScript reports were each deterministic, byte-identical to their archived stored reports, and matched cross-language at `83/83` cases and `29/29` classes. Its release manifest matched the archived immutable object exactly.
- A byte-level semantic diff from `v2.0.0` confirmed that the preserved Schema, specification, catalog, vectors, fixtures, mappings, conformance, implementation, UniRouter Manifest and compatibility artifacts did not change. The OpenInference Manifest diff is one nested digest line only.
- The canonical `releases/v2.0.1/release-manifest.json` is absent. Before this approval existed, the strict release builder failed closed on the missing fresh `v2.0.1` Source Owner approval and did not reuse a `v2.0.0` approval.

The combined full-kit command was attempted but stopped during an immutable predecessor Go build because the host filesystem reported `no space left on device`. That invocation is not counted as a pass. No cache or directory was deleted. The current semantic and compatibility checks listed above were instead rerun independently with the bounded no-new-cache path, and the immutable predecessor identities and stored reports were verified separately.

## Boundary

This approval covers only the exact local shared-authority release content identified above. It does not by itself make protocol `2.0.1` Binding and does not authorize the canonical release manifest, tag, publication, push, pull request, merge, product migration, Schema/SDK/Connector adoption, deployment, traffic, credentials, database mutation, Cursor/Checkpoint mutation, or any Phase 2/runtime action. A fresh Coordinator final approval over the same reviewed content digest remains required.
