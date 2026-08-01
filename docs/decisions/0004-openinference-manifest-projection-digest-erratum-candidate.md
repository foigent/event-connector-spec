# Decision 0004: Protocol v2.0.1 OpenInference projection digest erratum assembly

Status: `RELEASE_CONTENT_CANDIDATE_NOT_BINDING`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Verified defect

The immutable Protocol `v2.0.0` release contains two contradictory references
to the same X-Insight OpenInference projection:

- `releases/v2.0.0/release-manifest.json` binds
  `mappings/xinsight/openinference-span-to-m0-m0.1-v2.json` at
  `sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077`;
- `manifests/foigent.openinference.otlp-spans-1.0.0.json` embeds the superseded
  digest
  `sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2`
  for that exact path.

The released projection bytes are not defective. The stale internal Manifest
reference is the defect, and the v2.0.0 tag and released bytes remain
immutable.

## Candidate gate

The exact corrected candidate content at commit
`61e21ee6988814f2d4a785bcf1723f5ce9dc49b1`, tree
`9c152180d9132fa279c75b8b6cc4cfaac895d411`, and content digest
`sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba`
has independent non-binding Source Owner, Projection Owner and Coordinator
candidate reviews under `reviews/candidates/v2.0.1-rc.1/`.

Those reviews authorize only exact local release-content assembly. They are
not final release approvals and cannot be copied into the release manifest.

## Disposition

Assemble patch release candidate `2.0.1`. The release must:

1. retain every Event, Source, Envelope, M0, Gap, provenance, identity,
   idempotency, canonicalization and hash semantic from `2.0.0`;
2. change only the OpenInference Manifest projection reference from `b374...`
   to the released projection digest `d5abc...`, plus the minimum release,
   validation and review evidence required for an immutable patch release;
3. add a fail-closed validation that resolves the referenced path and compares
   its exact SHA-256, so a top-level component list cannot mask a stale nested
   reference;
4. publish a new immutable tag, release manifest, content digest and release
   digest rather than modifying `v2.0.0`;
5. classify product adoption separately from runtime activation.

## Compatibility

Proposed classification:
`PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM`.

The following must remain byte-identical to `v2.0.0`:

- Event Envelope, Capture Gap, lifecycle, Checkpoint, batch, error and
  Operational Receipt Schemas;
- canonical and conformance vectors and the Go/TypeScript reports;
- five OpenInference M0 Event IDs/hashes and four Gap Events;
- ten existing Reference Connector M0 IDs/hashes, eight Gap rows, two
  provenance IDs and read-model expectations;
- the OpenInference projection file at `sha256:d5abc...`;
- Source, Envelope, idempotency, canonicalization and hash outcomes.

## Boundary

This release-content candidate is not Binding. It requires three fresh final
release approvals over one exact assembled content digest before a canonical
release manifest may be created. It authorizes no product migration, runtime
activation, deployment, traffic, credentials, Cursor/Checkpoint or database
mutation. X-Insight bounded-offline receipt implementation and any later
runtime activation remain product-owned, separately reviewed decisions.
