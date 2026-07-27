# Independent TypeScript conformance runner

Status: `B6_TYPESCRIPT_CONFORMANCE_IMPLEMENTATION_V1`

This implementation independently consumes the frozen
`foigent.canonical-vector-bundle.v1` release input. It does not import or call the Go
implementation and has no network permission.

## Runtime

- Deno 2 with TypeScript type checking.
- No third-party packages.
- No network access or credential inputs.

Exact invocation:

```text
<runner> --bundle <bundle> --report <report>
```

The executable source runner is:

```text
implementations/typescript/src/runner.ts
```

Its shebang grants only filesystem read and write permissions. It never grants network
access.

`deno task build` performs Deno's compile-and-cache stage with all remote and npm
resolution disabled. No separate distributable is needed because the checked source is
the executable runner. The task intentionally does not use `deno compile` or
`deno bundle`: those commands may fetch an uncached native runtime or platform bundler.

## Pinned release input

- Candidate base: `f737ca27ebd27342d9a8dc421a44507b5a2a60d8`
- Report-precision addendum: `30a2abeb4877253557aaa9d9cbd5a6400eb9c6c3`
- Report-order addendum: `191411618714957accbdf0124b64c800e3ae1a4f`
- Canonical vector bundle SHA-256:
  `50fc8e8be08c37381611d6423e29780894741fb108fc4569df7c895452e5d4db`
- Golden fixture bundle SHA-256:
  `e71eef0cc0a3388d5563eeda0c178b751af34bd856f0bdc2b7dc85b00df75a86`
- Conformance contract SHA-256:
  `f3ae834265170ff22088943283fd23dcb562bc2308571ccc722414c2c896dc23`
- Report Schema SHA-256:
  `42048fbf5a5edc2ca4476727563ab41e96a8fb6d3788d446e0e0d7c4154a31a7`

Case naming, class lists, ordering and result-byte recipes are read from and checked
against the exact addendum contract. The implementation does not maintain an editable
second copy of those report semantics.

## Verification

From this directory:

```text
deno task typecheck
deno task test
deno task build
```

From the repository root:

```text
implementations/typescript/src/runner.ts \
  --bundle vectors/canonical-vector-bundle.v1.json \
  --report conformance/reports/typescript-v1.json
```

The implementation is pinned to the exact release-input bundle, Golden bundle and
conformance-contract digests. A different digest fails as an
invalid protocol artifact instead of silently changing semantics.
