# Independent Go Conformance Runner

This directory contains the independent Go implementation for the exact
Foigent Event and Connector Protocol `1.0.0-rc.1` candidate.

Candidate pins:

- commit: `f737ca27ebd27342d9a8dc421a44507b5a2a60d8`
- tree: `87f30c9765d911f7451dcd7c1aeb72f4974b92fc`
- canonical vector bundle SHA-256:
  `98659630f3e1238d2684c2b4cba728334f4bdace67ff033652676d9d505caf33`
- Golden fixture bundle SHA-256:
  `b56de610d4444b655e3f700e61ec490caa1fc1d8658db1660192686c0fc1a268`
- report-encoding addendum commit:
  `30a2abeb4877253557aaa9d9cbd5a6400eb9c6c3`
- report-encoding addendum tree:
  `987d7c2ee5de05f25b53b875d3d0cf630b79b94a`
- conformance contract SHA-256:
  `35658164aa5dd87611b09be016a0beb0713b61923ae344e96740fa4d8235c291`
- conformance report Schema SHA-256:
  `42048fbf5a5edc2ca4476727563ab41e96a8fb6d3788d446e0e0d7c4154a31a7`

The implementation does not import, inspect, or execute another language's
runner. It uses no network, credentials, runtime service, cursor, Checkpoint,
or product database. All inputs are immutable files below this repository.

Build and run with module downloads disabled:

```sh
cd implementations/go
GOPROXY=off go build -o /tmp/foigent-conformance-go ./cmd/foigent-conformance-go
cd ../..
/tmp/foigent-conformance-go \
  --bundle vectors/canonical-vector-bundle.v1.json \
  --report conformance/reports/go-v1.json
```

The invocation is exactly:

```text
<runner> --bundle <bundle> --report <report>
```

The report is deterministic RFC 8785 canonical JSON. Result encoding follows
the frozen contract:

- canonical Envelopes, LP identity inputs, opaque UTF-8, and derived Gap arrays
  are emitted as exact bytes;
- validity classifications, expected errors, and replay/Checkpoint state
  transitions are emitted as RFC 8785 canonical JSON bytes;
- every case carries standard padded base64 and a lowercase SHA-256 reference
  over those exact result bytes.
