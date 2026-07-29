# Foigent Event & Connector SDK candidate

Status: `0.1.0-candidate.3`, local future-major semantics candidate only.

This directory contains source-neutral Go and TypeScript implementations of
the shared protocol mechanics. It does not change any released protocol,
Schema, fixture, manifest, conformance runner, release manifest, product pin,
or product runtime.

## Packages

- `go/{canonical,compatibility,protocol/v2candidate,testkit}`
- `go/experimental/pageplan`
- `typescript/src/{canonical,compatibility,protocol,testkit}`
- `typescript/src/experimental/page_plan.ts`
- `compatibility-catalog.v1.json`
- `candidate-wire-boundary-vectors.v1.json`

The public package names are:

- Go module: `github.com/foigent/event-connector-spec/sdk/go`
- TypeScript package: `@foigent/event-connector-sdk`

The TypeScript package is deliberately `"private": true`; neither package is
published by this candidate.

## Included

- bounded strict JSON parsing with duplicate-key and invalid-Unicode rejection;
- the non-binding future-major exact-decimal safe-integer candidate and UTF-16
  object-key ordering;
- exact Source SHA-256 helpers, Envelope hashing, and seven-part LP_UTF8
  idempotency;
- structural validation for Envelope, Batch, Checkpoint, Receipt, Error, and
  Lifecycle wire objects;
- mandatory invocation of a caller-supplied pinned Domain Payload validator
  for Envelope and every Batch item;
- immutable/copy-isolated validated results;
- one caller-supplied, exact-digest compatibility catalog with no compiled
  language tuple copies;
- replay classification under testkit only;
- a pure experimental page planner with no provider ports;
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

Fetch, normalize, Commit, Checkpoint load/CAS, Receipt recording, Ack,
activation-forward, Cursor interpretation, and every product transaction
remain product-local. The experimental planner accepts copied scalar state
only and cannot prove persistence or convergence.

## Validation boundary

Envelope and Batch parsing fails closed without `PayloadValidator`. The
validator contract requires exact `schema_ref`/`schema_version` resolution,
offline validation against immutable Schema bytes, and a verified Schema
SHA-256 receipt. The SDK rejects an absent validator or an invalid digest.
The SDK can prove that the callback was present, invoked, and returned a
well-formed digest; it cannot prove that a dishonest or defective callback
actually performed Schema resolution and validation. A production adapter
must supply that proof, and package qualification must test it against the
digest-pinned Schema authority.

Candidate.3 accepts fraction or exponent tokens only when exact decimal
reduction produces a safe integer, and canonicalizes them to the shortest
base-10 integer. It accepts input and normalized UTC years `0000`–`9999` and
rejects normalized expanded years. The active 19-number/7-time candidate
matrix exercises these boundaries in both languages.

These semantics are `V2_SEMANTICS_CANDIDATE_NOT_BINDING`, not a v1 erratum.
They do not assign version `2.0.0` and cannot be adopted by either product
without a separately authorized major release, released discriminator
vectors, migration/rollback guidance, and compatibility negotiation.

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
