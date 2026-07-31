# TypeScript source-neutral v2 conformance runner

This Deno implementation independently evaluates the non-binding source-neutral v2
vector bundle with no network access.

Invocation:

```text
deno run --allow-read --allow-write src/runner.ts \
  --bundle <bundle> --report <report>
```

The Binding v1 TypeScript implementation remains byte-identical in
`implementations/typescript`.

The candidate suite proves 83 cases across 29 required classes, including
conditional OpenInference facts/Gaps, bounded multi-span ordering,
trace-scoped parent resolution, fail-closed Source-shape errors and exact
operation-discriminated Operational Receipt control/data state,
mode/operation/status/error/count/acknowledgement semantics, and exact nested
control Error phase/operation/recovery binding.
