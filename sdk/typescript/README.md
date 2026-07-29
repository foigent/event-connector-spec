# TypeScript SDK candidate

Package: `@foigent/event-connector-sdk`

Exports:

- `.`
- `./protocol`
- `./canonical`
- `./kernel`
- `./testkit`

The package has no third-party runtime dependency and supports offline Deno typecheck,
test, and build. It is deliberately private and unpublished.

Core modules contain no `Deno`, filesystem, HTTP, product repository, or runtime
dependency. The testkit runner owns the bounded offline fixture I/O. No module
establishes an activation fence or implements a port.
