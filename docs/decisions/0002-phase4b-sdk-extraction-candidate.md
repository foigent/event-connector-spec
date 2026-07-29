# Decision 0002: Phase 4B shared SDK extraction candidate

- Status: candidate, non-binding
- Date: 2026-07-30
- Authority baseline: commit
  `fd82aeca9877bea8064b25c365a3cdcdd0bb3d16`, tree
  `d316d6ada678066ed7679a772856aea6157d869d`
- Protocol release examined: `v1.1.2`,
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`
- Candidate version: `0.1.0-candidate.2`

## Decision

Create parallel pure Go and TypeScript SDK candidates under `sdk/`, while
leaving every released protocol path and both existing independent
conformance implementations unchanged.

The candidate separates four concerns:

1. `canonical`: strict bytes, Unicode, time, decimal, hashing, and identity;
2. `protocol`: shared wire-object and compatibility validation;
3. `kernel`: replay and steady-state convergence/checkpoint planning;
4. `testkit`: offline evidence comparison.

The candidate may produce only a replacement Checkpoint value. It cannot
load, persist, CAS, or Ack it. It accepts only an already-durable steady
Checkpoint, so product-local activation-forward state cannot pass through the
shared steady transition.

## Characterization evidence

### UniRouter Source side

Reviewed remote `main`:

- commit `48a88bccbe182a3d3a6aec315d422f47d879a364`
- tree `31b651fb1b2718a09efa9bd1c3a2abb244ebb44e`

Reusable behavior was characterized from the pure
`internal/eventconnector` and `pullv1` helpers. The following stay local:
`completedfeed` DTO/Feed/auth/cursor/retention/ack/outbox/billing/DB/runtime,
the Source adapter, the independent legacy bridge, and the UniRouter registry
parser.

The existing UniRouter helper was not described as a complete extraction
source. Characterization found that it lacked a strict released wire parser,
total-byte/depth bounds, a replay classifier, and a `has_more` no-progress
gate. Its bootstrap helper is not the product activation-forward fence.

### X-Insight Projection side

Reviewed remote `main`:

- commit `e6c1bd3e3d6e6433b5e5717dedd50488dcf521ee`
- tree `1da84e19b81d52697acedc01f60446782e058023`

Only source-neutral JSON, Envelope, operation wire validation, and decoupled
convergence behavior were used as characterization. X-Insight profiles,
Source-system and adapter UUIDs, product cursor keys, M0 events and hashes,
EvidenceStore, import provenance, Gaps, PostgreSQL, workers, and runtime
selection remain local.

Three hash domains remain independent:

1. exact immutable Source bytes;
2. canonical shared Envelope hash input;
3. X-Insight-local M0 event bytes.

Shared idempotency is a fourth independent identity calculation.

## Frozen byte authorities

The unchanged current runners remain the independent authorities:

- `implementations/go`
- `implementations/typescript`

The SDK testkit compares five canonical Envelope hash inputs and seven scoped
identity inputs:

- Reference: two canonical cases and four identity cases;
- LiteLLM: three canonical cases and three identity cases.

The two SDK reports must be byte-identical. Every SDK case must also match
`result_base64` and `result_sha256` in both unchanged language reports for its
Reference or LiteLLM corpus.

The Reference settled and cancelled canonical prehash bytes remain 4596 and
4629, with hashes
`sha256:0d11f98f981427b7bcf175e82294511ca42981c0ecea8e02f841c3777743d1d2`
and
`sha256:c31445c779ffec9dae8cbc7f1f0344722a4e0fb696a366b2e321f58d0d07fbab`.

Existing runners validate final Envelope insertion/removal and Domain Payload
Schemas but expose the prehash bytes, not a separately frozen final
Envelope-byte artifact. This candidate therefore does not claim a new
independent final-Envelope oracle.

## Historical compatibility

The candidate fails closed outside three exact tuples:

- X-Insight Reference: Connector `1.0.0`, protocol `1.0.0`, historical
  Connector Manifest Schema digest
  `sha256:a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf`;
- X-Insight LiteLLM characterization: Connector `1.0.0`, protocol `1.1.2`,
  current Manifest Schema digest
  `sha256:59c405086310d0dfb2aaff37e55d73853e04319e6ccf659c66f98d8ba704a205`;
- UniRouter Reference runtime: Connector `1.0.0`, protocol `1.1.0`, the same
  current Manifest Schema digest.

All three released Source profiles require revision `"1"`. The matrix does
not rewrite any product pin.

## New candidate guards

- default total JSON bytes: 8 MiB;
- default container depth: 64;
- nested duplicate-key and invalid-surrogate rejection;
- parse-time rejection of fractional, exponent and out-of-safe-range JSON
  number tokens in both languages;
- rejection of timestamp inputs or UTC-normalized outputs outside years
  `0001`–`9999` in both languages;
- a candidate-only shared negative-vector file covering those boundaries;
- a private frozen TypeScript compatibility authority plus a separate deeply
  frozen public snapshot;
- nonempty/`has_more` steady pages require cursor progress;
- empty steady pages cannot advance the cursor;
- only complete item outcomes `inserted` and `duplicate_noop` converge;
- activation/bootstrap inputs are rejected by the shared steady transition.

The 8 MiB limit matches both released Connector Manifests. The 64-level depth
limit is an SDK safety constraint, not a released Schema change.

## Unresolved variances

The written protocol describes RFC 8785 canonicalization within a safe-integer
profile. The pre-existing Go runner accepts integral exponent/fraction tokens
that reduce exactly to a safe integer, while the pre-existing TypeScript
runner rejects fractional or exponent tokens. Frozen vectors do not exercise
this syntax.

Historical correction recorded after candidate.2: the preceding number
variance is between the unchanged released runners, but the timestamp wording
in the original candidate.2 decision was inaccurate. Both unchanged released
runners accept year `0000`. The first SDK candidate introduced the year-zero
variance: its Go implementation accepted year `0000`, while its TypeScript
implementation rejected it. Candidate.2 then made both SDKs reject it. The
actual unchanged-runner timestamp variance is at the upper normalization
boundary: Go can emit year `10000`, while TypeScript rejects any normalized
output that is not a four-digit year. Frozen timestamp vectors exercise
neither boundary.

The candidate uses the conservative common subset: both public parsers reject
fractional, exponent and out-of-safe-range number tokens, and both timestamp
normalizers require input and normalized UTC years `0001`–`9999`.
Candidate-owned negative vectors exercise those choices in both SDKs without
changing released vectors.

These fail-closed candidate choices preserve every frozen byte, but they are
not jointly accepted protocol semantic decisions. Publication and product
adoption remain blocked on separate protocol decisions and released vectors
for both JSON-number syntax and year-zero timestamps.

## Non-authorization

This candidate does not authorize:

- protocol release or tag creation;
- package publication;
- product dependency or pin changes;
- product runtime, Source, credential, DB, or state changes;
- deployment, merge, or restoration of the retired LiteLLM runtime.
