# Protocol 2.0.0 RC1 Projection Owner Review

Role: `projection_owner`

Status: `PROJECTION_OWNER_V2_RELEASE_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED_WITHIN_PROJECTION_OWNER_SCOPE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726`

## Reviewed authority state

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2-source-neutral-candidate`
- reviewed candidate commit:
  `27fe3319a069f691425247458406502cf2ed2312`
- reviewed candidate tree:
  `1f6b58234411a6cf8611103f20dccd3a47a213a3`
- protocol version: `2.0.0`
- protocol status: `NOT_BINDING`
- candidate manifest:
  `docs/candidates/v2.0.0-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:d4c7597a19d501b32378e8e8cabc776e72b0a21e76919101ac7f01035b4f2009`
- reviewed content digest:
  `sha256:219401b98705b9787d4186b919dbf02d9d242a385cec956120b0870d401412ef`

Binding predecessor:

- version/tag: `v1.1.2`
- tag commit: `fd82aeca9877bea8064b25c365a3cdcdd0bb3d16`
- tree: `d316d6ada678066ed7679a772856aea6157d869d`
- content digest:
  `sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813`
- release digest:
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`

X-Insight compatibility baselines:

- reviewed origin/main commit:
  `e6c1bd3e3d6e6433b5e5717dedd50488dcf521ee`
- reviewed origin/main tree:
  `1da84e19b81d52697acedc01f60446782e058023`
- OpenInference candidate commit:
  `d1ae3fe76057c9ff37f2fb7e870f2190c47b3745`
- OpenInference candidate tree:
  `79cabc9f4c7b5b425e3fc09590af5bd07af87047`
- ancestry: reviewed origin/main is an ancestor; the OpenInference candidate
  is seven commits ahead
- preserved dirty checkout HEAD:
  `c27b39f67b0e72de7f60975ff8b0e94dfc05520f`
- preserved dirty checkout tree:
  `16a4930f014c35531b01c4bd44c25bd29a53ae8`

## Projection conclusion

The candidate resolves the previously identified source-specific transport
conflict without changing Event Envelope v1, Event identity, canonicalization,
hash or X-Insight M0 semantics:

1. Connector Manifest v2 is a closed union over exactly one of `https_pull`,
   `otlp_http_push` or `bounded_offline`.
2. Cursor, high-watermark and Connector Checkpoint apply only to
   `https_pull`. Push uses request acknowledgement; bounded-offline uses an
   immutable bundle digest and durable receipt.
3. Delivery-scope completeness is independent from execution-timeline
   completeness. Partial or unavailable execution evidence remains represented
   by first-class Capture Gaps.
4. `ingestion_capture_mode` remains separate from `payload_capture_mode`.
   Mutable delivery and ingestion state remains outside Event identity, hash
   and event-linked import provenance.
5. Parent `time.observed_at` remains absent. `time.occurred_at` is the exact
   deterministic alias of `time.terminal_at`; fetch, receive and ingestion
   times remain outside the Event.
6. Token counters are canonical nonnegative decimal strings and both Schema
   and independent implementations enforce the numeric upper bound
   `9223372036854775807` without binary floating-point coercion.
7. NFC rejection applies only to protocol-controlled strings. Opaque Source
   UTF-8 remains byte-preserving and is neither silently normalized nor
   rejected solely for being non-NFC.
8. Manifest coverage and exact `source_instance` to `producer.instance`
   binding are explicit.

The OpenInference reference connector is correctly limited to
`bounded_offline`. Manifest support for `otlp_http_push` is a protocol
capability, not evidence that an OTLP receiver exists.

The sanitized Source Schema retains its historical `xinsight://` identifier
only as a compatibility identifier because changing it would change the
Source hash and current M0 compatibility seed. Candidate authority, ownership
and semantics are pinned by `catalog/domain-catalog.v2.json`, the Schema bytes
and the source mappings.

## Compatibility conclusion

Compatibility: `COMPATIBLE_WITH_FAIL_CLOSED_PRODUCT_MIGRATION_GATE`

Verified preservation:

