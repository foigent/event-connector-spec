# Go source-neutral v2 conformance runner

This zero-network implementation independently evaluates the non-binding
source-neutral v2 vector bundle.

Invocation:

```text
foigent-source-neutral-conformance-go --bundle <bundle> --report <report>
```

It does not load product code, credentials, network state or runtime data.
The candidate suite proves 47 cases across 28 required classes, including
conditional OpenInference facts/Gaps, bounded multi-span ordering,
trace-scoped parent resolution and fail-closed Source-shape errors.
The existing Binding v1 Go implementation remains byte-identical in
`implementations/go`.
