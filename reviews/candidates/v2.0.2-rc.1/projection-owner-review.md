# Protocol 2.0.2 RC1 Projection Owner Review

Role: `projection_owner`

Status: `PROJECTION_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED`

Compatibility: `PATCH_COMPATIBLE_CI_PORTABILITY_FIX`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority state

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
- reviewed candidate content digest:
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

## Defect and architecture conclusion

The immutable `v2.0.1` composite action called the Authority Release Kit from
`GITHUB_ACTION_PATH`. A downloaded composite action is a source snapshot with
no `.git`, so its first historical tag check failed before current-release or
product-pin validation. A product workflow also cannot use its ordinary
`GITHUB_TOKEN` to check out the private authority repository. Requiring a new
cross-repository credential would be a weaker consumer boundary, not a valid
portability fix.

The reviewed candidate separates three responsibilities:

1. the Authority Release Kit retains all Git/tag/archive predecessor checks
   and runs only from a real authority checkout;
2. one shared Current Release Kit owns current v1/LiteLLM, Schema, Go,
   TypeScript, deterministic-report, cross-language and manifest validation;
3. the Consumer Conformance Kit calls only that shared current-release core
   and the composite action then runs the existing strict product-pin
   verifier. Neither snapshot-safe script invokes Git or predecessor kits.

Authority CI separately builds an exact `git archive HEAD`, proves `.git` is
absent and executes the Consumer Kit from the extracted action snapshot. The
release builder links `2.0.2` to the exact `v2.0.1` predecessor identities and
continues to require fresh Source, Projection and Coordinator candidate/final
evidence before a canonical release can exist.

## Projection and compatibility conclusion

The candidate validator resolved all 94 predecessor release components. Seven
product-neutral documentation or release-tooling components intentionally
changed: `authority_readme`, `governance`, `shared_ci_action`,
`authority_ci_workflow`, `conformance_kit_runner`, `release_builder`, and
`product_pin_verifier`. The other 87 predecessor components remain
byte-identical.

Therefore no Event, Connector, Source, Envelope, payload, lifecycle,
Checkpoint, Error, Operational Receipt, Schema, canonical/vector fixture,
Go/TypeScript report, mapping, M0 Event, Capture Gap, provenance, identity,
idempotency, hash, canonicalization, Cursor or read-model semantic changed.
The reviewed candidate preserves exactly:

- ten Reference Connector M0 IDs/hashes, eight Gap rows, two provenance IDs
  and settled/cancelled read-model expectations;
- five OpenInference M0 IDs/hashes and four first-class Gap Events;
- all mutable delivery exclusions and the separation of ingestion capture
  from payload capture;
- 83/83 source-neutral cases across 29/29 required classes in both languages;
- the corrected v2.0.1 OpenInference Manifest projection reference and every
  semantic byte sealed by the immutable predecessor.

## Verification evidence

All checks were zero-network and used Go `1.24.3` plus Deno `2.7.13`:

- candidate generator check: 103 unique regular components and deterministic
  content digest;
- v2.0.2 validator/tests: seven tests, 94 predecessor components, 87 preserved
  components, exact 10/8/2 and 5/4 compatibility identities;
- current v1/LiteLLM kit: Go and TypeScript deterministic 30-case reports,
  matching stored reports and cross-language comparison;
- current source-neutral v2 kit: Go tests/vet/reproducible build, TypeScript
  typecheck/tests/build, two deterministic runs per language and exact stored
  report comparison;
- cross-language source-neutral comparison: 83/83 cases and 29/29 classes;
- exact action snapshot regression: `git archive HEAD`, `.git` absent,
  Consumer Kit passed from the extracted archive;
- full Authority Kit: immutable `v1.1.2`, `v2.0.0`, exact `v2.0.1`, current
  v1/LiteLLM and current `v2.0.2` candidate all passed.

## Remaining governance and product boundaries

This is Projection / Consumer Owner candidate evidence only. It does not make
`2.0.2` Binding and does not authorize release or product adoption. The exact
candidate still requires Source Owner and Coordinator review, three fresh
final release approvals, a canonical `releases/v2.0.2/release-manifest.json`,
exact-head Authority CI and a separately authorized immutable tag/publication.
No `v2.0.1` candidate or final approval may be reused.

No X-Insight repository, runtime, deployment, traffic, credential, database,
Cursor, Checkpoint or service state was changed by this implementation or
review.
