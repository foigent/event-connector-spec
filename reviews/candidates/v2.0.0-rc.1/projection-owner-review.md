# Protocol 2.0.0 RC1 Projection Owner Review

Role: `projection_owner`

Status: `PROJECTION_OWNER_V2_RELEASE_CANDIDATE_CONFIRM_NON_BINDING`

Semantic conflict: `NONE_IDENTIFIED_WITH_SUPERSEDING_SHARED_CANDIDATE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority state

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2-source-neutral-candidate`
- reviewed candidate commit:
  `a1b13ff3f6ee9a6170a2db9b1020fbddf97eac64`
- reviewed candidate tree:
  `afe8adbc38b17808e529016112c8e0b80d3ce824`
- protocol version: `2.0.0`
- protocol status: `NOT_BINDING`
- candidate manifest:
  `docs/candidates/v2.0.0-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:62af363b362801d14d9f8d77b8236bd92aedb02913fa56b74c5e33345e5cdd81`
- reviewed content digest:
  `sha256:b0352139436ae9b58652cb3c19ef895a4b5a226eb638873cd6d4d760bc1b1f3c`

## Superseded evidence

Three earlier Projection Owner reviews are superseded and must not be used for a
release gate:

1. commit `a61ab21b013c5b69e103b8ebc8713e52e1a13880`, content digest
   `sha256:219401b98705b9787d4186b919dbf02d9d242a385cec956120b0870d401412ef`;
2. commit `eda7f9d05e39301a1fd6954270ed2b751530c637`, content digest
   `sha256:d4403333a4e932a3383a72918d151a5c6a78f6df35eb29b6d0833e96f95247c1`;
3. commit `cec87cc33d84d0d9c41386872ff6329c6d83dda1`, content digest
   `sha256:5591a6c3b4b86e3af2d39016a376961a19cf71aea71c3fcb9c6de755a08be163`.

The first candidate claimed optional OpenInference facts, conditional Capture
Gaps, strict status handling and bounded multi-span ordering while its shared
implementations and vectors proved only one fully populated Span. The second
candidate closed that proof mismatch but independent Source/Coordinator review
found three additional release gates: Operational Receipt cross-field and
safe-integer semantics were underconstrained, the one-shot Python 3.14 test
entry depended on protocol-root spelling, and the X-Insight projection
recorded a 39-character value as a Git tree. The third candidate closed those
three defects. Independent Source review then found that its
delivery-mode-discriminated Receipt forced lifecycle/control operations to
fabricate request, bundle, acknowledgement or Checkpoint state. The exact
candidate reviewed here replaces that shape with an operation-discriminated
mode-neutral control state and closes the lifecycle contradiction without
changing Event identity, hash or any M0 seed.

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
  `16a4930f014c35531b01cc4bd44c25bd29a53ae8`

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
9. A bounded export counts selected and skipped Spans against the same
   `max_spans=200` limit, skips non-LLM records deterministically and emits
   sanitized LLM records in `trace_id`, then `span_id` order.
10. Session, provider, token, actor and service facts are optional. Missing
    facts stay absent; they are not silently replaced with zero or empty
    values. Actor fallback and empty usage provenance are marked `gap`.
11. Conditional Gap derivation is exact: missing session adds
    `authoritative_session`, any incomplete token triple adds `token_usage`,
    and a declared parent absent from the same trace inside the bounded
    sanitized LLM batch adds `causal_parent`.
12. Symbolic and numeric OTLP `UNSET`, `OK` and `ERROR` codes are handled
    deterministically. Unknown status, malformed Trace identity, reversed
    time and over-bound exports fail closed.
13. Operational Receipt counts are JSON safe integers in
    `0..9007199254740991`. Mode, operation, status, error retryability,
    acknowledgement, Checkpoint applicability and exact count accounting are
    fail-closed.
14. Lifecycle/control operations use a mode-neutral `control` state, have five
    zero counts and never fabricate a request, bundle, acknowledgement or
    Checkpoint. Only data-plane operations bind mode-specific delivery state.
