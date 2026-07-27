# Foigent Event and Connector Protocol V1

Status: release candidate input; not binding until the immutable release
manifest, conformance evidence, compatibility artifacts, and three role
approvals are complete.

## 1. Architectural boundary

This protocol defines shared event, Connector metadata, delivery, checkpoint,
receipt, error, and conformance contracts. It does not define a universal
plugin runtime.

Products retain their own:

- domain event models and product-local registry identities;
- IAM, tenant authorization, credentials, routing, billing, persistence,
  analysis, UI, and execution authority;
- Connector isolation runtime and operational lifecycle;
- product-local normalized event identity, hash, and idempotency rules.

A shared Event Envelope is Connector input. It is not a direct product
database row.

## 2. Reference Source Event

The first Reference Connector emits one shared event:

```text
event_type = model.request.completed
terminal.status = settled | cancelled
```

It covers only an authenticated, admitted, project-scoped UniRouter request
that reached its durable billing terminal. Pre-admission and pre-billing
rejections are outside Reference V1 coverage.

`timeline_complete=true` means the bounded billing-terminal timeline is final.
It does not erase declared Capture Gaps.

## 3. Event identity and idempotency

The shared identity tuple is:

```text
producer.product
producer.instance
scope.tenant_ref or absent
scope.org_ref
scope.project_ref
event_type
event_id
```

For the Reference Connector, `event_id` is the exact Source `request_id`.
`request_id` is not assumed globally unique. Organization and project scope
are therefore required.

Each tuple component is encoded as:

```text
uint32 big-endian UTF-8 byte length || exact UTF-8 bytes
```

An absent tenant is exactly four zero bytes. A present empty tenant is invalid.

The shared idempotency key is:

```text
sha256:<lowercase SHA-256 hex of:
  ASCII("foigent.event-idempotency.v1") ||
  LP_UTF8(producer.product) ||
  LP_UTF8(producer.instance) ||
  LP_UTF8(scope.tenant_ref or absent) ||
  LP_UTF8(scope.org_ref) ||
  LP_UTF8(scope.project_ref) ||
  LP_UTF8(event_type) ||
  LP_UTF8(event_id)>
```

Reference revision is exact string `"1"`. Revision does not enter identity or
idempotency.

Same identity plus the same canonical Envelope hash is duplicate/no-op. Same
identity plus different canonical content is conflict and fails closed.

## 4. Canonical Event bytes and hashes

Three hash domains are independent:

1. `integrity.source_hash` hashes exact immutable Source bytes.
2. `integrity.envelope_hash` hashes RFC 8785 canonical Envelope bytes.
3. Product-local normalized event hashes remain under product projection
   contracts.

All shared SHA-256 references match `^sha256:[0-9a-f]{64}$`.

Envelope hash input is the complete Event Envelope with
`integrity.envelope_hash` absent. It is not `null`, empty, or a placeholder.
`integrity.source_hash` remains included.

Golden files named `*.hash-input.json` represent only that pre-hash input and
are intentionally not final Envelope instances. A conforming mapper computes
the digest, inserts it as `integrity.envelope_hash`, and then validates the
final object against both the Event Envelope Schema and the referenced Domain
Payload Schema. Removing the hash from that validated final object must
reproduce the exact Golden hash input.

Strict token-level parsing rejects duplicate object keys at every depth before
ordinary object mapping. Arrays preserve schema-defined order. Reference
`capture_gaps` are sorted by `affected_claim`.

Shared timestamps are parsed as instants, normalized to UTC, and emitted as
`YYYY-MM-DDTHH:MM:SS.ffffffZ`. The conversion must be lossless at microsecond
precision. Inputs carrying nonzero sub-microsecond precision are rejected;
they are never rounded or truncated by the shared mapper. The Reference
Source canonicalizes its terminal fact to PostgreSQL microsecond precision
before the immutable Snapshot is created.

Protocol-controlled names, enums, identifiers, and Schema references must
already be valid UTF-8 NFC. Validators reject non-NFC protocol-controlled
values and never normalize silently.

Source-derived opaque strings, including Source request IDs, Source instance,
and model text, preserve exact valid UTF-8 bytes. They are neither normalized
nor rejected solely for being non-NFC.

## 5. Number and time wire rules

| Value | JSON representation | Rule |
| --- | --- | --- |
| org/project reference | string | canonical positive decimal |
| token counters | string | canonical nonnegative decimal, `0..9223372036854775807` |
| money micros | string | canonical nonnegative decimal, current Source bounds |
| amount scale | integer | exact `1000000` |
| revision | string | exact `"1"` |
| shared time | string | exact UTC microseconds |

SDKs must not validate, convert, or re-emit these decimal strings through
binary floating point.

## 6. Reference time ownership

Exact Source `terminal.available_at` maps to shared `time.terminal_at`.
`time.occurred_at` is a deterministic alias of the same instant.

Parent `time.observed_at` is absent in Reference V1.

Connector page generation, fetch and receive times, retry state, and Consumer
ingestion time remain outside Event content, identity, Envelope hash, and
item-linked import provenance.

## 7. Capture Gaps

Reference V1 contains exactly:

```text
call_log
request_trace
client_ip_presence
upstream_error_presence
```

Each Source reason is `not_available_at_billing_terminal`.

The exact field provenance is:

| Field | Provenance |
| --- | --- |
| `affected_claim` | direct |
| `reason_code` | direct |
| `gap_id` | derived |
| `parent_event_id` | derived |
| request/org/project linkage | derived |
| `observed_at` | derived |
| `gap_type` | declared |
| `severity` | declared |
| `payload_capture_mode` | declared |

Derived and declared fields are regenerated and compared. A producer cannot
override them. Same Gap identity with different direct, derived, or declared
content is conflict.

## 8. Delivery isolation

Event Envelopes contain no:

- cursor or high-watermark;
- page generation/fetch/receive time;
- retry or backoff state;
- Consumer ingestion time.

These values exist only in Event Batch transport, durable Connector
Checkpoint/status, or a non-event-linked Operational Receipt. They never enter
Event identity, shared idempotency, Envelope hash, product-local event
identity/hash/idempotency, or item-linked import provenance.

Delivery is at least once. Checkpoint advances only after every item in a page
converges as inserted or exact duplicate/no-op. Partial-page failure preserves
the old checkpoint. Conflict, cursor regression, empty-page cursor advance,
and nonempty no-progress fail closed.

## 9. Reference contracted-pull provenance

Item-linked provenance contains only:

- exact Source payload SHA;
- immutable Source revision `"1"`;
- terminal time;
- `timeline_complete=true`.

Source and import watermarks remain empty. Protocol release and mapping pins
belong in registry/status/CI lock or a non-event Operational Receipt, never in
item-linked provenance identity.

## 10. Portable Connector identity

```text
connector_id = foigent.unirouter.completed-execution
connector_version = 1.0.0
class = integration
direction = source
```

Portable identity never replaces product-local source, adapter, credential, or
registry identities. B9 mappings bind them explicitly.

## 11. Orthogonal lifecycle axes

Lifecycle is represented by independent axes:

- configuration;
- authentication;
- transport;
- processing;
- checkpoint;
- health.

Product-local durable states remain authoritative. Mapping artifacts project
between these axes and product-local states without replacing either model.

## 12. Versioning

Released versions and bytes are immutable.

- backward-compatible optional additions require a minor version;
- changes to meaning, identity, idempotency, hashes, canonicalization,
  requiredness, or compatibility require a major version;
- breaking releases require a compatibility matrix, migration guidance, and
  deprecation window;
- the same version must never identify different bytes.
