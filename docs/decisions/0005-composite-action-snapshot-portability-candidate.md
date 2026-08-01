# Decision 0005: Protocol v2.0.2 composite-action snapshot portability candidate

Status: `THREE_ROLE_CANDIDATE_CONFIRMED_RELEASE_CONTENT_NOT_BINDING`

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

## Candidate review disposition

All three roles independently confirmed the same exact candidate commit
`6f729d9a3cf819e5c538ba8bd3a16a85cdc42967`, tree
`5fb49fb450257dd1c40e33f6f8358e6dd434a367`, candidate-manifest SHA-256
`5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02`
and content digest
`sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7`:

- Source Owner evidence SHA-256:
  `a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f`;
- Projection Owner evidence SHA-256:
  `7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed`;
- Coordinator evidence SHA-256:
  `5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429`.

This closes only the candidate gate. Fresh three-role final approval is
required over one exact release-content digest before a canonical `v2.0.2`
release manifest may be generated. No prior approval may be reused, and no
immutable tag or product/runtime action is authorized here.
