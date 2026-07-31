# Foigent Event and Connector Protocol v2 candidate

Status: `2.0.0 NOT_BINDING`

This document is a release-candidate specification. It does not supersede the
Binding `v1.1.2` release until the governance requirements in
`GOVERNANCE.md` are met for one exact content digest.

## 1. Scope and ownership

Protocol v2 standardizes:

- Event Envelope v1 as Connector input;
- Connector Manifest v2;
- source-neutral lifecycle, batch, Checkpoint, receipt and error contracts;
- canonical serialization, identity, hash, replay, idempotency and conflict;
- data policy, provenance, completeness and Capture Gap semantics;
- Golden fixtures and independent conformance.

Products continue to own domain payload models, normalization, authorization,
tenant routing, billing, persistence, analysis and final execution authority.
Integration Connector, Value Plugin and Enforcement Plugin remain separate
capability and isolation classes.

## 2. Normative compatibility base

Unless this document explicitly replaces a Connector-operational field, all
normative Event, serialization, identity, hash, privacy, provenance, retry and
Gap rules in `spec/protocol-v1.md` remain unchanged.

In particular:

- Event Envelope v1 is not an M0 row;
- a Connector maps Source facts into an Event Envelope and a consumer performs
  its own versioned projection;
- Event identity remains the seven-component
  `foigent.event-idempotency.v1` tuple;
- Source hash, Envelope hash and product-local normalized hashes remain
  separate domains;
- delivery state never enters Event identity or hash.

## 3. One exact delivery mode per Manifest

Connector Manifest v2 is a closed discriminated union. `transport.mode` is
exactly one of:

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
- partial batch acceptance is forbidden in v2;
- retries converge by Event identity and hash;
- no delivery Cursor, high-watermark or Connector Checkpoint exists;
- receiver activation defines the forward boundary;
- request identity and receive/acknowledgement time are operational state.

Support in the Schema does not prove that any product has implemented a
receiver. A Connector requires its own reviewed Manifest and conformance
evidence.

### 3.3 `bounded_offline`

- an operator or bounded workflow imports one explicit immutable bundle;
- bundle identity is SHA-256 over exact bundle bytes;
- all items must converge before a durable receipt is completed;
- replay converges by bundle digest plus Event identity and hash;
- no delivery Cursor, high-watermark or Connector Checkpoint exists;
- the import covers only the declared bundle and never implies broad history.

## 4. Delivery state and Event state are separate

The following values exist only in Event Batch, Connector Checkpoint,
Operational Receipt or non-event-linked operational records:

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

An immutable Source fact that happens to resemble one of these names remains a
Source fact only when the Domain Schema defines it as such. Implementations
must not infer that from the name.

## 5. Completeness

Connector Manifest v2 separates two claims:

1. `delivery_scope_complete=true` means the declared `poll_page`,
   `accepted_request` or `bounded_bundle` was processed without partial
   acceptance;
2. `execution_timeline` says whether that delivery establishes a complete
   execution timeline.

`execution_timeline` is:

- `complete`: the Source contract establishes terminal timeline completeness;
- `partial`: the delivery contains real evidence but cannot establish the
  complete execution path;
- `not_asserted`: no execution-level completeness claim is made.

`assertion_basis` identifies whether the claim comes from a Source contract,
Connector observation or explicit operator declaration. Missing facts and
partial timelines remain first-class Capture Gaps; a record-level “partial”
label is not a substitute.

The v1 Reference Pull Connector projection is:

- `delivery_scope=poll_page`;
- `delivery_scope_complete=true`;
- `execution_timeline=complete`;
- `assertion_basis=source_contract`.

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
processing, Checkpoint-applicability and health axes.

- Pull processing may be `polling`; its Checkpoint applicability is
  `required`.
- Push processing may be `receiving`; Checkpoint applicability is
  `not_applicable`.
- Offline processing may be `importing`; Checkpoint applicability is
  `not_applicable`.

Connector Checkpoint v2 has `delivery_mode=https_pull`. Producing it for push
or offline delivery is a contract violation.

## 8. Batch and receipt

Event Batch v2 wraps Event Envelope v1 values and one mode-specific delivery
state object. Mutable delivery fields are intentionally outside each Event.

Operational Receipt v2 reports bounded counts and one mode-specific delivery
state:

- pull Checkpoint before/after;
- push request identity and acknowledgement;
- offline bundle identity and digest.

The receipt is operational evidence and is not part of a normalized Event
hash.

## 9. Error and retry

Connector Error v2 preserves v1 categories and adds the phases `receive`,
`import` and `acknowledge`, plus the bounded recoveries `resubmit_request` and
`reimport_bundle`.

Retryability remains explicit. Non-retryable errors cannot carry
`retry_after_seconds`.

Mode-specific rules:

- pull cursor errors require explicit resync or operator repair;
- a retryable push failure withholds durable acknowledgement so the sender may
  resubmit;
- a retryable offline failure does not complete the bundle receipt;
- same identity and same hash is duplicate-noop;
- same identity and different hash is a fail-closed conflict in every mode.

## 10. OpenInference bounded-offline reference

The candidate Reference Connector consumes one synthetic bounded OTLP JSON
export, produces a strict metadata-only sanitized Source record and maps it to
`observability.span.completed`.

`catalog/domain-catalog.v2.json` is the candidate domain index. The sanitized
Source record retains the historical
`xinsight://sources/openinference/otlp-span/v1` identifier solely as a
versioned compatibility identifier: changing it would change the Source hash
and current M0 compatibility seed. The authority repository owns the candidate
Schema bytes and mapping semantics; the identifier does not transfer shared
protocol ownership to the X-Insight runtime.

The parent Event:

- omits `time.observed_at`;
- uses `time.occurred_at` as the deterministic alias of
  `time.terminal_at=end_time`;
- keeps fetch, receive and ingestion time outside the Event;
- reports `payload.timeline_complete=false`;
- emits deterministic sorted Capture Gap claims;
- never persists raw input, output or message content.

The first manifest uses `bounded_offline`. `otlp_http_push` remains a supported
protocol mode without an activation claim.

## 11. v1 compatibility

Existing v1 artifacts are immutable. A v2 consumer may project a v1 Manifest
into v2 pull semantics according to
`compatibility/v1-to-v2-source-neutral-matrix.json`; it must preserve the
original artifact version and digest.

No v2 candidate may alter the existing UniRouter or LiteLLM Event identities,
Envelope hashes, X-Insight M0 identities/hashes, Capture Gaps, provenance or
read-model expectations.

## 12. Non-goals

Protocol v2 does not introduce:

- Kafka, NATS or CDC;
- a universal privileged Connector process;
- plugin marketplace or public code-execution platform;
- shared product IAM, routing, billing, persistence or enforcement authority;
- raw prompt/response storage by default;
- an implemented OTLP receiver;
- product runtime activation, traffic, credentials or database changes.

## 13. Binding gate

The candidate is not Binding until one immutable version and digest has:

- Source Domain Owner, Projection Owner and Coordinator confirmation;
- authoritative Schemas, manifests, mappings, Golden fixtures and migration
  matrix;
- independent Go and TypeScript conformance with identical result bytes;
- product compatibility evidence;
- immutable tag and release manifest.
