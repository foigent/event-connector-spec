# Decision candidate 0002: source-neutral transport and completeness

Status: `JOINT_DECISION_CANDIDATE_V2_NOT_BINDING`

Target protocol version: `2.0.0`

Baseline:

- authority repository: `https://github.com/foigent/event-connector-spec`
- binding predecessor: `v1.1.2`
- predecessor tag commit: `fd82aeca9877bea8064b25c365a3cdcdd0bb3d16`
- predecessor tree: `d316d6ada678066ed7679a772856aea6157d869d`
- predecessor content digest:
  `sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813`

## Decision

Connector Manifest v2 describes exactly one delivery mode:

1. `https_pull`;
2. `otlp_http_push`; or
3. `bounded_offline`.

The mode selects its activation, delivery acknowledgement, state-progression
and ingestion-capture semantics. A manifest cannot combine fields from
different modes.

Only `https_pull` owns a delivery Cursor and a Connector Checkpoint. Push and
bounded-offline delivery use immutable request or bundle identities plus
operational receipts. They must not fabricate a Cursor, high-watermark or
Checkpoint.

Delivery-scope completeness and execution-timeline completeness are distinct:

- `delivery_scope_complete=true` means the declared page, accepted request or
  bounded bundle was fully processed;
- `execution_timeline` is independently `complete`, `partial` or
  `not_asserted`;
- incomplete or unavailable evidence remains represented by first-class
  Capture Gaps.

`ingestion_capture_mode` and `payload_capture_mode` remain separate. Delivery
mode, Cursor, high-watermark, request/bundle identity, retry state, receipt
time and ingestion time are operational state outside the Event Envelope.
They do not enter Event identity, Event hash or event-linked import
provenance.

Operational Receipt v2 is fail-closed across mode, operation, status, error,
counts and acknowledgement:

- each count is a JSON safe integer in `0..9007199254740991`;
- `accepted` is non-terminal, has no error or outcome counts and never produces
  a durable acknowledgement or committed pull Checkpoint;
- `completed` is error-free, has no conflicts or rejected items and accounts
  for all received items;
- retryable and permanent error statuses require an Error with the matching
  `retryable` value;
- lifecycle/control operations use a mode-neutral `control` state, all counts
  are zero and no request, bundle, acknowledgement or Checkpoint is fabricated;
- push data acknowledgement is durable only for `completed`;
- `poll`, `receive`/`acknowledge` and `import_bundle` are respectively
  pull-only, push-only and bounded-offline-only operations.

The Schema enforces the representable field constraints. Independent Go and
TypeScript Conformance runners enforce the exact count equation
`received = inserted + duplicate_noop + conflict + rejected` using
safe-integer arithmetic.

## Preserved v1 semantics

Protocol v2 keeps these v1 artifacts and semantics byte-identical:

- Event Envelope v1;
- `foigent.event-idempotency.v1`;
- RFC 8785 canonical serialization under the frozen safe-integer profile;
- Source hash and Envelope hash domains;
- canonical decimal int64 strings;
- lossless UTC microsecond normalization;
- strict nested duplicate-key rejection;
- NFC enforcement only for protocol-controlled strings;
- opaque Source UTF-8 preservation;
- at-least-once delivery, duplicate-noop and fail-closed conflict semantics;
- first-class Capture Gaps;
- the UniRouter and LiteLLM v1 manifests, vectors, reports and X-Insight M0
  compatibility artifacts.

A v1 pull manifest remains valid only under Connector Manifest v1. A v2
consumer may load it through the normative v1-to-v2 compatibility mapping; it
must not rewrite or silently reinterpret the v1 document.

## OpenInference reference boundary

The first v2 OpenInference candidate uses `bounded_offline`, because the
currently verified X-Insight implementation parses an explicit bounded OTLP
JSON export and does not implement an OTLP HTTP receiver.

Connector Manifest v2 can express `otlp_http_push`, but this candidate does
not claim that an OpenInference push receiver exists or is activation-ready.
A future push manifest requires a distinct implementation and conformance
proof.

The current X-Insight OpenInference projection is not activation-ready even
after the shared Schema exists: its product-local provenance still uses
`contracted_pull`, its lifecycle test still constructs a pull Checkpoint, and
its current bounded sanitizer resolves parent presence with a batch-global
Span-ID index instead of the trace-scoped parent identity. Those product-local
facts are recorded as a fail-closed compatibility gate; they are not resolved
by weakening this protocol.

The candidate conformance evidence covers fully populated records, missing
optional facts with conditional first-class Gaps, deterministic multi-span
ordering and trace-scoped parent resolution. Unknown status codes, malformed
Trace IDs, reversed timestamps and exports above the 200-span bound fail
closed in both independent implementations.

## Major-version rationale

This is a major change because Connector Manifest required fields and their
meaning change:

- transport is a discriminated union instead of pull-only;
- Checkpoint applicability becomes mode-dependent;
- bootstrap becomes mode-specific activation;
- the v1 `timeline_complete=true` compatibility field is replaced by separate
  delivery-scope and execution-timeline claims;
- operational receipt and error phases gain push/offline forms.

Event Envelope, identity and hash semantics do not change.

## Required approvals before Binding

This candidate becomes Binding only after all of the following exist for the
same exact content digest:

- Source Domain Owner confirmation;
- Projection / Consumer Owner confirmation;
- Coordinator confirmation;
- immutable `v2.0.0` tag and release manifest;
- Go and TypeScript conformance reports with byte-identical observations;
- explicit v1 compatibility and migration matrix;
- product mappings proving no change to existing UniRouter/LiteLLM M0
  identities, hashes, Gaps, provenance or read models.

Until then, Phase 2 activation, product pin changes and runtime changes are not
authorized.
