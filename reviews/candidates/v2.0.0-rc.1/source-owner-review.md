# Protocol 2.0.0 RC1 Source Domain Owner Review

Role: `source_domain_owner`

Status: `SOURCE_OWNER_CONFIRM_NON_BINDING`

Semantic conflict: `NONE`

Work item: `FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V2-SOURCE-NEUTRAL-20260731`

## Reviewed authority state

- repository: `https://github.com/foigent/event-connector-spec`
- candidate branch: `codex/v2-source-neutral-candidate`
- reviewed candidate commit:
  `fc5ae57d21ca389ca5a73f6c95382a9874ed7152`
- reviewed candidate tree:
  `8a446c8404254198e648c1fd81c4ea52aad3a5ea`
- protocol version: `2.0.0`
- protocol status: `NOT_BINDING`
- candidate manifest:
  `docs/candidates/v2.0.0-rc.1/candidate-manifest.json`
- candidate manifest SHA-256:
  `sha256:ee046d1e06cbb3ab98a8565737ecd76ce71423be68e22d6f4f7b916ffcbb4b91`
- reviewed content digest:
  `sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`

This confirmation applies only to the exact commit, tree, manifest and content
digest above. Approval or confirmation of any preceding candidate is not
inherited. Any change to normative Schema, specification, vectors, mappings,
implementations, reports or candidate-manifest content requires a new exact
Source Domain Owner review.

## Source semantic conclusion

No Source-domain semantic conflict was identified in the exact candidate:

1. OpenInference optional session, provider, token, actor and service facts
   remain absent when unavailable; they are not fabricated as empty or zero
   values.
2. Symbolic and numeric OTLP `UNSET`, `OK` and `ERROR` values map
   deterministically. Unknown status values fail closed.
3. Selected and skipped records share the same bounded `max_spans=200` limit.
   Sanitized LLM records are emitted in deterministic `trace_id`, then
   `span_id` order.
4. Duplicate normalized `trace_id + span_id` identity is rejected.
5. Parent resolution uses the exact same-Trace identity
   `trace_id + parent_span_id`; an unresolved declared parent produces the
   conditional causal-parent Capture Gap.
6. Missing session and incomplete token facts produce their exact conditional
   Capture Gaps. Gap ordering, severity, linkage and replay identity remain
   deterministic.
7. Parent `time.observed_at` remains absent. `time.occurred_at` remains the
   deterministic alias of `time.terminal_at`; fetch, receive and ingestion
   times remain outside Event identity and hash.
8. Token counters remain canonical nonnegative decimal strings bounded by
   `9223372036854775807`. Protocol-controlled strings use the NFC profile;
   opaque Source UTF-8 remains byte-preserving.

## Lifecycle and data-plane receipt conclusion

The operation-discriminated Operational Receipt contract is compatible with
the Source-domain and delivery boundaries:

1. Lifecycle/control operations `activate`, `pause`, `resume`, `stop`, `start`,
   `rotate` and `retire` use the mode-neutral `control` state.
2. All five control counts are zero. A control Receipt cannot fabricate a
   request identity, bundle identity, acknowledgement or Checkpoint.
3. Pull data operations alone use pull Checkpoint state; push data operations
   alone use request acknowledgement state; bounded-offline data operations
   alone use bundle identity and digest.
4. Push acknowledgement is `durable` only for a completed push data
   operation. Pull Checkpoint commit applies only to a completed pull data
   operation. Offline bundle completion applies only to a completed offline
   data operation.
5. A lifecycle/control Error binds `error.operation` exactly to the outer
   lifecycle operation. Its phase mapping is:
   - `activate` to `activate`;
   - `pause`, `resume`, `start` and `rotate` to `status`;
   - `stop` and `retire` to `shutdown`.
6. Lifecycle/control Error recovery is restricted to `automatic_retry`,
   `restart`, `reauthorize`, `operator_repair` or `none`. Data-plane recovery
   values fail closed in a control Receipt.
7. Data-plane error phase, operation, recovery, retryability,
   acknowledgement, Checkpoint and count behavior remains mode-specific and
   unchanged.
8. On the wire, a non-error Receipt omits `error`; JSON `null` is not a valid
   Error object. Error statuses require a complete Error object. The immutable
   conformance-vector classifier uses explicit `null` sentinels for absent
   error context, and its exact bundle digest prevents silent field removal or
   substitution.

## Compatibility conclusion

Compatibility: `COMPATIBLE`

The exact candidate preserves:

- all 57 components of the Binding v1.1.2 predecessor;
- the UniRouter Reference Connector manifest and compatibility matrix;
- the LiteLLM Reference Connector manifest and compatibility matrix;
- the existing UniRouter compatibility seed of 10 M0 Event ID/hash pairs,
  8 first-class Gap rows and 2 provenance identities;
- the OpenInference Source, Envelope, identity, Gap and M0 compatibility
  artifacts;
- the separation of mutable delivery state from Event identity, hash and
  event-linked import provenance.

The candidate adds protocol capability and conformance evidence only. It does
not claim that a product has adopted a push or bounded-offline runtime.

## Independent conformance evidence

The review used an immutable archive created from the exact candidate:

- archive:
  `/private/tmp/event_connector_v2_source_owner_fc5ae57.SWJgHG`
- archive candidate-manifest SHA-256:
  `sha256:ee046d1e06cbb3ab98a8565737ecd76ce71423be68e22d6f4f7b916ffcbb4b91`

The exact one-shot conformance kit passed:

- Binding v1 Python compatibility tests: 29 tests, with 6 intentional skips;
- Binding v1 Schema audit: 22 Schemas, 2 Manifests and 5
  Envelopes/payloads;
- Binding v1 Go and TypeScript conformance: 30/30 cases each;
- Binding LiteLLM Go and TypeScript conformance: 30/30 cases each;
- Binding cross-language comparison: 30 cases across 14 required classes;
- source-neutral v2 artifact verification: 5 Envelopes and 83 cases;
- source-neutral v2 compatibility validation: all 57 predecessor components,
  10 v1 M0 pairs, 8 v1 Gap rows, 2 v1 provenance identities, 5 OpenInference
  M0 pairs and 4 OpenInference Gap Events;
- source-neutral v2 Schema audit: 22 Schemas, 3 Manifests, 3 delivery modes
  and 5 Source fixtures;
- source-neutral v2 Go conformance: 83/83 cases on two successive runs;
- source-neutral v2 TypeScript conformance: 83/83 cases on two successive
  runs;
- source-neutral v2 cross-language comparison: 83 cases across 29 required
  classes;
- 36 exact Operational Receipt cases, including 13 lifecycle-operation cases
  plus one negative data operation carrying an illicit control state;
- exact nested control Error phase, operation and recovery positive and
  negative coverage;
- exact candidate content digest:
  `sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`;
- exact Binding v1.1.2 release digest:
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`.

## Non-binding and zero-mutation boundary

This file records Source Domain Owner candidate evidence only.

It does not:

- make protocol `2.0.0` Binding;
- authorize a release, tag, merge or product adoption;
- authorize Schema, SDK, Connector or product implementation changes;
- authorize deployment, traffic, credentials, database, Cursor, Checkpoint or
  runtime mutation;
- claim Production or customer-data validation.

Binding still requires Coordinator confirmation over the same exact candidate
content digest and completion of the authority release/governance process.
Product adoption remains a separate, explicitly authorized phase.

The Source review itself performed no repository edit other than adding this
review evidence file and performed no product or runtime mutation.
