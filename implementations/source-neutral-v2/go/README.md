# Go source-neutral v2 conformance runner

This zero-network implementation independently evaluates the non-binding
source-neutral v2 vector bundle.

Invocation:

```text
foigent-source-neutral-conformance-go --bundle <bundle> --report <report>
```

It does not load product code, credentials, network state or runtime data.
The candidate suite proves 83 cases across 29 required classes, including
conditional OpenInference facts/Gaps, bounded multi-span ordering,
trace-scoped parent resolution, fail-closed Source-shape errors and exact
operation-discriminated Operational Receipt control/data state,
mode/operation/status/error/count/acknowledgement semantics, and exact nested
control Error phase/operation/recovery binding.
The existing Binding v1 Go implementation remains byte-identical in
`implementations/go`.