- all 57 components in the Binding v1.1.2 release manifest are byte-exact;
- the UniRouter compatibility seed remains exactly 10 M0 Event ID/hash pairs,
  8 first-class Gap rows, 2 provenance identities and the settled/cancelled
  read-model expectations;
- the UniRouter and LiteLLM compatibility matrices remain byte-exact;
- the OpenInference candidate remains exactly 1 main M0 Event plus 4
  first-class Gap Events, with all 5 current IDs/hashes and current trace,
  session, provider, model and token read-model expectations unchanged;
- shared OpenInference Source hash, idempotency key and Envelope hash remain:
  - `sha256:533e33c2e02a6a67632107ae99f3993eee1a1da39835029521a4c3fe0ceb4708`;
  - `sha256:7e955832524e293df668d87d39c5a17303916c25b2e8ff87b5fbf4ca8bac851b`;
  - `sha256:02dc4475ff08b58ded11359de849f23c0b1d2dd378d376adfe6c2f09e7ea6819`.

The X-Insight activation gate remains
`blocked_product_migration_required`. Before product activation, X-Insight
must replace its current OpenInference `connector_pull` / `contracted_pull`
classification and pull Checkpoint construction with bounded-offline
integration, provenance and durable-receipt semantics. That migration must
preserve the five M0 IDs/hashes above. The current product-local
`import_cursor` remains only a deterministic source-event alias and must never
carry delivery Cursor, request or bundle identity.

## Conformance evidence

- source-neutral contract SHA-256:
  `sha256:f11d263a7d2b8e98240a9a9750f349d83c1f8a12263682a49601b74eb7e891d2`
- vector bundle SHA-256:
  `sha256:cbbcc45af8f2c5b0b12bb23e1094953661c352a1b506233c85405be47baf075f`
- Go report SHA-256:
  `sha256:3d234682fa6b924f9a77b1cbee9b3d14436cb8e935469528a026ce091fc55a97`
- TypeScript report SHA-256:
  `sha256:08b390097713a2f4d68ad81ca60006f57a0b838d2161ab23c1fb2bcf41225313`
- Go implementation manifest SHA-256:
  `sha256:e002d639181577a13e42d0d9650a2081bb778fa60f18a8eca5a4fe70929ec4fb`
- TypeScript implementation manifest SHA-256:
  `sha256:e8ca589842034f883c8b49e6e4e226a8bc776854c768e20e9d0b5837b63d4ed7`

Both zero-network implementations passed 39 of 39 cases covering all 23
required classes. Each runner produced byte-identical output across two
successive runs. After removing only `implementation` and
`implementation_version`, the Go and TypeScript reports are byte-identical.

The full candidate kit also passed:

- Binding v1.1.2 regression conformance: 30/30;
- Binding LiteLLM regression conformance: 30/30;
- v2 Schema compilation and positive/negative checks for pull, push and
  bounded-offline Manifest, lifecycle, batch, Checkpoint, receipt, error,
  Envelope, payload and mutable-delivery boundaries;
- strict duplicate-key, decimal-int64, timestamp, Unicode, privacy,
  duplicate-noop, conflict, partial-batch, completeness and Capture Gap cases;
- deterministic artifact, implementation-manifest and candidate-manifest
  reconstruction;
- X-Insight compatibility validator and mutation-failure tests;
- unchanged v1.1.2 release-manifest reconstruction.

## Remaining governance and implementation boundaries

This review is Projection Owner candidate evidence only. It does not make the
protocol Binding and does not authorize a release.

The exact candidate still requires:

1. Source Domain Owner confirmation over the same content digest;
2. Coordinator confirmation over the same content digest;
3. reviewed authority integration and CI evidence;
4. only after all three confirmations, an immutable `v2.0.0` tag and canonical
   release manifest;
5. separate product authorization and implementation for the X-Insight
   bounded-offline provenance/Checkpoint migration;
6. separate future implementation and review for any live OTLP HTTP receiver.

No product repository, runtime, deployment, traffic, credential, database,
Cursor, Checkpoint or service state was changed. Phase 2 and product adoption
remain unauthorized.
