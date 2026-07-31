#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] ?? "--check";

if (!["--write", "--check"].includes(mode)) {
  process.stderr.write(
    "usage: build-source-neutral-v2-artifacts.mjs --write|--check\n",
  );
  process.exit(2);
}

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalize(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`unsafe or non-integral JSON number: ${value}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${canonicalize(value[key])}`
      ).join(",")
    }}`;
  }
  throw new Error(`unsupported JSON type: ${typeof value}`);
}

function lpUTF8(value) {
  const bytes = Buffer.from(value ?? "", "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function identityInput(parts) {
  return Buffer.concat([
    Buffer.from("foigent.event-idempotency.v1", "ascii"),
    ...parts.map(lpUTF8),
  ]);
}

function artifact(path) {
  const bytes = readFileSync(resolve(root, path));
  return { path, sha256: sha256(bytes) };
}

function renderJSON(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function emit(path, value) {
  const rendered = renderJSON(value);
  const absolute = resolve(root, path);
  if (mode === "--write") {
    writeFileSync(absolute, rendered, { encoding: "utf8", mode: 0o644 });
    return;
  }
  if (readFileSync(absolute, "utf8") !== rendered) {
    throw new Error(`${path} is stale`);
  }
}

const rawPath = "fixtures/source/openinference/reference-otlp-export.v1.json";
const sourcePath = "fixtures/source/openinference/reference-sanitized-span.v1.json";
const hashInputPath = "fixtures/shared/openinference-span-envelope.hash-input.json";
const vectorPath = "vectors/source-neutral-vector-bundle.v2.json";

const rawBytes = readFileSync(resolve(root, rawPath));
const raw = JSON.parse(rawBytes.toString("utf8"));
const mappingContext = {
  producer_product: "openinference",
  producer_instance: "otel-collector-prod-a",
  tenant_ref: null,
  org_ref: "1",
  project_ref: "7",
  connector_id: "foigent.openinference.otlp-spans",
  connector_version: "1.0.0",
};
const eventType = "observability.span.completed";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function attributesFrom(entries) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.key,
      entry.value.stringValue ?? entry.value.intValue,
    ]),
  );
}

function sourceFromReference(rawExport) {
  const span = rawExport.resourceSpans[0].scopeSpans[0].spans[0];
  const resourceAttributes = attributesFrom(
    rawExport.resourceSpans[0].resource.attributes,
  );
  const spanAttributes = attributesFrom(span.attributes);
  return {
    schema_version: "xinsight.otlp-openinference-span.v1",
    trace_id: span.traceId.toLowerCase(),
    span_id: span.spanId.toLowerCase(),
    session_id: spanAttributes["session.id"],
    span_name: span.name,
    span_kind: "LLM",
    start_time: "2026-07-31T02:00:00.000000Z",
    end_time: "2026-07-31T02:00:00.123456Z",
    status: "succeeded",
    model: spanAttributes["llm.model_name"],
    provider: spanAttributes["llm.provider"],
    prompt_tokens: spanAttributes["llm.token_count.prompt"],
    completion_tokens: spanAttributes["llm.token_count.completion"],
    total_tokens: spanAttributes["llm.token_count.total"],
    actor_ref: spanAttributes["user.id"],
    service_name: resourceAttributes["service.name"],
    missing_parent: false,
  };
}

function captureGapsFor(sourceRecord) {
  const reasons = new Map([
    ["billing_authority", "not_exposed_by_openinference_span_v1"],
    ["business_outcome", "not_exposed_by_openinference_span_v1"],
    ["downstream_side_effects", "not_exposed_by_openinference_span_v1"],
    ["routing_decision", "not_exposed_by_openinference_span_v1"],
  ]);
  if (sourceRecord.session_id === undefined) {
    reasons.set("authoritative_session", "session_id_not_observed");
  }
  if (
    sourceRecord.prompt_tokens === undefined ||
    sourceRecord.completion_tokens === undefined ||
    sourceRecord.total_tokens === undefined
  ) {
    reasons.set(
      "token_usage",
      "complete_token_counters_not_observed",
    );
  }
  if (sourceRecord.missing_parent) {
    reasons.set(
      "causal_parent",
      "declared_parent_not_in_bounded_batch",
    );
  }
  return [...reasons.keys()].sort().map((claim) => ({
    affected_claim: claim,
    gap_type: "not_available_from_source",
    reason_code: reasons.get(claim),
    severity: "warning",
  }));
}

function buildMappedRecord(sourceRecord) {
  const eventID = `${sourceRecord.trace_id}:${sourceRecord.span_id}`;
  const idInput = identityInput([
    mappingContext.producer_product,
    mappingContext.producer_instance,
    mappingContext.tenant_ref ?? "",
    mappingContext.org_ref,
    mappingContext.project_ref,
    eventType,
    eventID,
  ]);
  const idempotencyKey = sha256(idInput);
  const sourceBytes = Buffer.from(canonicalize(sourceRecord), "utf8");
  const sourceHash = sha256(sourceBytes);
  const captureGaps = captureGapsFor(sourceRecord);
  const scope = {
    org_ref: mappingContext.org_ref,
    project_ref: mappingContext.project_ref,
  };
  if (mappingContext.tenant_ref !== null) {
    scope.tenant_ref = mappingContext.tenant_ref;
  }
  const trace = {
    trace_id: sourceRecord.trace_id,
    span_id: sourceRecord.span_id,
  };
  if (sourceRecord.parent_span_id !== undefined) {
    trace.parent_span_id = sourceRecord.parent_span_id;
  }
  if (sourceRecord.session_id !== undefined) {
    trace.session_id = sourceRecord.session_id;
  }
  const model = { name: sourceRecord.model };
  if (sourceRecord.provider !== undefined) {
    model.provider = sourceRecord.provider;
  }
  const usage = {};
  for (
    const key of [
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
    ]
  ) {
    if (sourceRecord[key] !== undefined) {
      usage[key] = sourceRecord[key];
    }
  }
  const payload = {
    terminal: { status: sourceRecord.status },
    span: {
      kind: sourceRecord.span_kind,
      name: sourceRecord.span_name,
    },
    trace,
    model,
    usage,
  };
  if (sourceRecord.service_name !== undefined) {
    payload.service = { name: sourceRecord.service_name };
  }
  payload.timeline_complete = false;
  payload.capture_gaps = captureGaps;
  const hashInput = {
    spec_version: "foigent.event-envelope.v1",
    event_id: eventID,
    event_type: eventType,
    schema_ref: "foigent://events/observability/openinference-span-completed/v1",
    schema_version: "1",
    producer: {
      product: mappingContext.producer_product,
      instance: mappingContext.producer_instance,
      connector_id: mappingContext.connector_id,
      connector_version: mappingContext.connector_version,
    },
    scope,
    subject: {
      type: "span",
      ref: sourceRecord.span_id,
    },
    actor: sourceRecord.actor_ref === undefined
      ? { type: "system" }
      : { type: "user", ref: sourceRecord.actor_ref },
    time: {
      occurred_at: sourceRecord.end_time,
      terminal_at: sourceRecord.end_time,
    },
    correlation: {
      request_ref: eventID,
      trace_ref: sourceRecord.trace_id,
      span_ref: sourceRecord.span_id,
    },
    identity: {
      idempotency_key: idempotencyKey,
      source_revision: "1",
    },
    integrity: {
      source_hash: sourceHash,
    },
    data_policy: {
      payload_capture_mode: "metadata_only",
      raw_payload_present: false,
      redaction_profile: "openinference.metadata-allowlist.v1",
    },
    provenance: {
      adapter_fidelity: "F2",
      field_groups: {
        actor: sourceRecord.actor_ref === undefined ? "gap" : "direct",
        correlation: "direct",
        data_policy: "declared",
        identity: "derived",
        "payload.capture_gaps": "derived",
        "payload.model": "direct",
        "payload.span": "direct",
        "payload.timeline_complete": "declared",
        "payload.trace": "direct",
        "payload.usage": Object.keys(usage).length === 0 ? "gap" : "direct",
        scope: "declared",
        subject: "derived",
        "time.occurred_at": "derived",
        "time.terminal_at": "direct",
      },
    },
    payload,
  };
  const canonicalHashInput = Buffer.from(canonicalize(hashInput), "utf8");
  return {
    eventID,
    idInput,
    idempotencyKey,
    sourceHash,
    captureGaps,
    hashInput,
    canonicalHashInput,
    envelopeHash: sha256(canonicalHashInput),
  };
}

function llmAttributes({
  model,
  provider,
  prompt,
  completion,
  total,
  session,
  actor,
}) {
  return [
    {
      key: "openinference.span.kind",
      value: { stringValue: "LLM" },
    },
    {
      key: "llm.model_name",
      value: { stringValue: model },
    },
    ...(provider === undefined
      ? []
      : [{ key: "llm.provider", value: { stringValue: provider } }]),
    ...(prompt === undefined
      ? []
      : [{ key: "llm.token_count.prompt", value: { intValue: prompt } }]),
    ...(completion === undefined ? [] : [{
      key: "llm.token_count.completion",
      value: { intValue: completion },
    }]),
    ...(total === undefined
      ? []
      : [{ key: "llm.token_count.total", value: { intValue: total } }]),
    ...(session === undefined
      ? []
      : [{ key: "session.id", value: { stringValue: session } }]),
    ...(actor === undefined ? [] : [{ key: "user.id", value: { stringValue: actor } }]),
  ];
}

const source = sourceFromReference(raw);
if (canonicalize(readJSON(sourcePath)) !== canonicalize(source)) {
  throw new Error("sanitized Source fixture differs from the exact OTLP map");
}
if (
  canonicalize(source).includes("MUST_NOT_SURVIVE_SANITIZATION") ||
  !rawBytes.includes(Buffer.from("MUST_NOT_SURVIVE_SANITIZATION"))
) {
  throw new Error("privacy allowlist proof is invalid");
}
const reference = buildMappedRecord(source);
const {
  eventID,
  idInput,
  idempotencyKey,
  sourceHash,
  captureGaps,
  hashInput,
  canonicalHashInput,
  envelopeHash,
} = reference;
if (
  sourceHash !==
    "sha256:533e33c2e02a6a67632107ae99f3993eee1a1da39835029521a4c3fe0ceb4708" ||
  idempotencyKey !==
    "sha256:7e955832524e293df668d87d39c5a17303916c25b2e8ff87b5fbf4ca8bac851b" ||
  envelopeHash !==
    "sha256:02dc4475ff08b58ded11359de849f23c0b1d2dd378d376adfe6c2f09e7ea6819"
) {
  throw new Error("OpenInference identity or hash differs from X-Insight baseline");
}

const missingRawPath =
  "fixtures/source/openinference/missing-optional-otlp-export.v1.json";
const missingSourcePath =
  "fixtures/source/openinference/missing-optional-sanitized-span.v1.json";
const missingHashPath =
  "fixtures/shared/openinference-missing-optional-envelope.hash-input.json";
const missingRaw = {
  resourceSpans: [{
    resource: { attributes: [] },
    scopeSpans: [{
      spans: [{
        traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        spanId: "bbbbbbbbbbbbbbbb",
        parentSpanId: "cccccccccccccccc",
        name: "llm",
        startTimeUnixNano: "1785463200000000000",
        endTimeUnixNano: "1785463200001000000",
        attributes: llmAttributes({ model: "model-b" }),
        status: { code: 2 },
      }],
    }],
  }],
};
const missingSource = {
  schema_version: "xinsight.otlp-openinference-span.v1",
  trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  span_id: "bbbbbbbbbbbbbbbb",
  parent_span_id: "cccccccccccccccc",
  span_name: "llm",
  span_kind: "LLM",
  start_time: "2026-07-31T02:00:00.000000Z",
  end_time: "2026-07-31T02:00:00.001000Z",
  status: "failed",
  model: "model-b",
  missing_parent: true,
};
const missing = buildMappedRecord(missingSource);

const orderedRawPath =
  "fixtures/source/openinference/ordered-batch-otlp-export.v1.json";
const orderedTraceA = "11111111111111111111111111111111";
const orderedTraceB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const orderedParentSpan = "1111111111111111";
const orderedChildSpan = "2222222222222222";
const orderedSeparateSpan = "ffffffffffffffff";
const orderedRaw = {
  resourceSpans: [{
    resource: {
      attributes: [{
        key: "service.name",
        value: { stringValue: "ordered-agent" },
      }],
    },
    scopeSpans: [{
      spans: [
        {
          traceId: orderedTraceB,
          spanId: orderedChildSpan,
          parentSpanId: orderedParentSpan,
          name: "child",
          startTimeUnixNano: "1785463200001000000",
          endTimeUnixNano: "1785463200002000000",
          attributes: llmAttributes({
            model: "model-child",
            provider: "provider-b",
            prompt: "3",
            completion: "2",
            total: "5",
            session: "session-b",
            actor: "user-b",
          }),
          status: { code: "STATUS_CODE_ERROR" },
        },
        {
          traceId: "cccccccccccccccccccccccccccccccc",
          spanId: "cccccccccccccccc",
          name: "retrieval",
          startTimeUnixNano: "1785463200000000000",
          endTimeUnixNano: "1785463200001000000",
          attributes: [{
            key: "openinference.span.kind",
            value: { stringValue: "RETRIEVER" },
          }],
        },
        {
          traceId: orderedTraceA,
          spanId: orderedSeparateSpan,
          name: "separate",
          startTimeUnixNano: "1785463200002000000",
          endTimeUnixNano: "1785463200003000000",
          attributes: llmAttributes({
            model: "model-separate",
            provider: "provider-a",
            prompt: "1",
            completion: "1",
            total: "2",
            session: "session-a",
            actor: "user-a",
          }),
          status: { code: 1 },
        },
        {
          traceId: orderedTraceB,
          spanId: orderedParentSpan,
          name: "parent",
          startTimeUnixNano: "1785463200000000000",
          endTimeUnixNano: "1785463200001000000",
          attributes: llmAttributes({
            model: "model-parent",
            provider: "provider-b",
            prompt: "2",
            completion: "1",
            total: "3",
            session: "session-b",
            actor: "user-b",
          }),
          status: { code: "STATUS_CODE_UNSET" },
        },
      ],
    }],
  }],
};
const orderedSources = [
  {
    caseID: "ordered-separate-trace",
    path: "fixtures/source/openinference/ordered-separate-sanitized-span.v1.json",
    hashPath: "fixtures/shared/openinference-ordered-separate-envelope.hash-input.json",
    source: {
      schema_version: "xinsight.otlp-openinference-span.v1",
      trace_id: orderedTraceA,
      span_id: orderedSeparateSpan,
      span_name: "separate",
      span_kind: "LLM",
      start_time: "2026-07-31T02:00:00.002000Z",
      end_time: "2026-07-31T02:00:00.003000Z",
      status: "succeeded",
      model: "model-separate",
      provider: "provider-a",
      session_id: "session-a",
      prompt_tokens: "1",
      completion_tokens: "1",
      total_tokens: "2",
      actor_ref: "user-a",
      service_name: "ordered-agent",
      missing_parent: false,
    },
  },
  {
    caseID: "ordered-parent-present",
    path: "fixtures/source/openinference/ordered-parent-sanitized-span.v1.json",
    hashPath: "fixtures/shared/openinference-ordered-parent-envelope.hash-input.json",
    source: {
      schema_version: "xinsight.otlp-openinference-span.v1",
      trace_id: orderedTraceB,
      span_id: orderedParentSpan,
      span_name: "parent",
      span_kind: "LLM",
      start_time: "2026-07-31T02:00:00.000000Z",
      end_time: "2026-07-31T02:00:00.001000Z",
      status: "succeeded",
      model: "model-parent",
      provider: "provider-b",
      session_id: "session-b",
      prompt_tokens: "2",
      completion_tokens: "1",
      total_tokens: "3",
      actor_ref: "user-b",
      service_name: "ordered-agent",
      missing_parent: false,
    },
  },
  {
    caseID: "ordered-child-parent-resolved",
    path: "fixtures/source/openinference/ordered-child-sanitized-span.v1.json",
    hashPath: "fixtures/shared/openinference-ordered-child-envelope.hash-input.json",
    source: {
      schema_version: "xinsight.otlp-openinference-span.v1",
      trace_id: orderedTraceB,
      span_id: orderedChildSpan,
      parent_span_id: orderedParentSpan,
      span_name: "child",
      span_kind: "LLM",
      start_time: "2026-07-31T02:00:00.001000Z",
      end_time: "2026-07-31T02:00:00.002000Z",
      status: "failed",
      model: "model-child",
      provider: "provider-b",
      session_id: "session-b",
      prompt_tokens: "3",
      completion_tokens: "2",
      total_tokens: "5",
      actor_ref: "user-b",
      service_name: "ordered-agent",
      missing_parent: false,
    },
  },
].map((entry) => ({ ...entry, mapped: buildMappedRecord(entry.source) }));
const orderedRecordOrder = orderedSources.map((entry) =>
  `${entry.source.trace_id}:${entry.source.span_id}`
);

const invalidFixtures = [
  {
    caseID: "unknown-status-code",
    classes: ["source_shape_validation", "status_code_validation"],
    path: "fixtures/source/openinference/unknown-status-otlp-export.invalid.json",
    errorCode: "status_code_invalid",
    raw: (() => {
      const value = deepClone(missingRaw);
      value.resourceSpans[0].scopeSpans[0].spans[0].status.code = 9;
      return value;
    })(),
  },
  {
    caseID: "end-before-start",
    classes: ["source_shape_validation", "timestamp_normalization"],
    path: "fixtures/source/openinference/end-before-start-otlp-export.invalid.json",
    errorCode: "timestamp_order_invalid",
    raw: (() => {
      const value = deepClone(raw);
      value.resourceSpans[0].scopeSpans[0].spans[0].endTimeUnixNano =
        "1785463199999000000";
      return value;
    })(),
  },
  {
    caseID: "malformed-trace-id",
    classes: ["source_shape_validation"],
    path: "fixtures/source/openinference/malformed-trace-id-otlp-export.invalid.json",
    errorCode: "source_shape_invalid",
    raw: (() => {
      const value = deepClone(raw);
      value.resourceSpans[0].scopeSpans[0].spans[0].traceId = "not-a-trace";
      return value;
    })(),
  },
  {
    caseID: "span-limit-exceeded",
    classes: ["bounded_batch_ordering", "source_shape_validation"],
    path: "fixtures/source/openinference/too-many-spans-otlp-export.invalid.json",
    errorCode: "span_limit_exceeded",
    raw: {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          spans: Array.from({ length: 201 }, (_, index) => ({
            traceId: "dddddddddddddddddddddddddddddddd",
            spanId: index.toString(16).padStart(16, "0"),
            name: "bounded",
            startTimeUnixNano: "1785463200000000000",
            endTimeUnixNano: "1785463200001000000",
            attributes: [{
              key: "openinference.span.kind",
              value: { stringValue: "CHAIN" },
            }],
          })),
        }],
      }],
    },
  },
];

emit(hashInputPath, hashInput);
emit(missingRawPath, missingRaw);
emit(missingSourcePath, missingSource);
emit(missingHashPath, missing.hashInput);
emit(orderedRawPath, orderedRaw);
for (const entry of orderedSources) {
  emit(entry.path, entry.source);
  emit(entry.hashPath, entry.mapped.hashInput);
}
for (const entry of invalidFixtures) {
  emit(entry.path, entry.raw);
}

const hashInputFile = artifact(hashInputPath);
const contract = artifact(
  "conformance/source-neutral-conformance-contract.v2.json",
);

function receiptCounts(
  received,
  inserted = 0,
  duplicateNoop = 0,
  conflict = 0,
  rejected = 0,
) {
  return {
    received,
    inserted,
    duplicate_noop: duplicateNoop,
    conflict,
    rejected,
  };
}

function receiptCase(caseID, input, expected) {
  const defaultOperation = input.mode === "https_pull"
    ? "poll"
    : input.mode === "otlp_http_push"
    ? (input.status === "completed" ? "acknowledge" : "receive")
    : input.mode === "bounded_offline"
    ? "import_bundle"
    : "commit_batch";
  const operation = input.operation ?? defaultOperation;
  const controlOperations = [
    "activate",
    "pause",
    "resume",
    "stop",
    "start",
    "rotate",
    "retire",
  ];
  const defaultStateKind = controlOperations.includes(operation)
    ? "control"
    : input.mode === "https_pull"
    ? "pull"
    : input.mode === "otlp_http_push"
    ? "push"
    : input.mode === "bounded_offline"
    ? "offline"
    : "unknown";
  const hasError = input.error_retryable !== null;
  const defaultErrorPhase = operation === "activate"
    ? "activate"
    : controlOperations.includes(operation)
    ? (["stop", "retire"].includes(operation) ? "shutdown" : "status")
    : operation === "poll"
    ? "fetch"
    : operation === "receive"
    ? "receive"
    : operation === "import_bundle"
    ? "import"
    : operation === "acknowledge"
    ? "acknowledge"
    : "commit";
  const defaultErrorRecovery = input.error_retryable === true
    ? controlOperations.includes(operation)
      ? "automatic_retry"
      : input.mode === "otlp_http_push"
      ? "resubmit_request"
      : input.mode === "bounded_offline"
      ? "reimport_bundle"
      : "automatic_retry"
    : "operator_repair";
  return {
    case_id: caseID,
    case_classes: ["operational_receipt_semantics"],
    result_kind: "classification",
    input: {
      operation,
      state_kind: defaultStateKind,
      error_phase: hasError ? defaultErrorPhase : null,
      error_operation: hasError ? operation : null,
      error_recovery: hasError ? defaultErrorRecovery : null,
      ...input,
    },
    expected,
  };
}

function validReceipt(
  status,
  acknowledgement,
  checkpointCommitted,
  countsAccounted,
  receiptCompleted,
) {
  return {
    acknowledgement,
    checkpoint_committed: checkpointCommitted,
    counts_accounted: countsAccounted,
    receipt_completed: receiptCompleted,
    status,
    valid: true,
  };
}

const receiptCases = [
  receiptCase(
    "pull-completed",
    {
      mode: "https_pull",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: true,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    validReceipt("completed", "not_applicable", true, true, false),
  ),
  receiptCase(
    "push-completed",
    {
      mode: "otlp_http_push",
      status: "completed",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 1),
      error_retryable: null,
    },
    validReceipt("completed", "durable", false, true, false),
  ),
  receiptCase(
    "offline-completed",
    {
      mode: "bounded_offline",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    validReceipt("completed", "not_applicable", false, true, true),
  ),
  receiptCase(
    "push-accepted-safe-count-max",
    {
      mode: "otlp_http_push",
      status: "accepted",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(9007199254740991),
      error_retryable: null,
    },
    validReceipt("accepted", "withheld", false, false, false),
  ),
  receiptCase(
    "push-retryable-error",
    {
      mode: "otlp_http_push",
      status: "retryable_error",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: true,
    },
    validReceipt("retryable_error", "withheld", false, true, false),
  ),
  receiptCase(
    "offline-permanent-conflict",
    {
      mode: "bounded_offline",
      status: "permanent_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 1),
      error_retryable: false,
    },
    validReceipt("permanent_error", "not_applicable", false, true, false),
  ),
  receiptCase(
    "pull-control-activate-completed",
    {
      mode: "https_pull",
      operation: "activate",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    validReceipt("completed", "not_applicable", false, true, false),
  ),
  receiptCase(
    "push-control-rotate-completed",
    {
      mode: "otlp_http_push",
      operation: "rotate",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    validReceipt("completed", "not_applicable", false, true, false),
  ),
  receiptCase(
    "offline-control-pause-completed",
    {
      mode: "bounded_offline",
      operation: "pause",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    validReceipt("completed", "not_applicable", false, true, false),
  ),
  receiptCase(
    "push-control-retryable-error",
    {
      mode: "otlp_http_push",
      operation: "start",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: true,
    },
    validReceipt("retryable_error", "not_applicable", false, true, false),
  ),
  receiptCase(
    "pull-control-activate-retryable-error",
    {
      mode: "https_pull",
      operation: "activate",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: true,
    },
    validReceipt("retryable_error", "not_applicable", false, true, false),
  ),
  receiptCase(
    "offline-control-retire-permanent-error",
    {
      mode: "bounded_offline",
      operation: "retire",
      status: "permanent_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: false,
    },
    validReceipt("permanent_error", "not_applicable", false, true, false),
  ),
  receiptCase(
    "control-error-phase-mismatch",
    {
      mode: "otlp_http_push",
      operation: "start",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: true,
      error_phase: "receive",
    },
    { error_code: "receipt_error_phase_mismatch", valid: false },
  ),
  receiptCase(
    "control-error-operation-mismatch",
    {
      mode: "otlp_http_push",
      operation: "start",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: true,
      error_operation: "receive_batch",
    },
    { error_code: "receipt_error_operation_mismatch", valid: false },
  ),
  receiptCase(
    "control-error-data-recovery",
    {
      mode: "otlp_http_push",
      operation: "start",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: true,
      error_recovery: "resubmit_request",
    },
    { error_code: "receipt_error_recovery_mismatch", valid: false },
  ),
  receiptCase(
    "push-control-with-data-state",
    {
      mode: "otlp_http_push",
      operation: "rotate",
      state_kind: "push",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    { error_code: "receipt_state_mismatch", valid: false },
  ),
  receiptCase(
    "offline-control-nonzero-count",
    {
      mode: "bounded_offline",
      operation: "pause",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_control_counts_nonzero", valid: false },
  ),
  receiptCase(
    "pull-data-with-control-state",
    {
      mode: "https_pull",
      operation: "poll",
      state_kind: "control",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: true,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_state_mismatch", valid: false },
  ),
  receiptCase(
    "push-control-durable-acknowledgement",
    {
      mode: "otlp_http_push",
      operation: "rotate",
      status: "completed",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    {
      error_code: "receipt_acknowledgement_not_applicable",
      valid: false,
    },
  ),
  receiptCase(
    "pull-control-checkpoint-committed",
    {
      mode: "https_pull",
      operation: "activate",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: true,
      counts: receiptCounts(0),
      error_retryable: null,
    },
    { error_code: "receipt_checkpoint_mismatch", valid: false },
  ),
  receiptCase(
    "push-completed-withheld",
    {
      mode: "otlp_http_push",
      status: "completed",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_acknowledgement_mismatch", valid: false },
  ),
  receiptCase(
    "push-error-durable",
    {
      mode: "otlp_http_push",
      status: "retryable_error",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: true,
    },
    { error_code: "receipt_acknowledgement_mismatch", valid: false },
  ),
  receiptCase(
    "completed-with-error",
    {
      mode: "otlp_http_push",
      status: "completed",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: true,
    },
    { error_code: "receipt_error_state_mismatch", valid: false },
  ),
  receiptCase(
    "retryable-without-error",
    {
      mode: "otlp_http_push",
      status: "retryable_error",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: null,
    },
    { error_code: "receipt_error_state_mismatch", valid: false },
  ),
  receiptCase(
    "counts-not-accounted",
    {
      mode: "otlp_http_push",
      status: "completed",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(2, 1),
      error_retryable: null,
    },
    { error_code: "receipt_counts_not_accounted", valid: false },
  ),
  receiptCase(
    "completed-with-conflict",
    {
      mode: "bounded_offline",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 1),
      error_retryable: null,
    },
    {
      error_code: "receipt_completed_with_nonconverged_items",
      valid: false,
    },
  ),
  receiptCase(
    "accepted-with-outcome",
    {
      mode: "otlp_http_push",
      status: "accepted",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_accepted_with_outcomes", valid: false },
  ),
  receiptCase(
    "pull-error-checkpoint-committed",
    {
      mode: "https_pull",
      status: "retryable_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: true,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: true,
    },
    { error_code: "receipt_checkpoint_mismatch", valid: false },
  ),
  receiptCase(
    "offline-acknowledgement",
    {
      mode: "bounded_offline",
      status: "completed",
      acknowledgement: "durable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    {
      error_code: "receipt_acknowledgement_not_applicable",
      valid: false,
    },
  ),
  receiptCase(
    "negative-count",
    {
      mode: "otlp_http_push",
      status: "accepted",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(-1),
      error_retryable: null,
    },
    { error_code: "receipt_count_invalid", valid: false },
  ),
  receiptCase(
    "unknown-delivery-mode",
    {
      mode: "unknown",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_mode_invalid", valid: false },
  ),
  receiptCase(
    "cross-mode-operation",
    {
      mode: "bounded_offline",
      operation: "poll",
      status: "completed",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 1),
      error_retryable: null,
    },
    { error_code: "receipt_operation_mismatch", valid: false },
  ),
  receiptCase(
    "unsafe-count-above-max",
    {
      mode: "otlp_http_push",
      status: "accepted",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(9007199254740992),
      error_retryable: null,
    },
    { error_code: "receipt_count_invalid", valid: false },
  ),
  receiptCase(
    "permanent-with-retryable-error",
    {
      mode: "bounded_offline",
      status: "permanent_error",
      acknowledgement: "not_applicable",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 1),
      error_retryable: true,
    },
    { error_code: "receipt_error_state_mismatch", valid: false },
  ),
  receiptCase(
    "retryable-with-permanent-error",
    {
      mode: "otlp_http_push",
      status: "retryable_error",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: false,
    },
    { error_code: "receipt_error_state_mismatch", valid: false },
  ),
  receiptCase(
    "unknown-status",
    {
      mode: "otlp_http_push",
      status: "unknown",
      acknowledgement: "withheld",
      checkpoint_committed: false,
      counts: receiptCounts(1, 0, 0, 0, 1),
      error_retryable: true,
    },
    { error_code: "receipt_status_invalid", valid: false },
  ),
];

const vector = {
  bundle_version: "foigent.source-neutral-vector-bundle.v2",
  protocol_version: "2.0.0",
  protocol_status: "not_binding",
  conformance_contract: contract,
  mapping_context: mappingContext,
  openinference_mapping: [
    {
      case_id: "reference-bounded-offline",
      case_classes: [
        "canonical_envelope",
        "capture_gap_derivation",
        "source_sanitization",
      ],
      result_kind: "bytes",
      raw_input_path: rawPath,
      source_input_path: sourcePath,
      hash_input_path: hashInputPath,
      raw_file_sha256: sha256(rawBytes),
      source_file_sha256: sha256(readFileSync(resolve(root, sourcePath))),
      hash_input_file_sha256: hashInputFile.sha256,
      canonical_source_sha256: sourceHash,
      canonical_bytes: canonicalHashInput.length,
      envelope_hash: envelopeHash,
      idempotency_key: idempotencyKey,
      capture_gap_count: captureGaps.length,
      record_index: 0,
      expected_record_order: [eventID],
      expected_skipped_non_llm: 0,
    },
    {
      case_id: "missing-optional-facts",
      case_classes: [
        "canonical_envelope",
        "capture_gap_derivation",
        "conditional_capture_gaps",
        "optional_fact_preservation",
        "source_sanitization",
        "status_code_validation",
      ],
      result_kind: "bytes",
      raw_input_path: missingRawPath,
      source_input_path: missingSourcePath,
      hash_input_path: missingHashPath,
      raw_file_sha256: artifact(missingRawPath).sha256,
      source_file_sha256: artifact(missingSourcePath).sha256,
      hash_input_file_sha256: artifact(missingHashPath).sha256,
      canonical_source_sha256: missing.sourceHash,
      canonical_bytes: missing.canonicalHashInput.length,
      envelope_hash: missing.envelopeHash,
      idempotency_key: missing.idempotencyKey,
      capture_gap_count: missing.captureGaps.length,
      record_index: 0,
      expected_record_order: [missing.eventID],
      expected_skipped_non_llm: 0,
    },
    ...orderedSources.map((entry, recordIndex) => ({
      case_id: entry.caseID,
      case_classes: [
        "bounded_batch_ordering",
        "canonical_envelope",
        "capture_gap_derivation",
        "source_sanitization",
        "status_code_validation",
      ],
      result_kind: "bytes",
      raw_input_path: orderedRawPath,
      source_input_path: entry.path,
      hash_input_path: entry.hashPath,
      raw_file_sha256: artifact(orderedRawPath).sha256,
      source_file_sha256: artifact(entry.path).sha256,
      hash_input_file_sha256: artifact(entry.hashPath).sha256,
      canonical_source_sha256: entry.mapped.sourceHash,
      canonical_bytes: entry.mapped.canonicalHashInput.length,
      envelope_hash: entry.mapped.envelopeHash,
      idempotency_key: entry.mapped.idempotencyKey,
      capture_gap_count: entry.mapped.captureGaps.length,
      record_index: recordIndex,
      expected_record_order: orderedRecordOrder,
      expected_skipped_non_llm: 1,
    })),
  ],
  idempotency: [
    {
      case_id: "openinference-reference",
      case_classes: ["scoped_idempotency"],
      result_kind: "bytes",
      components: [
        mappingContext.producer_product,
        mappingContext.producer_instance,
        null,
        mappingContext.org_ref,
        mappingContext.project_ref,
        eventType,
        eventID,
      ],
      identity_input_hex: idInput.toString("hex"),
      idempotency_key: idempotencyKey,
    },
  ],
  manifest_semantics: [
    {
      case_id: "valid-pull",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "https_pull",
        delivery: "https_pull",
        activation: "activation_forward",
        checkpoint: "required",
        ingestion_capture_mode: "api_pull_import",
        delivery_scope: "poll_page",
        partial_acceptance: "reject_batch",
      },
      expected: {
        checkpoint: "required",
        mode: "https_pull",
        valid: true,
      },
    },
    {
      case_id: "valid-push",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "otlp_http_push",
        delivery: "otlp_http_push",
        activation: "receiver_activation_forward",
        checkpoint: "not_applicable",
        ingestion_capture_mode: "otlp_http_receive",
        delivery_scope: "accepted_request",
        partial_acceptance: "reject_batch",
      },
      expected: {
        checkpoint: "not_applicable",
        mode: "otlp_http_push",
        valid: true,
      },
    },
    {
      case_id: "valid-offline",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "bounded_offline",
        delivery: "bounded_offline",
        activation: "explicit_bounded_import",
        checkpoint: "not_applicable",
        ingestion_capture_mode: "bounded_offline_import",
        delivery_scope: "bounded_bundle",
        partial_acceptance: "reject_batch",
      },
      expected: {
        checkpoint: "not_applicable",
        mode: "bounded_offline",
        valid: true,
      },
    },
    {
      case_id: "hybrid-push-pull-delivery",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "otlp_http_push",
        delivery: "https_pull",
        activation: "receiver_activation_forward",
        checkpoint: "not_applicable",
        ingestion_capture_mode: "otlp_http_receive",
        delivery_scope: "accepted_request",
        partial_acceptance: "reject_batch",
      },
      expected: {
        error_code: "mode_axis_mismatch",
        valid: false,
      },
    },
    {
      case_id: "push-with-checkpoint",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "otlp_http_push",
        delivery: "otlp_http_push",
        activation: "receiver_activation_forward",
        checkpoint: "required",
        ingestion_capture_mode: "otlp_http_receive",
        delivery_scope: "accepted_request",
        partial_acceptance: "reject_batch",
      },
      expected: {
        error_code: "checkpoint_not_applicable",
        valid: false,
      },
    },
    {
      case_id: "offline-partial-acceptance",
      case_classes: [
        "checkpoint_applicability",
        "manifest_mode_union",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        transport: "bounded_offline",
        delivery: "bounded_offline",
        activation: "explicit_bounded_import",
        checkpoint: "not_applicable",
        ingestion_capture_mode: "bounded_offline_import",
        delivery_scope: "bounded_bundle",
        partial_acceptance: "allow_partial",
      },
      expected: {
        error_code: "partial_acceptance_forbidden",
        valid: false,
      },
    },
  ],
  lifecycle: [
    {
      case_id: "pull-polling-steady",
      case_classes: [
        "checkpoint_applicability",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        delivery_mode: "https_pull",
        processing: "polling",
        checkpoint: "required",
        checkpoint_state: "steady",
      },
      expected: {
        checkpoint_state: "steady",
        valid: true,
      },
    },
    {
      case_id: "push-receiving",
      case_classes: [
        "checkpoint_applicability",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        delivery_mode: "otlp_http_push",
        processing: "receiving",
        checkpoint: "not_applicable",
      },
      expected: {
        checkpoint_state: "not_applicable",
        valid: true,
      },
    },
    {
      case_id: "offline-importing",
      case_classes: [
        "checkpoint_applicability",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        delivery_mode: "bounded_offline",
        processing: "importing",
        checkpoint: "not_applicable",
      },
      expected: {
        checkpoint_state: "not_applicable",
        valid: true,
      },
    },
    {
      case_id: "push-checkpoint-invalid",
      case_classes: [
        "checkpoint_applicability",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        delivery_mode: "otlp_http_push",
        processing: "receiving",
        checkpoint: "required",
        checkpoint_state: "steady",
      },
      expected: {
        error_code: "checkpoint_not_applicable",
        valid: false,
      },
    },
    {
      case_id: "offline-polling-invalid",
      case_classes: [
        "checkpoint_applicability",
        "mode_state_separation",
      ],
      result_kind: "classification",
      input: {
        delivery_mode: "bounded_offline",
        processing: "polling",
        checkpoint: "not_applicable",
      },
      expected: {
        error_code: "processing_mode_mismatch",
        valid: false,
      },
    },
  ],
  delivery: [
    {
      case_id: "pull-all-converged",
      case_classes: [
        "checkpoint_applicability",
        "delivery_acknowledgement",
      ],
      result_kind: "state_transition",
      input: {
        mode: "https_pull",
        relation: "new",
        all_items_converged: true,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: true,
        outcome: "inserted",
        receipt_completed: false,
      },
    },
    {
      case_id: "pull-partial-failure",
      case_classes: [
        "checkpoint_applicability",
        "partial_batch_rejection",
      ],
      result_kind: "state_transition",
      input: {
        mode: "https_pull",
        relation: "new",
        all_items_converged: false,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: false,
        outcome: "retry_batch",
        receipt_completed: false,
      },
    },
    {
      case_id: "push-duplicate-noop",
      case_classes: [
        "delivery_acknowledgement",
        "duplicate_noop",
      ],
      result_kind: "state_transition",
      input: {
        mode: "otlp_http_push",
        relation: "same_identity_same_hash",
        all_items_converged: true,
      },
      expected: {
        acknowledgement: "durable",
        checkpoint_committed: false,
        outcome: "duplicate_noop",
        receipt_completed: false,
      },
    },
    {
      case_id: "push-content-conflict",
      case_classes: [
        "content_conflict",
        "delivery_acknowledgement",
      ],
      result_kind: "state_transition",
      input: {
        mode: "otlp_http_push",
        relation: "same_identity_different_hash",
        all_items_converged: false,
      },
      expected: {
        acknowledgement: "withheld",
        checkpoint_committed: false,
        outcome: "conflict",
        receipt_completed: false,
      },
    },
    {
      case_id: "push-partial-failure",
      case_classes: [
        "delivery_acknowledgement",
        "partial_batch_rejection",
      ],
      result_kind: "state_transition",
      input: {
        mode: "otlp_http_push",
        relation: "new",
        all_items_converged: false,
      },
      expected: {
        acknowledgement: "withheld",
        checkpoint_committed: false,
        outcome: "retry_batch",
        receipt_completed: false,
      },
    },
    {
      case_id: "offline-all-converged",
      case_classes: [
        "bounded_offline_receipt",
        "delivery_acknowledgement",
      ],
      result_kind: "state_transition",
      input: {
        mode: "bounded_offline",
        relation: "new",
        all_items_converged: true,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: false,
        outcome: "inserted",
        receipt_completed: true,
      },
    },
    {
      case_id: "offline-duplicate-noop",
      case_classes: [
        "bounded_offline_receipt",
        "duplicate_noop",
      ],
      result_kind: "state_transition",
      input: {
        mode: "bounded_offline",
        relation: "same_identity_same_hash",
        all_items_converged: true,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: false,
        outcome: "duplicate_noop",
        receipt_completed: true,
      },
    },
    {
      case_id: "offline-content-conflict",
      case_classes: [
        "bounded_offline_receipt",
        "content_conflict",
      ],
      result_kind: "state_transition",
      input: {
        mode: "bounded_offline",
        relation: "same_identity_different_hash",
        all_items_converged: false,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: false,
        outcome: "conflict",
        receipt_completed: false,
      },
    },
    {
      case_id: "offline-partial-failure",
      case_classes: [
        "bounded_offline_receipt",
        "partial_batch_rejection",
      ],
      result_kind: "state_transition",
      input: {
        mode: "bounded_offline",
        relation: "new",
        all_items_converged: false,
      },
      expected: {
        acknowledgement: "not_applicable",
        checkpoint_committed: false,
        outcome: "retry_batch",
        receipt_completed: false,
      },
    },
  ],
  receipts: receiptCases,
  completeness: [
    {
      case_id: "v1-pull-complete",
      case_classes: [
        "delivery_completeness",
        "timeline_completeness",
      ],
      result_kind: "classification",
      input: {
        delivery_scope: "poll_page",
        delivery_scope_complete: true,
        execution_timeline: "complete",
        assertion_basis: "source_contract",
      },
      expected: {
        delivery_complete: true,
        timeline_claim: "complete",
        valid: true,
      },
    },
    {
      case_id: "openinference-offline-partial",
      case_classes: [
        "delivery_completeness",
        "timeline_completeness",
      ],
      result_kind: "classification",
      input: {
        delivery_scope: "bounded_bundle",
        delivery_scope_complete: true,
        execution_timeline: "partial",
        assertion_basis: "connector_observation",
      },
      expected: {
        delivery_complete: true,
        timeline_claim: "partial",
        valid: true,
      },
    },
    {
      case_id: "push-not-asserted",
      case_classes: [
        "delivery_completeness",
        "timeline_completeness",
      ],
      result_kind: "classification",
      input: {
        delivery_scope: "accepted_request",
        delivery_scope_complete: true,
        execution_timeline: "not_asserted",
        assertion_basis: "connector_observation",
      },
      expected: {
        delivery_complete: true,
        timeline_claim: "not_asserted",
        valid: true,
      },
    },
    {
      case_id: "partial-delivery-invalid",
      case_classes: [
        "delivery_completeness",
        "timeline_completeness",
      ],
      result_kind: "classification",
      input: {
        delivery_scope: "bounded_bundle",
        delivery_scope_complete: false,
        execution_timeline: "partial",
        assertion_basis: "connector_observation",
      },
      expected: {
        error_code: "partial_delivery_scope_forbidden",
        valid: false,
      },
    },
  ],
  capture_modes: [
    {
      case_id: "offline-metadata-only",
      case_classes: ["capture_mode_separation"],
      result_kind: "classification",
      input: {
        ingestion_capture_mode: "bounded_offline_import",
        payload_capture_mode: "metadata_only",
      },
      expected: {
        ingestion_capture_mode: "bounded_offline_import",
        payload_capture_mode: "metadata_only",
        valid: true,
      },
    },
    {
      case_id: "collapsed-mode-invalid",
      case_classes: ["capture_mode_separation"],
      result_kind: "classification",
      input: {
        ingestion_capture_mode: "metadata_only",
        payload_capture_mode: "metadata_only",
      },
      expected: {
        error_code: "ingestion_capture_mode_invalid",
        valid: false,
      },
    },
  ],
  mutable_delivery: [
    {
      case_id: "wrapper-state-excluded",
      case_classes: ["mutable_delivery_exclusion"],
      result_kind: "classification",
      hash_input_path: hashInputPath,
      variants: [
        {
          mode: "https_pull",
          cursor: "cursor-a",
          high_watermark: "watermark-a",
          observed_at: "2026-07-31T02:01:00.000000Z",
        },
        {
          mode: "otlp_http_push",
          request_id: "request-a",
          received_at: "2026-07-31T02:02:00.000000Z",
        },
        {
          mode: "bounded_offline",
          bundle_id: "bundle-a",
          bundle_sha256:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          imported_at: "2026-07-31T02:03:00.000000Z",
        },
      ],
      expected: {
        envelope_hash: envelopeHash,
        idempotency_key: idempotencyKey,
        unchanged: true,
      },
    },
  ],
  v1_compatibility: [
    {
      case_id: "unirouter-pull",
      case_classes: ["v1_pull_compatibility"],
      result_kind: "classification",
      manifest_path: "manifests/foigent.unirouter.completed-execution-1.0.0.json",
      expected: {
        checkpoint: "required",
        delivery_scope: "poll_page",
        execution_timeline: "complete",
        ingestion_capture_mode: "api_pull_import",
        original_manifest_version: "foigent.connector-manifest.v1",
        projected_mode: "https_pull",
      },
    },
    {
      case_id: "litellm-pull",
      case_classes: ["v1_pull_compatibility"],
      result_kind: "classification",
      manifest_path: "manifests/foigent.litellm.spend-logs-1.0.0.json",
      expected: {
        checkpoint: "required",
        delivery_scope: "poll_page",
        execution_timeline: "complete",
        ingestion_capture_mode: "api_pull_import",
        original_manifest_version: "foigent.connector-manifest.v1",
        projected_mode: "https_pull",
      },
    },
  ],
  negative: [
    {
      case_id: "duplicate-json-key",
      case_classes: ["duplicate_key_rejection"],
      result_kind: "classification",
      kind: "strict_json",
      input: '{"trace_id":"a","nested":{"span_id":"b","span_id":"c"}}',
      expected: {
        error_code: "duplicate_json_key",
        valid: false,
      },
    },
    {
      case_id: "raw-payload-leak",
      case_classes: ["privacy_rejection"],
      result_kind: "classification",
      kind: "privacy",
      input: {
        schema_version: "xinsight.otlp-openinference-span.v1",
        input_value: "forbidden",
      },
      expected: {
        error_code: "raw_payload_forbidden",
        valid: false,
      },
    },
    {
      case_id: "decimal-int64-max",
      case_classes: ["decimal_boundary"],
      result_kind: "classification",
      kind: "decimal",
      input: "9223372036854775807",
      expected: {
        valid: true,
        value: "9223372036854775807",
      },
    },
    {
      case_id: "decimal-above-int64",
      case_classes: ["decimal_boundary"],
      result_kind: "classification",
      kind: "decimal",
      input: "9223372036854775808",
      expected: {
        valid: false,
        value: "9223372036854775808",
      },
    },
    {
      case_id: "timestamp-exact-microsecond",
      case_classes: ["timestamp_normalization"],
      result_kind: "classification",
      kind: "timestamp",
      input: "2026-07-31T10:00:00.123456+08:00",
      expected: {
        normalized: "2026-07-31T02:00:00.123456Z",
        valid: true,
      },
    },
    {
      case_id: "timestamp-submicrosecond",
      case_classes: ["timestamp_normalization"],
      result_kind: "classification",
      kind: "timestamp",
      input: "2026-07-31T02:00:00.123456001Z",
      expected: {
        error_code: "timestamp_precision_loss",
        valid: false,
      },
    },
    {
      case_id: "protocol-non-nfc",
      case_classes: ["protocol_nfc_rejection"],
      result_kind: "classification",
      kind: "protocol_unicode",
      input: "cafe\u0301",
      expected: {
        valid: false,
      },
    },
    {
      case_id: "opaque-source-non-nfc",
      case_classes: ["opaque_utf8_preservation"],
      result_kind: "classification",
      kind: "opaque_unicode",
      input: "cafe\u0301",
      expected: {
        utf8_hex: "63616665cc81",
        valid: true,
      },
    },
    ...invalidFixtures.map((entry) => ({
      case_id: entry.caseID,
      case_classes: entry.classes,
      result_kind: "classification",
      kind: "otlp_fixture",
      input: artifact(entry.path),
      expected: {
        error_code: entry.errorCode,
        valid: false,
      },
    })),
  ],
};
emit(vectorPath, vector);

process.stdout.write(
  `source-neutral v2 artifacts ${mode.slice(2)}: ` +
    `${vector.openinference_mapping.length} Envelope, ` +
    `${
      [
        vector.openinference_mapping,
        vector.idempotency,
        vector.manifest_semantics,
        vector.lifecycle,
        vector.delivery,
        vector.receipts,
        vector.completeness,
        vector.capture_modes,
        vector.mutable_delivery,
        vector.v1_compatibility,
        vector.negative,
      ].reduce((total, section) => total + section.length, 0)
    } cases\n`,
);
