# Decision 0005: Protocol v2.0.2 composite-action snapshot portability candidate

Status: `THREE_ROLE_CORRECTED_CANDIDATE_CONFIRMED_RELEASE_CONTENT_NOT_BINDING`

Work item:
`FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Product migration: `NOT_AUTHORIZED`

Runtime mutation: `NONE`

## Verified defect

The immutable `v2.0.1` composite action invokes the Authority Release Kit from
`GITHUB_ACTION_PATH`. GitHub installs a remote composite action as a source
snapshot without `.git`. The first immutable-predecessor check executes
`git rev-parse`, so a real X-Insight consumer job fails before current release
or product-pin verification begins.

Checking out the private authority repository from a product workflow is not a
valid correction: the product `GITHUB_TOKEN` cannot read that private
repository, and introducing a cross-repository credential or editable vendored
protocol copy would weaken the authority boundary.

## Candidate decision

Protocol `2.0.2` separates two executable responsibilities:

1. The Authority Release Kit runs only in a real authority checkout. It
   verifies immutable tags and archives for `v1.1.2`, `v2.0.0`, `v2.0.1`, the
   current v1/LiteLLM path, and the current release.
2. The Consumer Kit runs from the composite-action snapshot. It never invokes
   Git and validates the current immutable release manifest, component and
   approval digests, current v1/LiteLLM compatibility, Schemas, deterministic
   Go and TypeScript reports, and cross-language observations. Product-pin
   verification remains a separate fail-closed action step.

Authority CI additionally extracts an exact `git archive` snapshot, proves
that `.git` is absent, and runs the Consumer Kit from that snapshot. Immutable
predecessor identities remain cryptographically linked through the current
release manifest and are re-executed only by Authority release CI.

## Compatibility and exclusions

This candidate changes only CI packaging, orchestration, release metadata and
their executable tests. It does not change any Event, Connector, Source,
Envelope, Schema, vector, report, mapping, M0, Capture Gap, provenance,
identity, idempotency, hash, canonicalization, Operational Receipt, Cursor or
Checkpoint semantic artifact.

It does not authorize product adoption, deployment, traffic, credentials,
database mutation, runtime activation or an X-Insight repository change.

## PR CI correction

PR #9 proved that the generic current-tree workflow still invoked the legacy
`scripts/run-conformance-kit.sh`. That historical entry intentionally discovers
frozen release-snapshot tests, so it compared v2.0.1 archive expectations with
the v2.0.2 current tree and failed on `authority_readme`. Direct v2.0.2
validation, the Source-Neutral release workflow and focused portability tests
did not expose a protocol semantic regression.

The generic workflow now invokes
`scripts/run-v1-compatibility-current-kit.sh`, which is the explicit current
v1/LiteLLM compatibility scope already shared by the Consumer and Authority
kits. The historical `scripts/run-conformance-kit.sh` remains byte-exact for
immutable predecessor replay. A focused workflow test prevents generic CI from
returning to all-release discovery, and the generic workflow is now a hashed
candidate/release component.

This material CI correction invalidates all prior v2.0.2 candidate and final
approval evidence and the prior canonical manifest.

## Corrected candidate review disposition

All three roles independently confirmed the same corrected candidate commit
`c567b15904e1aa67dc33ff8a06c0cce2dface12b`, tree
`1f8b368dc1ac2187a4958c7a02f4eb51eca8aa6d`, candidate-manifest SHA-256
`33b167e2c72906610e8fafc4e4e10d3633a07ccee8f85aa4c9577980d44be58d`
and content digest
`sha256:370605f089793b56f93cf2146c01c8be6b77f937bc21b435ec63aedbd5477f21`:

- Source Owner evidence SHA-256:
  `6a68c4da560190bed869495ad8808c66ef156b77e985e80862cfdbb6c8dd0906`;
- Projection Owner evidence SHA-256:
  `37909eada669b9df080c5ed3f903c2f2f28739d034b586f62a64214fd58a96a9`;
- Coordinator evidence SHA-256:
  `8921ba43fceaae49cc402dff4dae3263bf1ded32b9e574f6dc621cbf4b057337`.

This closes only the corrected candidate gate. Fresh three-role final approval
is required over one exact release-content digest before one new canonical
`v2.0.2` manifest may be generated. No prior approval may be reused, and no
immutable tag or product/runtime action is authorized here.