15. Push data acknowledgement is durable only for a completed operation;
    accepted and error states withhold it. Completed receipts have no error,
    conflict or rejected item. Every non-accepted receipt accounts for all
    received items.
16. The preserved dirty X-Insight checkout tree is the full 40-character Git
    tree `16a4930f014c35531b01cc4bd44c25bd29a53ae8`, and the validator now rejects
    truncated evidence identities.

The OpenInference reference connector is correctly limited to
`bounded_offline`. Manifest support for `otlp_http_push` is a protocol
capability, not evidence that an OTLP receiver exists.

The sanitized Source Schema retains its historical `xinsight://` identifier
only as a compatibility identifier because changing it would change the
Source hash and current M0 compatibility seed. Candidate authority, ownership
and semantics are pinned by `catalog/domain-catalog.v2.json`, the Schema bytes
and the source mappings.

The shared parent-resolution rule intentionally uses
`trace_id + parent_span_id`. The reviewed X-Insight candidate currently
indexes parent presence only by `span_id` across the batch. This does not
change any current compatibility seed, but it is recorded as an additional
fail-closed product migration requirement before activation.

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
integration, provenance and durable-receipt semantics, and must resolve parent
presence by `trace_id + parent_span_id` instead of a batch-global
`span_id` index. That migration must preserve the five M0 IDs/hashes above.
The current product-local `import_cursor` remains only a deterministic
source-event alias and must never carry delivery Cursor, request or bundle
identity.

## Conformance evidence

- source-neutral contract SHA-256:
  `sha256:b5ca71ce9e184a02c8a43aceb7830ab4dcbc0fa3b4f5f939e3094e76a94dfb3a`
- Operational Receipt Schema SHA-256:
  `sha256:ef206cfb49bb53ccf0adf810d7ac33e622f345732ccfccc193d28e2fb322aeb8`
- vector bundle SHA-256:
  `sha256:8d0413b182d5cf722ae5fc130fa07c6bb842c4b8094d0deb3c30e818a653044c`
- Go report SHA-256:
  `sha256:754ae42e3f0fc6d729ca081966e10f4721ec981977eb98c2a1cf2e3c89ff1236`
- TypeScript report SHA-256:
  `sha256:d84441e3c8fff607f50b81f6d7b8764dc8dbf1b6a6113303180b3b58b061bd4a`
- Go implementation manifest SHA-256:
  `sha256:2f7eb3dc3d4272d1d8bce0b0efa9ace0511d945200afcbcefc45cf4897dbd844`
- TypeScript implementation manifest SHA-256:
  `sha256:91c04793feb83d89451d5bf0400f2b52b16fdf328888d24c6858393596232a72`

Both zero-network implementations passed 78 of 78 cases covering all 29
required classes. Each runner produced byte-identical output across two
successive runs. After removing only `implementation` and
`implementation_version`, the Go and TypeScript reports are byte-identical.

The full candidate kit also passed:

- Binding v1.1.2 regression conformance: 30/30;
- Binding LiteLLM regression conformance: 30/30;
- v2 Schema compilation and positive/negative checks for pull, push and
  bounded-offline Manifest, lifecycle, batch, Checkpoint, receipt, error,
  Envelope, payload and mutable-delivery boundaries;
- five positive OpenInference mappings covering the preserved reference,
  missing optional facts with 7 exact Gaps, and a sorted three-record LLM
  batch with one skipped non-LLM Span and a resolved same-Trace parent;
- fail-closed OpenInference fixtures for unknown status, reversed time,
  malformed Trace identity and a 201-Span export;
- strict duplicate-key, decimal-int64, timestamp, Unicode, privacy,
  duplicate-noop, conflict, partial-batch, completeness and Capture Gap cases;
- 31 exact Operational Receipt cases covering all three delivery modes,
  nine lifecycle/control positive and negative cases, mode-scoped data
  operations, safe-integer boundaries, status/error coupling, arithmetic count
  conservation, acknowledgement and Checkpoint boundaries;
- one-shot Python 3.14.5 execution from the exact immutable archive at
  `/tmp/event_connector.spec_portability_20260731_a1b13ff`, whose protocol root
  contains both underscores and a dot;
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
