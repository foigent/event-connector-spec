# Go SDK candidate

Module: `github.com/foigent/event-connector-spec/sdk/go`

- `canonical`: bounded strict JSON, canonical bytes, hashes, timestamp,
  decimal, NFC, LP_UTF8 identity, and idempotency.
- `protocol/v2candidate`: future-major candidate wire validation with a
  mandatory caller-supplied pinned Domain Payload validator and copy-isolated
  results.
- `compatibility`: one caller-supplied, exact-digest catalog; no compiled
  compatibility tuples.
- `experimental/pageplan`: pure scalar planning only; no ports or persistence.
- `testkit`: offline vector comparison and replay classification.

Core packages use only the Go standard library and
`golang.org/x/text/unicode/norm`. The dependency is pinned and vendored.
`cmd/sdk-conformance` is local test tooling, not a runtime.

No package establishes an activation fence or implements Fetch, Commit,
Checkpoint, Receipt, Ack, credential, network, registry, database, or other
product I/O.

The protocol package enforces validator presence, invocation, and receipt
shape. Schema loading and the truthfulness of the validation receipt remain
the responsibility of the consumer-supplied offline validator.
