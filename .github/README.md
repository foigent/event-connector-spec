# Foigent Event & Connector Specification

**Shared contracts and cross-language tests for exchanging inspectable facts.**

[简体中文](README.zh-CN.md) · [Community contribution guide](../docs/COMMUNITY.md) ·
[Protocol v2](../spec/protocol-v2.md) · [License](../LICENSE)

This repository defines the shared event and connector contracts consumed by
UniRouter, X-Insight and reference integrations. It contains schemas, canonical
vectors, Go and TypeScript implementations, compatibility mappings and release
verification tools. Each product retains its own runtime and business logic.

It is useful when implementing a connector or checking whether an implementation
agrees on identity, canonical bytes, provenance, errors and replay behavior.
Conformance verifies the declared contract; it does not certify a deployment,
a model answer or the success of a business task.

## Run the consumer checks

Use Go 1.24.3, Deno 2.7.13, Node.js and Python 3, as used by the existing kit.
Once the repository is public:

```sh
git clone https://github.com/foigent/event-connector-spec.git
cd event-connector-spec
./scripts/run-source-neutral-v2-consumer-kit.sh "$PWD" "$(mktemp -d)/consumer" --release
```

The kit checks the release manifest, preserved v1 compatibility, generated
artifacts and independent Go/TypeScript conformance. It uses local fixtures and
vendored Go dependencies; no product checkout, provider credential, database
or live model call is needed. Keep the resulting evidence directory when
reporting a failure, and remove sensitive local context before sharing it.

## Releases and consumers

UR currently consumes protocol `2.0.2`. The source-neutral conformance set has
83 cases across 29 required classes; v1 `1.1.2` compatibility is preserved.
The [release manifest](../releases/v2.0.2/release-manifest.json) and consumer
pins define the exact contracts and evidence. A moving default branch is not
a replacement for those identities.

The [original authority overview](../README.md) records the preparation stage
at which its bytes were frozen into the release. Its candidate wording is
historical; this community landing page does not rewrite that bound file.
[Governance](../GOVERNANCE.md) and [protocol contribution requirements](../CONTRIBUTING.md)
continue to apply to semantic changes and release approvals.

## Contribute

Start with the [community guide](../docs/COMMUNITY.md). Documentation fixes,
reproducible contract questions and focused negative vectors are useful ways
to participate. English is the primary language; Chinese contributions are welcome.

Use [Issues](https://github.com/foigent/event-connector-spec/issues) for ordinary
questions, [Security](../SECURITY.md) for vulnerabilities, and follow the
[Code of Conduct](../CODE_OF_CONDUCT.md). Product feature requests belong in
their respective product repositories.

## License and status

Project-owned material is [Apache-2.0](../LICENSE), like UniRouter.
[Third-party licenses](../THIRD_PARTY_NOTICES.md) retain their own terms.
See [the licensing scope](../docs/LICENSING.md) for preserved historical snapshots.

This is an open-source preparation branch. Repository visibility and private
reporting availability still require publication verification. No schema,
release manifest, immutable tag or product runtime is changed by this work.
