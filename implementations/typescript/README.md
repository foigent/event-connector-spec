# Independent TypeScript conformance runner

Status: `B6_TYPESCRIPT_CANDIDATE_NOT_BINDING`

This implementation independently consumes the frozen
`foigent.canonical-vector-bundle.v1` candidate. It does not import or call the Go
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

## Pinned candidate

- Candidate base: `f737ca27ebd27342d9a8dc421a44507b5a2a60d8`
- Report-precision addendum: `30a2abeb4877253557aaa9d9cbd5a6400eb9c6c3`
- Report-order addendum: `191411618714957accbdf0124b64c800e3ae1a4f`
- Canonical vector bundle SHA-256:
  `98659630f3e1238d2684c2b4cba728334f4bdace67ff033652676d9d505caf33`
- Golden fixture bundle SHA-256:
  `b56de610d4444b655e3f700e61ec490caa1fc1d8658db1660192686c0fc1a268`
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

The implementation is pinned to the exact candidate bundle, Golden bundle and
precision-addendum digests supplied for this B6 review. A different digest fails as an
invalid protocol artifact instead of silently changing semantics.
