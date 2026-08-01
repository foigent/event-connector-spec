# Protocol 2.0.2 RC1 Corrected CI Candidate Source Domain Owner Review

Role: `source_domain_owner`

Status: `SOURCE_OWNER_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

## Exact corrected candidate reviewed

- repository: `https://github.com/foigent/event-connector-spec`
- branch: `codex/v2.0.2-composite-action-portability`
- corrected candidate commit:
  `c567b15904e1aa67dc33ff8a06c0cce2dface12b`
- corrected candidate tree:
  `1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`
- candidate manifest:
  `docs/candidates/v2.0.2-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`
- candidate content digest:
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`
- candidate components: `104` unique regular files
- protocol status: `NOT_BINDING`
- canonical release manifest: `ABSENT`

The candidate builder reproduced the exact content digest twice. This Source
review binds only the commit, tree, Manifest bytes, 104-component set and
content digest above. A change to any of them requires a superseding Source
review.

## Separately bound Projection evidence

- path: `reviews/candidates/v2.0.2-rc.1/projection-owner-review.md`
- SHA-256:
  `sha256:37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`
- evidence commit:
  `e5d6a4039d1a68835bc3a929899c97a255f35fd4`
- evidence tree:
  `289d14c6b81af2b833f0e2a8ed1ea09b7d311973`
- status:
  `PROJECTION_OWNER_V2_0_2_CI_ORCHESTRATION_CORRECTION_CANDIDATE_CONFIRM_NON_BINDING`

The Projection evidence identity is recorded only as a separate governance
input. Its conclusions were not inherited; Source semantics, component bytes,
CI boundaries and executable evidence were reviewed independently.

## Immediate predecessor integrity

The exact immutable immediate predecessor remains:

- version/tag: `v2.0.1`
- annotated tag object:
  `c24531c24955bc700133387dd7352a88e5ba82be`
- dereferenced commit:
  `0cbb6417858d12d6a99ff3b517bd59a122bc7e2c`
- tree: `f967929dd98c5f34cd42fce4aa21489b72b000e0`
- release-manifest SHA-256:
  `sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60`
- content digest:
  `sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e`
- release digest:
  `sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777`

The Authority Kit also retained exact immutable replay of `v1.1.2` and
`v2.0.0`. The `v1.1.2` tag resolves to commit
`fd82aeca9877bea8064b25c365a3cdcdd0bb3d16` and tree
`d316d6ada678066ed7679a772856aea6157d869d`; its archive path verifies all 57
released predecessor components.

## Source-domain compatibility conclusion

No Source-domain semantic conflict was identified. A direct Git-object diff
from immutable `v2.0.1` to corrected candidate `c567b159...` is empty for
Schemas, vectors, conformance artifacts, mappings, Manifests, fixtures,
catalog, compatibility files, protocol specifications, both source-neutral
implementations and the Schema audit.

The following Source and shared identities remain byte-exact:

- Event Envelope Schema:
  `sha256:6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26`;
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

## Corrected CI orchestration conclusion

The corrected generic workflow invokes only
`scripts/run-v1-compatibility-current-kit.sh`. It no longer invokes the legacy
all-release discovery entrypoint `scripts/run-conformance-kit.sh`, so current
PR CI does not execute frozen v2.0.1 snapshot tests against a v2.0.2 tree.

This correction remains narrow and fail-closed:

1. `.github/workflows/ci.yml` is a newly governed component with SHA-256
   `fd26f25cb8db8c27d033fa37184b0253ebbba42b4bc422c2e3e7b92ae2382ef3`.
2. The immutable legacy runner remains byte-exact at
   `sha256:98afa5b6c964df78a80a7aaf7488899f76d21123f0f867ab3a83fc6af9a43214`
   and is still used by immutable predecessor replay.
3. A focused test requires the current compatibility entrypoint and rejects a
   regression to `run-conformance-kit.sh` in generic CI.
4. The `v1.1.2` current-tree PATCH allowlist is exactly
   `{authority_ci_workflow}`. It preserves 56 current-tree components, while a
   non-allowlisted Event Envelope digest mutation fails closed.
5. The snapshot-safe Consumer and Current kits contain no Git dependency or
   predecessor invocation. The Git-history-dependent Authority Kit retains
   explicit replay of `v1.1.2`, `v2.0.0` and `v2.0.1`.

The classification `PATCH_COMPATIBLE_CI_PORTABILITY_FIX` is therefore
appropriate: orchestration and governed CI evidence change, but no wire,
Source, identity, hash, SDK or product-runtime contract changes.

## Independent verification evidence

Fresh offline verification established:

- candidate Manifest SHA and `104/104` unique regular component digests passed;
- candidate digest reproduced twice as
  `sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`;
- validator passed `104` candidate components, `94` immediate-predecessor
  components and `87` preserved non-PATCH components;
- focused candidate/action tests passed `9/9`, including the generic-CI and
  narrow-allowlist negative cases;
- Source compatibility evidence remained ten v1 M0 ID/hash pairs, eight Gap
  rows, two provenance IDs, five OpenInference M0 ID/hash pairs and four
  OpenInference Gap Events;
- an exact `c567b159...` Git archive contained no `.git` and passed the full
  Consumer Kit in content-candidate mode;
- current v1/LiteLLM Go and TypeScript stored-report checks passed `30/30` and
  matched cross-language;
- the Source-neutral Schema audit passed 24 Schemas, three Manifests, three
  modes and five Source fixtures;
- deterministic Go and TypeScript Source-neutral runs each passed `83/83` and
  matched stored reports and all `29/29` required cross-language classes;
- the full Authority Kit passed immutable `v1.1.2`, `v2.0.0`, exact `v2.0.1`,
  current v1/LiteLLM and the exact corrected 104-component candidate bytes.

The Authority execution used current HEAD only after verifying its sole delta
from `c567b159...` was the separately bound Projection evidence file, outside
the candidate's 104 governed components.

## Superseded evidence and zero-mutation boundary

The former candidate identity `6f729d9...`, release-content digest
`sha256:ce70c78a...`, prior v2.0.2 candidate/final approvals and prior canonical
release manifest are superseded and were not reused. The current release
builder rejects the old final approvals because they do not bind the corrected
release-content digest; no release manifest is present.

This file is Source Domain Owner corrected-candidate evidence only. It does
not make protocol `2.0.2` Binding and does not authorize release-content
assembly, a canonical manifest, tag, push, pull request, merge, publication,
product adoption, UniRouter repository changes, deployment, traffic,
credentials, database, Cursor, Checkpoint, worker or service-state mutation.

Only this Source review file was updated in the designated authority worktree.
No candidate component, product repository or runtime state was modified.
