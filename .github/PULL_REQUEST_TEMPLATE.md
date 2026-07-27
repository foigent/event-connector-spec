## Change classification

- [ ] Semantic protocol change
- [ ] Non-semantic governance or documentation change
- [ ] Release-manifest-only change

## Binding

- Work item / decision:
- Base version or candidate digest:
- Proposed version or candidate digest:

## Required role evidence

- Source Domain Owner approval and digest:
- Projection / Consumer Owner approval and digest:
- Coordinator disposition and digest:

## Contract impact

- Identity / event ID:
- Idempotency / revision / conflict:
- Source, envelope, and product hash domains:
- Canonical bytes, numeric, time, null, duplicate-key, and NFC rules:
- Capture gaps and provenance:
- Batch / checkpoint / receipt:
- Lifecycle, retry, replay, and error state:
- Compatibility and migration:

## Verification

- Golden and boundary vectors:
- Negative and replay vectors:
- Go conformance:
- TypeScript conformance:
- Product compatibility seeds:

## Safety and scope

- [ ] No credentials, customer data, or runtime state are included.
- [ ] Mutable cursor/high-watermark/retry/ingestion state is outside event identity and item-linked provenance.
- [ ] Product-local editable copies are not introduced.
- [ ] Runtime, deployment, traffic, and database effects are explicitly stated.
- [ ] Non-goals are explicit.
