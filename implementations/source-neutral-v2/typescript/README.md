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
