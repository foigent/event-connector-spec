# TypeScript SDK candidate

Package: `@foigent/event-connector-sdk`

Exports:

- `.`
- `./canonical`
- `./compatibility`
- `./protocol/v2-candidate`
- `./experimental/page-plan`
- `./testkit`
- `./testkit/replay`

The package has no third-party runtime dependency and supports offline Deno typecheck,
test, and build. It is deliberately private and unpublished.

Core modules contain no `Deno`, filesystem, HTTP, product repository, or
runtime dependency. The testkit runner owns bounded offline fixture I/O.
The experimental page planner is pure and owns no port. ReplayLedger exists
only under testkit. No module establishes an activation fence, persists or
interprets Cursor, performs Ack, or implements product transactions.

Envelope and Batch parsing requires a caller-supplied pinned payload validator.
The SDK enforces callback presence, invocation, and receipt shape; the
consumer owns immutable Schema resolution and the truthfulness of that
validation receipt. The compatibility catalog is likewise caller-supplied and
exact-digest checked; it is not duplicated inside the package.
