# Foigent Event and Connector Protocol v2

Version: `2.0.0`

Status: Binding only as the exact bytes identified by the immutable `v2.0.0`
tag and `releases/v2.0.0/release-manifest.json`. A branch, pull request,
working tree, or untagged commit is not protocol authority.

## 1. Scope and ownership

Protocol v2 standardizes:

- Event Envelope v1 as Connector output and consumer input;
- Connector Manifest v2;
- source-neutral lifecycle, batch, Checkpoint, receipt, and error contracts;
- canonical serialization, identity, hash, replay, idempotency, and conflict;
- data policy, provenance, completeness, and Capture Gap semantics;
- Golden fixtures and independent conformance.

Products continue to own domain payload models, normalization, authorization,
tenant routing, billing, persistence, analysis, and final execution authority.
Integration Connector, Value Plugin, and Enforcement Plugin remain separate
capability and isolation classes.

## 2. Normative compatibility base

Unless this document explicitly replaces a Connector-operational field, all
normative Event, serialization, identity, hash, privacy, provenance, retry,
and Capture Gap rules in `spec/protocol-v1.md` remain unchanged.

In particular:

- Event Envelope v1 is not an X-Insight M0 row;
- a Connector maps Source facts into an Event Envelope and a consumer performs
  its own versioned projection;
- Event identity remains the seven-component
  `foigent.event-idempotency.v1` tuple;
- Source hash, Envelope hash, and product-local normalized hashes remain
  separate domains;
- mutable delivery state never enters Event identity, Event hash, or
  item/event-linked import provenance.

The normative v2 artifacts are the exact files bound by the release manifest.
SDKs and runners implement those artifacts; they do not define a second
meaning.

## 3. One exact delivery mode per Manifest

Connector Manifest v2 is a closed discriminated union.
`transport.mode` is exactly one of:

### 3.1 `https_pull`

- the Connector fetches bounded pages;
- delivery is at least once;
- every item must converge before the page Checkpoint commits;
- Cursor and high-watermark are Connector state only;
- empty-page Cursor advancement fails closed;
- activation starts at the activation-forward boundary;
- broad backfill is not implicit.

### 3.2 `otlp_http_push`

- a sender delivers one bounded OTLP HTTP request;
- the receiver acknowledges only after every accepted item converges;
- partial batch acceptance is forbidden;
- retries converge by Event identity and hash;
- no delivery Cursor, high-watermark, or Connector Checkpoint exists;
- receiver activation defines the forward boundary;
- request identity and receive/acknowledgement time are operational state.

Schema support does not prove that a product has implemented a receiver. A
Connector requires its own reviewed Manifest and conformance evidence.

### 3.3 `bounded_offline`

- an operator or bounded workflow imports one explicit immutable bundle;
- bundle identity is SHA-256 over exact bundle bytes;
- all items must converge before a durable receipt is completed;
- replay converges by bundle digest plus Event identity and hash;
- no delivery Cursor, high-watermark, or Connector Checkpoint exists;
- the import covers only the declared bundle and never implies broad history.

## 4. Delivery state and Event state

The following values exist only in Event Batch, Connector Checkpoint,
Operational Receipt, or non-event-linked operational records:

- delivery mode;
- Cursor and high-watermark;
- page or request time;
- request identity;
- bundle identity and bundle digest;
- retry and acknowledgement state;
- receipt and ingestion time.

They MUST NOT enter:

- `identity.idempotency_key`;
- Event `integrity.source_hash` or `integrity.envelope_hash`;
- product normalized Event identity or hash;
- item/event-linked import provenance.

An immutable Source fact that resembles one of these names remains a Source
fact only when the Domain Schema defines it as such.

## 5. Completeness and Capture Gaps

Connector Manifest v2 separates:

1. `delivery_scope_complete=true`: the declared `poll_page`,
   `accepted_request`, or `bounded_bundle` was processed without partial
   acceptance;
2. `execution_timeline`: whether the delivery establishes a complete
   execution timeline.

`execution_timeline` is `complete`, `partial`, or `not_asserted`.
`assertion_basis` records whether the claim comes from a Source contract,
Connector observation, or explicit operator declaration.

Missing facts and partial timelines remain first-class Capture Gaps. A
record-level `partial` label is not a substitute.

The v1 Reference Pull Connector projects to `poll_page`,
`delivery_scope_complete=true`, `execution_timeline=complete`, and
`assertion_basis=source_contract`.

## 6. Capture modes

`payload_policy.ingestion_capture_mode` identifies how evidence entered the
Connector:

- `api_pull_import`;
- `otlp_http_receive`;
- `bounded_offline_import`.

`payload_capture_mode` independently identifies retained payload fidelity:

- `none`;
- `metadata_only`;
- `redacted`;
- `full`.

These fields MUST NOT be collapsed. `raw_payload_present` remains explicit.

