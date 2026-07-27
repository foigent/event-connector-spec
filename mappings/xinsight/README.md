# X-Insight projection candidates

Status: `B9_CANDIDATE_NOT_BINDING`

These product-owned artifacts describe the current X-Insight compatibility
projection for the first Reference Connector. They are evidence for Phase 1
review; they are not shared B8 Schemas, an SDK, a release pin, or authorization
to change either product runtime.

Authoritative inputs:

- Joint Candidate V3 SHA-256:
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- X-Insight `origin/main` commit:
  `c27b39f67b0e72de7f60975ff8b0e94dfc05520f`
- X-Insight `origin/main` tree:
  `16a4930f014c35531b01cc4bd44c25bd29a53ae8`

Artifacts:

- `model-request-completed-to-m0-m0.1-v1.json` — exact
  Source/shared/M0 projection and capture/provenance boundaries.
- `connector-lifecycle-to-current-xinsight-v1.json` — shared lifecycle axes
  projected onto current durable worker, service and read surfaces.
- `portable-connector-identity-to-current-xinsight-v1.json` — portable
  Connector identity projected onto current product-local registry identities.
- `completed-execution-compatibility-seed-v1.json` — synthetic settled and
  cancelled compatibility seeds, including the current ten M0 event
  identities/hashes, eight first-class Gap rows, two import provenance
  identities and read-model expectations.

The JSON files deliberately have no JSON Schema in this candidate. B8 shared
Schemas and the coordinator-authored canonical vector bundle do not yet exist
in this worktree. TypeScript canonicalization must not be inferred from these
product mappings.
