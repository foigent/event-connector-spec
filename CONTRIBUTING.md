# Contributing

## Before proposing a change

1. Identify the affected protocol release or candidate.
2. Classify the change as semantic or non-semantic using [GOVERNANCE.md](GOVERNANCE.md).
3. Link the governing work item or decision.
4. State which product mappings and compatibility seeds may be affected.

Do not include live credentials, customer data, runtime dumps, or product-owned implementation code.

## Required PR evidence

A semantic change PR must include:

- exact base and candidate digests;
- Source Owner review identity;
- Projection Owner review identity;
- Coordinator disposition identity;
- identity, idempotency, hash, canonicalization, time, numeric, gap, and lifecycle impact;
- compatibility classification;
- required Golden, negative, boundary, and replay vectors;
- Go and TypeScript conformance results when those artifacts exist;
- explicit non-goals and runtime nonclaims.

Use the repository pull request template. Missing evidence is a fail-closed condition.

## Artifact rules

- Shared definitions are edited only here.
- Generated or vendored product copies are read-only and digest-pinned.
- Canonical bytes and digests are reproducible.
- Released files are immutable.
- Delivery state is separate from event and item-linked provenance identity.
- Product-local event models remain product owned; shared envelopes are Connector input, not direct product database rows.

## Scope discipline

B7 governance work does not authorize B8 artifact creation or Phase 2 code extraction. Schema, fixtures, SDK, conformance runner, product mapping tables, CI pins, and release publication require their own accepted scope and evidence.
