# Go SDK candidate

Module: `github.com/foigent/event-connector-spec/sdk/go`

- `canonical`: bounded strict JSON, canonical bytes, hashes, timestamp,
  decimal, NFC, LP_UTF8 identity, and idempotency.
- `protocol`: strict shared wire validators, historical compatibility pins,
  and a Domain Payload validator port.
- `kernel`: replay classification, steady-only convergence/checkpoint
  planning, and port interfaces.
- `testkit`: offline comparison of immutable shared vector bytes.

Core packages use only the Go standard library and
`golang.org/x/text/unicode/norm`. The dependency is pinned and vendored.
`cmd/sdk-conformance` is local test tooling, not a runtime.

No package establishes an activation fence or implements an I/O port.
