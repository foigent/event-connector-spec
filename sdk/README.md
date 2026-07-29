# Foigent Event & Connector SDK candidate

Status: `0.1.0-candidate.1`, local extraction candidate only.

This directory contains source-neutral Go and TypeScript implementations of
the shared protocol mechanics. It does not change any released protocol,
Schema, fixture, manifest, conformance runner, release manifest, product pin,
or product runtime.

## Packages

- `go/{protocol,canonical,kernel,testkit}`
- `typescript/src/{protocol,canonical,kernel,testkit}`
- `compatibility-matrix.v1.json`

The public package names are:

- Go module: `github.com/foigent/event-connector-spec/sdk/go`
- TypeScript package: `@foigent/event-connector-sdk`

The TypeScript package is deliberately `"private": true`; neither package is
published by this candidate.

## Included

- bounded strict JSON parsing with duplicate-key and invalid-Unicode rejection;
- the frozen safe-integer canonical profile and UTF-16 object-key ordering;
- exact Source SHA-256 helpers, Envelope hashing, and seven-part LP_UTF8
  idempotency;
- structural validation for Envelope, Batch, Checkpoint, Receipt, Error,
  Lifecycle, and Connector Manifest wire objects;
- an explicit Domain Payload validator port;
- pure replay classification and steady-page convergence/checkpoint planning;
- I/O interfaces only, with no implementation;
- a fail-closed historical compatibility tuple matrix;
- SDK-owned tests and byte comparison against the unchanged current Go and
  TypeScript conformance reports.

The default input guard is 8 MiB and 64 container levels. The byte limit is
the released Connector Manifest transport bound. The depth limit is a
candidate SDK safety bound; it does not alter released Schema bytes.

## Excluded

The SDK contains no Source mapping, product DTO, registry discovery, network,
credential, database, filesystem, scheduler, worker, retry loop, runtime
selector, outbox, M0 event, EvidenceStore, product provenance, UI, or
product-local cursor codec.

Activation-forward is deliberately absent. A product establishes and durably
stores its activation fence locally, then calls the shared steady transition
only with an already-durable `phase=steady` Checkpoint. Ack remains a
product-owned operation performed only after durable CAS.

## Validation boundary

Generic Envelope validation does not imply validation of a referenced Domain
Payload Schema. A consumer must supply `PayloadValidator` before accepting a
payload in production. The unchanged authority runners continue to validate
the released Reference and LiteLLM payloads and remain independent byte
oracles.

The candidate currently rejects fractional and exponent JSON number tokens
before canonical emission. Frozen protocol vectors use integer tokens and are
byte-identical across the candidate and all unchanged runners. The written
RFC 8785 safe-integer profile and pre-existing runner behavior are not fully
aligned for unvectored integral exponent forms; this candidate does not
authorize adoption or publication until that variance receives a joint
protocol decision.

## Local verification

From the repository root:

```sh
bash scripts/run-sdk-candidate.sh \
  . \
  /path/to/a/new-temporary-directory
```

The command runs the unchanged release conformance kit first, then both SDK
test suites, byte-compares Go and TypeScript SDK reports, compares the 12
shared canonical/identity byte results to all four unchanged authority
reports, scans core dependencies, and proves released paths unchanged from
`fd82aeca9877bea8064b25c365a3cdcdd0bb3d16`.
