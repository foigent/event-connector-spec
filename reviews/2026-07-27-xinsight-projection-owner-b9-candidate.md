# X-Insight Projection Owner — B9 Candidate Evidence

Status:
`PROJECTION_OWNER_B9_CANDIDATE_READY_B6_WAITING_FOR_EXACT_B8_BUNDLE`

This is product-owner candidate evidence for
`FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`. It is non-binding and does
not close B6, freeze B8, close B9, authorize Phase 2, or authorize any runtime
action.

## Reviewed immutable baselines

- Joint Candidate V3:
  `/Users/m4/Desktop/projects/UniRouter-X-Insight Cooperation/decisions/2026-07-27-foigent-event-connector-platform-v1-phase1-joint-decision-candidate-v3.md`
- Joint Candidate V3 SHA-256:
  `f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f`
- X-Insight `origin/main` commit:
  `c27b39f67b0e72de7f60975ff8b0e94dfc05520f`
- X-Insight `origin/main` tree:
  `16a4930f014c35531b01cc4bd44c25bd29a53ae8`
- Protocol authority base:
  `5036659978c74922342c5d59a3c830a35c7ffe3b`

X-Insight evidence was read from exact `origin/main` Git objects. The existing
X-Insight checkout and runtime were not modified.

## Candidate artifacts

| Artifact | SHA-256 |
| --- | --- |
| `mappings/xinsight/README.md` | `c443dc49a95dd95985ac22e65995d10d228298ee2295e27626b840a0ad5dee04` |
| `mappings/xinsight/model-request-completed-to-m0-m0.1-v1.json` | `a2d1e312fb9c629a339e943438cf37e5b5863e9ab8611d542988c4cf1095f343` |
| `mappings/xinsight/connector-lifecycle-to-current-xinsight-v1.json` | `8d680462b5547974654f24ff7918b3cbe5e56cc2e2b21749e4ee64747b8595b8` |
| `mappings/xinsight/portable-connector-identity-to-current-xinsight-v1.json` | `fc23d8a2762b530862089930d0d366cd06c4b5062138136a0a7ba0f1f5a3cdf4` |
| `mappings/xinsight/completed-execution-compatibility-seed-v1.json` | `b3f31ff82e5ca9de5e2d049ac351d4c97d42f47bcfe895b93f092510570414de` |
| `tests/test_xinsight_projection_artifacts.py` | `2f56ca286179843682cbe53dcb4e4ac604d422d037fa3f08cb45eae8257cb9b3` |

No shared Schema, SDK, Manifest, release manifest, canonical Envelope fixture or
Conformance implementation was created.

## Projection findings

### Parent Event and current M0

- The shared parent event remains `model.request.completed` with terminal
  status `settled|cancelled`.
- Parent shared `observed_at` is absent.
- Shared `occurred_at` is only a deterministic alias of `terminal_at`.
- Current M0 `occurred_at` and `observed_at` both remain target-local
  derivations of the exact Source terminal instant, preserving current hashes.
- Page generation, fetch, receive and Consumer ingestion times remain outside
  the Event. Mutable delivery state remains outside M0 identity/hash and
  item-linked provenance.
- Canonical decimal-string token counters in
  `0..9223372036854775807` can be parsed losslessly into the current signed
  `int64` M0 representation without binary floating point. The two current
  seeds reproduce their existing M0 bytes and hashes.

### Capture and Gap semantics

- The exact shared B8 field location/enum for `ingestion_capture_mode` is not
  invented. Current M0 `capture_mode=api_import` remains distinct from
  `payload_capture_mode`.
- Parent payload capture remains `metadata_only`; Gap payload capture remains
  `none`.
- Every Source item still produces one terminal M0 event plus four sorted
  first-class Gap events and four first-class Gap rows.
- Shared Gap direct/derived/declared provenance and current M0 field provenance
  are mapped separately.
- Contracted-pull provenance remains limited to exact payload SHA, immutable
  revision `"1"`, terminal time and `timeline_complete=true`.
  `source_watermark` and `import_watermark` remain empty.

### Identity and lifecycle

- Portable Connector identity maps explicitly to the existing fixed
  `source_system_id`, `adapter_manifest_id`, projection profile, cursor key and
  stable `source_instance` activation binding. It replaces none of them.
- Configuration, authentication, transport, processing, checkpoint and health
  are mapped as separate conceptual axes onto current product-local state.
- Current investigation APIs and UI do not expose `adapter_import_states` or
  host service lifecycle. They expose accepted Evidence, Gap and import
  provenance/read-model state only. A Connector lifecycle read model remains a
  future X-Insight implementation gap.

## Exact compatibility result

The synthetic-only settled/cancelled bundle pins and independently recomputes:

- 10 current M0 event IDs and hashes;
- all 10 current Source refs, local idempotency keys and import cursors;
- 8 first-class Gap row IDs and stable fields;
- 2 immutable import provenance IDs and all 10 event links;
- 2 deterministic `xe1_` execution IDs;
- execution outcome, event/gap counts, payload modes, freshness, timeline and
  search-order expectations;
- the exclusion of operational database/ingestion times from identity pins.

One important local compatibility detail is now explicit: current M0 event IDs
use the adapter package's SHA-256/UUID-v5-style bit masking, while database
Gap-row and import-provenance IDs use the DB package's legacy deterministic
formatter that forces the UUID version nibble to `5` and variant nibble to
`8`. These are separate target-local identity algorithms. A shared SDK must not
collapse them into one algorithm or put either into shared Event identity.

## Verification

Command:

```text
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Result: `9 tests`, `OK`.

Additional verification:

- `git diff --check`: passed.
- Exact X-Insight settled fixture: 1196 bytes,
  SHA-256
  `5e9eda0a2630d52c5589d38b8ec480604c47c2cc77391b75a57b2a159db6dd27`.
- Exact X-Insight cancelled fixture: 1201 bytes,
  SHA-256
  `31cbfeb23968c07d158b591c28efb3dd40cffba1fd6d1fd4202f43d63bfe9f2d`.

No database, service, worker, endpoint or live-data verification was performed
or required for this offline candidate.

## Semantic conflict assessment

No material conflict with exact V3 was found for the current settled/cancelled
projection.

Open dependencies are deliberately fail-closed:

1. Exact B8 Schemas and the coordinator-authored vector bundle are absent.
2. The exact protocol-controlled `producer.product` value is therefore not
   invented in this B9 seed.
3. Shared canonical bytes, LP identity, shared idempotency and Envelope hash
   remain null in this product compatibility seed.
4. TypeScript canonicalization and B6 boundary vectors have not started.
5. The exact B8 location/enum for `ingestion_capture_mode` remains open while
   its mandatory separation from `payload_capture_mode` is preserved.
6. B9 remains a candidate until the exact B8 contract and independent B6
   outputs are reviewed and the mapping/compatibility digests are frozen by
   the authorized three-party process.

## Zero mutation

This work:

- changed only the designated authority worktree on
  `codex/b6-b9-projection`;
- used only synthetic fixtures and exact Git-object source evidence;
- did not modify `/Users/m4/Desktop/projects/X-Insight`;
- did not deploy, start/stop/restart a service, run a worker, send traffic,
  access credentials, mutate Cursor/Checkpoint, or touch a database;
- did not push, open a PR or run CI;
- did not start the independent TypeScript B6 implementation.
