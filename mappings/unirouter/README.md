# UniRouter Source Mapping Candidates

This directory contains Source Domain Owner B9 candidate mappings for the
current UniRouter completed-execution Reference Connector.

These files:

- are pinned to UniRouter commit
  `bf91ea63a16952bb2925afd5438233cac597dcc1` and tree
  `ddadc277fbede49fac0cbc1cc561203312432ac3`;
- map current product-owned facts and states to the semantic decisions in Joint
  Candidate V3
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`;
- use symbolic `semantic:` references where B8 has not yet supplied an
  authoritative shared JSON path or enum;
- do not define an Event Envelope, Batch, Checkpoint, Receipt, Error, Manifest,
  SDK, or Conformance Schema;
- are non-binding until B8/B9 artifacts and the required three-party evidence
  are frozen in an immutable release.

Files:

- `source-snapshot-to-model-request-completed.v1.json` — exact Source Snapshot
  and Feed-item mapping, coverage, finality, gaps, hash, revision, and delivery
  exclusions.
- `source-lifecycle-to-shared-axes.v1.json` — Source-local connection,
  credential, outbox, feed, acknowledgement, and health observations mapped to
  V3 orthogonal lifecycle semantics.
- `connector-identity-to-source-local.v1.json` — portable Connector identity
  mapped to current UniRouter local identities, routes, capability, and stable
  `source_instance`.
- `source-contract-seeds.v1.json` — exact Source Schema/fixture SHA seeds and
  required offline boundary/negative evidence.

Run the bounded mapping validator:

```bash
python3 scripts/validate_unirouter_source_mappings.py \
  --source-repo /path/to/UniRouter \
  --joint-candidate /path/to/joint-candidate-v3.md
```

The validator reads Git objects from the pinned commit. It does not use the
UniRouter working tree, access live data, or perform runtime operations.