## 7. Lifecycle and Checkpoint

Lifecycle v2 retains independent configuration, authentication, transport,
processing, Checkpoint-applicability, and health axes.

- Pull processing may be `polling`; Checkpoint applicability is `required`.
- Push processing may be `receiving`; Checkpoint applicability is
  `not_applicable`.
- Offline processing may be `importing`; Checkpoint applicability is
  `not_applicable`.

Connector Checkpoint v2 has `delivery_mode=https_pull`. Producing it for push
or offline delivery is a contract violation.

## 8. Batch and Operational Receipt

Event Batch v2 wraps Event Envelope v1 values and one mode-specific delivery
state object. Mutable delivery fields remain outside each Event.

Operational Receipt v2 reports bounded counts and an
operation-discriminated state:

- lifecycle/control operations use mode-neutral `control` state;
- pull data operations use Checkpoint before/after;
- push data operations use request identity and acknowledgement;
- offline data operations use bundle identity and digest.

Lifecycle/control operations are `activate`, `pause`, `resume`, `stop`,
`start`, `rotate`, and `retire`. Their five counts are zero and they never
fabricate a request, bundle, acknowledgement, or Checkpoint.

Receipt counts are JSON integers in `0..9007199254740991`, the shared RFC 8785
safe-integer profile. Event payload token counters remain canonical decimal
int64 strings with numerical maximum `9223372036854775807`.

The following rules are normative:

- `accepted` is non-terminal, has no Error, has zero outcomes, commits no pull
  Checkpoint, and withholds push acknowledgement;
- `completed` has no Error or non-converged item and reports
  `received = inserted + duplicate_noop + conflict + rejected`;
- `retryable_error` requires `error.retryable=true`;
- `permanent_error` requires `error.retryable=false`;
- lifecycle/control Error phase, operation, and recovery match the outer
  operation exactly;
- every non-accepted status accounts for every received item;
- push acknowledgement is `durable` only for `completed`;
- only a completed pull data operation may commit its post-operation
  Checkpoint;
- offline bundle completion occurs only for `completed`.

The JSON Schema enforces representable shapes and bounds. Independent
Conformance runners enforce arithmetic and semantic cross-field rules.

## 9. Error, retry, replay, and conflict

Connector Error v2 preserves v1 categories and adds `receive`, `import`, and
`acknowledge`, plus bounded recoveries `resubmit_request` and
`reimport_bundle`.

- Retryability is explicit.
- Non-retryable errors cannot carry `retry_after_seconds`.
- Pull Cursor errors require explicit resync or operator repair.
- Retryable push failure withholds durable acknowledgement.
- Retryable offline failure does not complete the bundle receipt.
- Same identity and same hash is duplicate-noop.
- Same identity and different hash is a fail-closed conflict in every mode.

## 10. OpenInference bounded-offline Reference Connector

The v2 Reference Connector consumes bounded synthetic OTLP JSON exports,
produces strict metadata-only sanitized Source records, and maps them to
`observability.span.completed`.

The parent Event:

- omits `time.observed_at`;
- uses `time.occurred_at` as the deterministic alias of
  `time.terminal_at=end_time`;
- keeps fetch, receive, and ingestion time outside the Event;
- reports `payload.timeline_complete=false`;
- emits deterministic sorted Capture Gap claims;
- never persists raw input, output, or message content.

The conformance evidence proves bounded record counts, deterministic
`trace_id` then `span_id` ordering, trace-scoped parent resolution, absence
preservation for optional facts, strict status/identity/time validation, and
fail-closed over-bound batches.

The first Manifest uses `bounded_offline`. `otlp_http_push` is a supported
protocol mode without a product activation claim.

## 11. v1 compatibility

Existing v1 artifacts are immutable. A v2 consumer may project a v1 Manifest
into v2 pull semantics according to
`compatibility/v1-to-v2-source-neutral-matrix.json`; it must preserve the
original artifact version and digest.

Protocol v2 preserves the existing UniRouter and LiteLLM Event identities,
Envelope hashes, X-Insight M0 identities and hashes, Capture Gaps, provenance,
and read-model expectations. The release validator fails closed on drift.

## 12. Product adoption boundary

Protocol release is not product migration. No release artifact authorizes:

- X-Insight or UniRouter code changes;
- runtime activation, deployment, traffic, or credentials;
- Cursor, Checkpoint, or database mutation;
- an implemented OTLP receiver;
- broad historical replay.

Each product must separately pin the immutable release, implement its local
mapping or adapter, run conformance in its own CI, and obtain product/runtime
authorization.

## 13. Non-goals

Protocol v2 does not introduce:

- Kafka, NATS, or CDC;
- a universal privileged Connector process;
- a plugin marketplace or public code-execution platform;
- shared product IAM, routing, billing, persistence, or enforcement authority;
- raw prompt/response storage by default.
