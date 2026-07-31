import {
  asArray,
  asBoolean,
  asInteger,
  asObject,
  assertExactKeys,
  asString,
  canonicalBytes,
  encodeUtf8,
  JsonObject,
  JsonValue,
  parseStrictJsonBytes,
  sha256,
  StrictJsonError,
  toHex,
} from "./json.ts";

export const MAX_INT64 = 9223372036854775807n;
export const MAX_UINT32 = 4294967295;
export const EVENT_TYPE = "model.request.completed";
export const SCHEMA_REF = "foigent://events/model/request-completed/v1";
export const SOURCE_SCHEMA = "unirouter.completed-execution.v1";
export const IDEMPOTENCY_DOMAIN = "foigent.event-idempotency.v1";

const DECIMAL_PATTERN = /^(0|[1-9][0-9]{0,18})$/;
const MONEY_PATTERN = /^(0|[1-9][0-9]{0,18})$/;
const REQUIRED_GAPS = [
  "call_log",
  "client_ip_presence",
  "request_trace",
  "upstream_error_presence",
] as const;
const PROHIBITED_RAW_KEYS = new Set(["prompt"]);

export interface MappingContext {
  producerProduct: string;
  producerInstance: string;
  connectorId: string;
  connectorVersion: string;
  adapterFidelity: string;
  payloadCaptureMode: string;
  rawPayloadPresent: boolean;
  sourceRevision: string;
  timelineComplete: boolean;
}

export interface NormalizedTimestamp {
  valid: boolean;
  normalized?: string;
  error_code?: "invalid_timestamp" | "timestamp_precision_loss";
}

export interface IdempotencyInput {
  producerProduct: string;
  producerInstance: string;
  tenantRef: string | null;
  orgRef: string;
  projectRef: string;
  eventType: string;
  eventId: string;
}

export interface ConnectorErrorValue extends JsonObject {
  error_version: string;
  category: string;
  code: string;
  phase: string;
  operation: string;
  retryable: boolean;
  safe_message: string;
  recovery: string;
}

export class ConnectorFailure extends Error {
  constructor(readonly value: ConnectorErrorValue) {
    super(value.safe_message);
    this.name = "ConnectorFailure";
  }
}

export function validInt64Decimal(value: string): boolean {
  if (!DECIMAL_PATTERN.test(value)) {
    return false;
  }
  return BigInt(value) <= MAX_INT64;
}

export function parseInt64Decimal(value: string): bigint {
  if (!validInt64Decimal(value)) {
    throw new StrictJsonError(
      "invalid_int64_decimal",
      "Value is not a canonical nonnegative int64 decimal string",
    );
  }
  return BigInt(value);
}

export function protocolControlledNfc(value: string): boolean {
  return value.normalize("NFC") === value;
}

export function assertProtocolControlledNfc(
  value: string,
  name: string,
): void {
  if (!protocolControlledNfc(value)) {
    throw new StrictJsonError(
      "protocol_non_nfc",
      `${name} must already be NFC`,
    );
  }
}

export function opaqueUtf8(value: string): Uint8Array {
  return encodeUtf8(value);
}

export function normalizeMicrosecondTimestamp(
  input: string,
): NormalizedTimestamp {
  const match =
    /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$/
      .exec(input);
  if (!match) {
    return { valid: false, error_code: "invalid_timestamp" };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8]!;
  if (
    !validDateTime(year, month, day, hour, minute, second) ||
    !validZone(zone)
  ) {
    return { valid: false, error_code: "invalid_timestamp" };
  }
  if (/[^0]/.test(fraction.slice(6))) {
    return { valid: false, error_code: "timestamp_precision_loss" };
  }
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, 0);
  const offsetMinutes = zone === "Z" ? 0 : parseOffsetMinutes(zone);
  const instant = new Date(local.getTime() - offsetMinutes * 60_000);
  const iso = instant.toISOString();
  if (!/^[0-9]{4}-/.test(iso)) {
    return { valid: false, error_code: "invalid_timestamp" };
  }
  return {
    valid: true,
    normalized: `${iso.slice(0, 19)}.${fraction.slice(0, 6).padEnd(6, "0")}Z`,
  };
}

export function buildIdempotencyInput(input: IdempotencyInput): Uint8Array {
  assertProtocolControlledNfc(input.producerProduct, "producer.product");
  assertProtocolControlledNfc(input.eventType, "event_type");
  const chunks = [
    encodeUtf8(IDEMPOTENCY_DOMAIN),
    lpUtf8(input.producerProduct),
    lpUtf8(input.producerInstance),
    lpUtf8(input.tenantRef),
    lpUtf8(input.orgRef),
    lpUtf8(input.projectRef),
    lpUtf8(input.eventType),
    lpUtf8(input.eventId),
  ];
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function idempotencyKey(input: IdempotencyInput): string {
  return sha256(buildIdempotencyInput(input));
}

export function lpUtf8(value: string | null): Uint8Array {
  if (value === null) {
    return new Uint8Array(4);
  }
  if (value.length === 0) {
    throw new StrictJsonError(
      "present_empty_identity_component",
      "Present identity component must not be empty",
    );
  }
  const bytes = encodeUtf8(value);
  if (bytes.length > MAX_UINT32) {
    throw new StrictJsonError(
      "identity_component_too_large",
      "Identity component exceeds uint32 byte length",
    );
  }
  const result = new Uint8Array(4 + bytes.length);
  new DataView(result.buffer).setUint32(0, bytes.length, false);
  result.set(bytes, 4);
  return result;
}

export function mapReferenceSource(
  sourceBytes: Uint8Array,
  context: MappingContext,
): JsonObject {
  const source = asObject(
    parseStrictJsonBytes(sourceBytes),
    "completed-execution source",
  );
  rejectProhibitedRawFields(source);
  validateContext(context);
  assertExactKeys(
    source,
    [
      "schema_version",
      "request_id",
      "org_id",
      "project_id",
      "terminal",
      "usage",
      "money",
      "capture_gaps",
    ],
    [],
    "completed-execution source",
  );
  requireExactString(source.schema_version, SOURCE_SCHEMA, "schema_version");
  const requestId = boundedOpaqueString(source.request_id, "request_id", 1, 64);
  const orgId = positiveInt64(source.org_id, "org_id");
  const projectId = positiveInt64(source.project_id, "project_id");
  const orgRef = orgId.toString(10);
  const projectRef = projectId.toString(10);
  const terminal = validateTerminal(source.terminal);
  const usage = validateUsage(source.usage);
  const money = validateMoney(source.money);
  const terminalTime = normalizeMicrosecondTimestamp(terminal.availableAt);
  if (!terminalTime.valid || terminalTime.normalized === undefined) {
    throw new StrictJsonError(
      terminalTime.error_code ?? "invalid_timestamp",
      "Source terminal timestamp cannot be mapped losslessly",
    );
  }
  const idempotency = idempotencyKey({
    producerProduct: context.producerProduct,
    producerInstance: context.producerInstance,
    tenantRef: null,
    orgRef,
    projectRef,
    eventType: EVENT_TYPE,
    eventId: requestId,
  });
  const gaps = deriveCaptureGaps(
    source.capture_gaps,
    requestId,
    orgRef,
    projectRef,
    terminalTime.normalized,
  );
  const sharedUsage: JsonObject = {
    model: usage.model,
    prompt_tokens: usage.promptTokens.toString(10),
    uncached_prompt_tokens: usage.uncachedPromptTokens.toString(10),
    cache_read_tokens: usage.cacheReadTokens.toString(10),
    cache_creation_tokens: usage.cacheCreationTokens.toString(10),
    completion_tokens: usage.completionTokens.toString(10),
    source: usage.source,
    authority: usage.authority,
    purpose: usage.purpose,
    finality: usage.finality,
    contract_version: usage.contractVersion,
    cache_usage_schema: usage.cacheUsageSchema,
    cache_usage_status: usage.cacheUsageStatus,
  };
  if (usage.estimateVersion !== undefined) {
    sharedUsage.estimate_version = usage.estimateVersion;
  }
  return {
    spec_version: "foigent.event-envelope.v1",
    event_id: requestId,
    event_type: EVENT_TYPE,
    schema_ref: SCHEMA_REF,
    schema_version: "1",
    producer: {
      product: context.producerProduct,
      instance: context.producerInstance,
      connector_id: context.connectorId,
      connector_version: context.connectorVersion,
    },
    scope: {
      org_ref: orgRef,
      project_ref: projectRef,
    },
    subject: {
      type: "request",
      ref: requestId,
    },
    actor: {
      type: "system",
    },
    time: {
      occurred_at: terminalTime.normalized,
      terminal_at: terminalTime.normalized,
    },
    correlation: {
      request_ref: requestId,
    },
    identity: {
      idempotency_key: idempotency,
      source_revision: context.sourceRevision,
    },
    integrity: {
      source_hash: sha256(sourceBytes),
    },
    data_policy: {
      payload_capture_mode: context.payloadCaptureMode,
      raw_payload_present: context.rawPayloadPresent,
    },
    provenance: {
      adapter_fidelity: context.adapterFidelity,
      field_groups: {
        actor: "declared",
        correlation: "direct",
        data_policy: "declared",
        identity: "direct",
        "payload.capture_gaps": "direct",
        "payload.money": "direct",
        "payload.terminal": "direct",
        "payload.timeline_complete": "direct",
        "payload.usage": "direct",
        scope: "direct",
        subject: "derived",
        "time.occurred_at": "derived",
        "time.terminal_at": "direct",
      },
    },
    payload: {
      terminal: {
        status: terminal.status,
      },
      usage: sharedUsage,
      money,
      timeline_complete: context.timelineComplete,
      capture_gaps: gaps,
    },
  };
}

export function deriveCaptureGaps(
  rawGaps: JsonValue | undefined,
  eventId: string,
  orgRef: string,
  projectRef: string,
  terminalAt: string,
): JsonValue[] {
  const gaps = asArray(rawGaps, "capture_gaps");
  if (gaps.length !== REQUIRED_GAPS.length) {
    throw new StrictJsonError(
      "invalid_capture_gaps",
      "Reference source must contain four Capture Gaps",
    );
  }
  const direct = gaps.map((rawGap, index) => {
    const gap = asObject(rawGap, `capture_gaps[${index}]`);
    assertExactKeys(
      gap,
      ["source", "reason"],
      [],
      `capture_gaps[${index}]`,
    );
    return {
      source: asString(gap.source, `capture_gaps[${index}].source`),
      reason: asString(gap.reason, `capture_gaps[${index}].reason`),
    };
  });
  direct.sort((left, right) =>
    left.source < right.source ? -1 : left.source > right.source ? 1 : 0
  );
  if (
    direct.some((gap, index) =>
      gap.source !== REQUIRED_GAPS[index] ||
      gap.reason !== "not_available_at_billing_terminal"
    )
  ) {
    throw new StrictJsonError(
      "invalid_capture_gaps",
      "Reference Capture Gap set or reason is invalid",
    );
  }
  return direct.map((gap) => ({
    gap_id: `${eventId}:gap:${gap.source}`,
    parent_event_id: eventId,
    scope: {
      org_ref: orgRef,
      project_ref: projectRef,
    },
    correlation: {
      request_ref: eventId,
    },
    affected_claim: gap.source,
    gap_type: "not_available_from_source",
    reason_code: gap.reason,
    severity: "warning",
    observed_at: terminalAt,
    payload_capture_mode: "none",
    field_provenance: {
      affected_claim: "direct",
      reason_code: "direct",
      gap_id: "derived",
      parent_event_id: "derived",
      scope: "derived",
      correlation: "derived",
      observed_at: "derived",
      gap_type: "declared",
      severity: "declared",
      payload_capture_mode: "declared",
    },
  }));
}

export function classifyCursorError(sourceBytes: Uint8Array): ConnectorErrorValue {
  const root = asObject(parseStrictJsonBytes(sourceBytes), "cursor error");
  assertExactKeys(root, ["error"], [], "cursor error");
  const error = asObject(root.error, "cursor error.error");
  assertExactKeys(
    error,
    ["code", "message", "retryable"],
    [],
    "cursor error.error",
  );
  requireExactString(
    error.code,
    "completed_execution_feed.cursor_expired",
    "cursor error code",
  );
  requireExactString(
    error.message,
    "Cursor is outside the retained replay window",
    "cursor error message",
  );
  if (asBoolean(error.retryable, "cursor error retryable")) {
    throw new StrictJsonError(
      "invalid_artifact",
      "Cursor-expired fixture must be non-retryable",
    );
  }
  return {
    error_version: "foigent.connector-error.v1",
    category: "cursor",
    code: "completed_execution_feed.cursor_expired",
    phase: "fetch",
    operation: "fetch_page",
    retryable: false,
    safe_message: "Cursor is outside the retained replay window",
    recovery: "operator_repair",
  };
}

export function mapSourceOrThrow(
  sourceBytes: Uint8Array,
  context: MappingContext,
): JsonObject {
  try {
    return mapReferenceSource(sourceBytes, context);
  } catch (error) {
    if (
      error instanceof StrictJsonError &&
      error.code === "prohibited_raw_field"
    ) {
      throw new ConnectorFailure({
        error_version: "foigent.connector-error.v1",
        category: "privacy",
        code: "prohibited_raw_field",
        phase: "validate",
        operation: "map_source_snapshot",
        retryable: false,
        safe_message: "Source payload contains a prohibited raw field",
        recovery: "operator_repair",
      });
    }
    throw error;
  }
}

export function envelopeCanonicalBytes(envelope: JsonObject): Uint8Array {
  const integrity = asObject(envelope.integrity, "integrity");
  if ("envelope_hash" in integrity) {
    throw new StrictJsonError(
      "envelope_hash_present",
      "Envelope hash must be absent from its own hash input",
    );
  }
  return canonicalBytes(envelope);
}

export function opaqueUtf8Hex(value: string): string {
  return toHex(opaqueUtf8(value));
}

export function validateFinalReferenceEnvelope(envelope: JsonObject): void {
  assertExactKeys(
    envelope,
    [
      "spec_version",
      "event_id",
      "event_type",
      "schema_ref",
      "schema_version",
      "producer",
      "scope",
      "subject",
      "actor",
      "time",
      "correlation",
      "identity",
      "integrity",
      "data_policy",
      "provenance",
      "payload",
    ],
    [],
    "event envelope",
  );
  requireExactString(
    envelope.spec_version,
    "foigent.event-envelope.v1",
    "spec_version",
  );
  requireExactString(envelope.event_type, EVENT_TYPE, "event_type");
  requireExactString(envelope.schema_ref, SCHEMA_REF, "schema_ref");
  requireExactString(envelope.schema_version, "1", "schema_version");
  const eventId = boundedOpaqueString(
    envelope.event_id,
    "event_id",
    1,
    128,
  );

  const producer = asObject(envelope.producer, "producer");
  assertExactKeys(
    producer,
    ["product", "instance", "connector_id", "connector_version"],
    [],
    "producer",
  );
  requirePatternString(
    producer.product,
    /^[a-z][a-z0-9_-]*$/,
    64,
    "producer.product",
  );
  boundedOpaqueString(producer.instance, "producer.instance", 1, 128);
  requirePatternString(
    producer.connector_id,
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$/,
    160,
    "producer.connector_id",
  );
  requirePatternString(
    producer.connector_version,
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/,
    80,
    "producer.connector_version",
  );

  const scope = asObject(envelope.scope, "scope");
  assertExactKeys(scope, ["org_ref", "project_ref"], [], "scope");
  const orgRef = requirePositiveDecimalRef(scope.org_ref, "scope.org_ref");
  const projectRef = requirePositiveDecimalRef(
    scope.project_ref,
    "scope.project_ref",
  );

  const subject = asObject(envelope.subject, "subject");
  assertExactKeys(subject, ["type", "ref"], [], "subject");
  requireExactString(subject.type, "request", "subject.type");
  requireExactString(subject.ref, eventId, "subject.ref");

  const actor = asObject(envelope.actor, "actor");
  assertExactKeys(actor, ["type"], [], "actor");
  requireExactString(actor.type, "system", "actor.type");

  const time = asObject(envelope.time, "time");
  assertExactKeys(time, ["occurred_at", "terminal_at"], [], "time");
  const occurredAt = requireCanonicalMicrosecondTime(
    time.occurred_at,
    "time.occurred_at",
  );
  const terminalAt = requireCanonicalMicrosecondTime(
    time.terminal_at,
    "time.terminal_at",
  );
  if (occurredAt !== terminalAt) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      "occurred_at must be the deterministic terminal_at alias",
    );
  }

  const correlation = asObject(envelope.correlation, "correlation");
  assertExactKeys(correlation, ["request_ref"], [], "correlation");
  requireExactString(
    correlation.request_ref,
    eventId,
    "correlation.request_ref",
  );

  const identity = asObject(envelope.identity, "identity");
  assertExactKeys(
    identity,
    ["idempotency_key", "source_revision"],
    [],
    "identity",
  );
  requireSha256(identity.idempotency_key, "identity.idempotency_key");
  requireExactString(
    identity.source_revision,
    "1",
    "identity.source_revision",
  );

  const integrity = asObject(envelope.integrity, "integrity");
  assertExactKeys(
    integrity,
    ["source_hash", "envelope_hash"],
    [],
    "integrity",
  );
  requireSha256(integrity.source_hash, "integrity.source_hash");
  requireSha256(integrity.envelope_hash, "integrity.envelope_hash");

  const dataPolicy = asObject(envelope.data_policy, "data_policy");
  assertExactKeys(
    dataPolicy,
    ["payload_capture_mode", "raw_payload_present"],
    [],
    "data_policy",
  );
  requireExactString(
    dataPolicy.payload_capture_mode,
    "metadata_only",
    "data_policy.payload_capture_mode",
  );
  if (asBoolean(dataPolicy.raw_payload_present, "raw_payload_present")) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      "Reference raw_payload_present must be false",
    );
  }

  validateReferenceProvenance(envelope.provenance);
  validateReferencePayload(
    envelope.payload,
    eventId,
    orgRef,
    projectRef,
    terminalAt,
  );
}

function validateContext(context: MappingContext): void {
  assertProtocolControlledNfc(context.producerProduct, "producer.product");
  assertProtocolControlledNfc(context.connectorId, "producer.connector_id");
  assertProtocolControlledNfc(
    context.connectorVersion,
    "producer.connector_version",
  );
  assertProtocolControlledNfc(context.adapterFidelity, "adapter_fidelity");
  assertProtocolControlledNfc(
    context.payloadCaptureMode,
    "payload_capture_mode",
  );
  assertProtocolControlledNfc(EVENT_TYPE, "event_type");
  assertProtocolControlledNfc(SCHEMA_REF, "schema_ref");
  if (
    context.sourceRevision !== "1" ||
    context.timelineComplete !== true ||
    context.rawPayloadPresent !== false
  ) {
    throw new StrictJsonError(
      "invalid_mapping_context",
      "Reference mapping context is not the frozen V1 context",
    );
  }
}

function validateReferenceProvenance(value: JsonValue | undefined): void {
  const provenance = asObject(value, "provenance");
  assertExactKeys(
    provenance,
    ["adapter_fidelity", "field_groups"],
    [],
    "provenance",
  );
  requireExactString(
    provenance.adapter_fidelity,
    "F2",
    "provenance.adapter_fidelity",
  );
  const groups = asObject(provenance.field_groups, "provenance.field_groups");
  const expected: Record<string, string> = {
    actor: "declared",
    correlation: "direct",
    data_policy: "declared",
    identity: "direct",
    "payload.capture_gaps": "direct",
    "payload.money": "direct",
    "payload.terminal": "direct",
    "payload.timeline_complete": "direct",
    "payload.usage": "direct",
    scope: "direct",
    subject: "derived",
    "time.occurred_at": "derived",
    "time.terminal_at": "direct",
  };
  assertExactKeys(
    groups,
    Object.keys(expected),
    [],
    "provenance.field_groups",
  );
  for (const [key, expectedValue] of Object.entries(expected)) {
    requireExactString(
      groups[key],
      expectedValue,
      `provenance.field_groups.${key}`,
    );
  }
}

function validateReferencePayload(
  value: JsonValue | undefined,
  eventId: string,
  orgRef: string,
  projectRef: string,
  terminalAt: string,
): void {
  const payload = asObject(value, "payload");
  assertExactKeys(
    payload,
    ["terminal", "usage", "money", "timeline_complete", "capture_gaps"],
    [],
    "payload",
  );
  const terminal = asObject(payload.terminal, "payload.terminal");
  assertExactKeys(terminal, ["status"], [], "payload.terminal");
  const status = asString(terminal.status, "payload.terminal.status");
  if (status !== "settled" && status !== "cancelled") {
    throw new StrictJsonError(
      "invalid_domain_payload",
      "payload.terminal.status is invalid",
    );
  }

  const usage = asObject(payload.usage, "payload.usage");
  assertExactKeys(
    usage,
    [
      "model",
      "prompt_tokens",
      "uncached_prompt_tokens",
      "cache_read_tokens",
      "cache_creation_tokens",
      "completion_tokens",
      "source",
      "authority",
      "purpose",
      "finality",
      "contract_version",
      "cache_usage_schema",
      "cache_usage_status",
    ],
    ["estimate_version"],
    "payload.usage",
  );
  boundedOpaqueString(usage.model, "payload.usage.model", 1, 100);
  const prompt = parseInt64Decimal(
    asString(usage.prompt_tokens, "payload.usage.prompt_tokens"),
  );
  const uncached = parseInt64Decimal(
    asString(
      usage.uncached_prompt_tokens,
      "payload.usage.uncached_prompt_tokens",
    ),
  );
  const cacheRead = parseInt64Decimal(
    asString(usage.cache_read_tokens, "payload.usage.cache_read_tokens"),
  );
  const cacheCreation = parseInt64Decimal(
    asString(
      usage.cache_creation_tokens,
      "payload.usage.cache_creation_tokens",
    ),
  );
  const completion = parseInt64Decimal(
    asString(usage.completion_tokens, "payload.usage.completion_tokens"),
  );
  if (
    uncached + cacheRead + cacheCreation !== prompt ||
    prompt + completion > MAX_INT64
  ) {
    throw new StrictJsonError(
      "invalid_domain_payload",
      "payload usage partition or total is invalid",
    );
  }
  boundedOpaqueString(usage.source, "payload.usage.source", 0, 32);
  boundedOpaqueString(usage.authority, "payload.usage.authority", 0, 64);
  boundedOpaqueString(usage.purpose, "payload.usage.purpose", 0, 64);
  boundedOpaqueString(usage.finality, "payload.usage.finality", 0, 64);
  boundedOpaqueString(
    usage.contract_version,
    "payload.usage.contract_version",
    0,
    80,
  );
  boundedOpaqueString(
    usage.cache_usage_schema,
    "payload.usage.cache_usage_schema",
    0,
    80,
  );
  boundedOpaqueString(
    usage.cache_usage_status,
    "payload.usage.cache_usage_status",
    0,
    40,
  );
  if (usage.estimate_version !== undefined) {
    boundedOpaqueString(
      usage.estimate_version,
      "payload.usage.estimate_version",
      0,
      80,
    );
  }

  validateMoney(payload.money);
  if (!asBoolean(payload.timeline_complete, "payload.timeline_complete")) {
    throw new StrictJsonError(
      "invalid_domain_payload",
      "payload.timeline_complete must be true",
    );
  }
  validateReferenceGapArray(
    payload.capture_gaps,
    eventId,
    orgRef,
    projectRef,
    terminalAt,
  );
}

function validateReferenceGapArray(
  value: JsonValue | undefined,
  eventId: string,
  orgRef: string,
  projectRef: string,
  terminalAt: string,
): void {
  const gaps = asArray(value, "payload.capture_gaps");
  if (gaps.length !== REQUIRED_GAPS.length) {
    throw new StrictJsonError(
      "invalid_domain_payload",
      "payload.capture_gaps must contain four entries",
    );
  }
  const expectedProvenance: Record<string, string> = {
    affected_claim: "direct",
    reason_code: "direct",
    gap_id: "derived",
    parent_event_id: "derived",
    scope: "derived",
    correlation: "derived",
    observed_at: "derived",
    gap_type: "declared",
    severity: "declared",
    payload_capture_mode: "declared",
  };
  gaps.forEach((rawGap, index) => {
    const claim = REQUIRED_GAPS[index]!;
    const gap = asObject(rawGap, `payload.capture_gaps[${index}]`);
    assertExactKeys(
      gap,
      [
        "gap_id",
        "parent_event_id",
        "scope",
        "correlation",
        "affected_claim",
        "gap_type",
        "reason_code",
        "severity",
        "observed_at",
        "payload_capture_mode",
        "field_provenance",
      ],
      [],
      `payload.capture_gaps[${index}]`,
    );
    requireExactString(
      gap.gap_id,
      `${eventId}:gap:${claim}`,
      `payload.capture_gaps[${index}].gap_id`,
    );
    requireExactString(
      gap.parent_event_id,
      eventId,
      `payload.capture_gaps[${index}].parent_event_id`,
    );
    requireExactString(
      gap.affected_claim,
      claim,
      `payload.capture_gaps[${index}].affected_claim`,
    );
    requireExactString(
      gap.gap_type,
      "not_available_from_source",
      `payload.capture_gaps[${index}].gap_type`,
    );
    requireExactString(
      gap.reason_code,
      "not_available_at_billing_terminal",
      `payload.capture_gaps[${index}].reason_code`,
    );
    requireExactString(
      gap.severity,
      "warning",
      `payload.capture_gaps[${index}].severity`,
    );
    requireExactString(
      gap.observed_at,
      terminalAt,
      `payload.capture_gaps[${index}].observed_at`,
    );
    requireExactString(
      gap.payload_capture_mode,
      "none",
      `payload.capture_gaps[${index}].payload_capture_mode`,
    );
    const gapScope = asObject(
      gap.scope,
      `payload.capture_gaps[${index}].scope`,
    );
    assertExactKeys(
      gapScope,
      ["org_ref", "project_ref"],
      [],
      `payload.capture_gaps[${index}].scope`,
    );
    requireExactString(
      gapScope.org_ref,
      orgRef,
      `payload.capture_gaps[${index}].scope.org_ref`,
    );
    requireExactString(
      gapScope.project_ref,
      projectRef,
      `payload.capture_gaps[${index}].scope.project_ref`,
    );
    const gapCorrelation = asObject(
      gap.correlation,
      `payload.capture_gaps[${index}].correlation`,
    );
    assertExactKeys(
      gapCorrelation,
      ["request_ref"],
      [],
      `payload.capture_gaps[${index}].correlation`,
    );
    requireExactString(
      gapCorrelation.request_ref,
      eventId,
      `payload.capture_gaps[${index}].correlation.request_ref`,
    );
    const fieldProvenance = asObject(
      gap.field_provenance,
      `payload.capture_gaps[${index}].field_provenance`,
    );
    assertExactKeys(
      fieldProvenance,
      Object.keys(expectedProvenance),
      [],
      `payload.capture_gaps[${index}].field_provenance`,
    );
    for (const [key, expectedValue] of Object.entries(expectedProvenance)) {
      requireExactString(
        fieldProvenance[key],
        expectedValue,
        `payload.capture_gaps[${index}].field_provenance.${key}`,
      );
    }
  });
}

function validateTerminal(value: JsonValue | undefined): {
  status: string;
  availableAt: string;
} {
  const terminal = asObject(value as JsonValue, "terminal");
  assertExactKeys(
    terminal,
    ["status", "available_at"],
    [],
    "terminal",
  );
  const status = asString(terminal.status, "terminal.status");
  if (status !== "settled" && status !== "cancelled") {
    throw new StrictJsonError(
      "invalid_terminal_status",
      "Terminal status must be settled or cancelled",
    );
  }
  return {
    status,
    availableAt: asString(
      terminal.available_at,
      "terminal.available_at",
    ),
  };
}

function validateUsage(value: JsonValue | undefined): {
  model: string;
  promptTokens: bigint;
  uncachedPromptTokens: bigint;
  cacheReadTokens: bigint;
  cacheCreationTokens: bigint;
  completionTokens: bigint;
  source: string;
  authority: string;
  purpose: string;
  finality: string;
  contractVersion: string;
  estimateVersion?: string;
  cacheUsageSchema: string;
  cacheUsageStatus: string;
} {
  const usage = asObject(value as JsonValue, "usage");
  assertExactKeys(
    usage,
    [
      "model",
      "prompt_tokens",
      "uncached_prompt_tokens",
      "cache_read_tokens",
      "cache_creation_tokens",
      "completion_tokens",
      "source",
      "authority",
      "purpose",
      "finality",
      "contract_version",
      "cache_usage_schema",
      "cache_usage_status",
    ],
    ["estimate_version"],
    "usage",
  );
  const promptTokens = nonnegativeInt64(
    usage.prompt_tokens,
    "usage.prompt_tokens",
  );
  const uncachedPromptTokens = nonnegativeInt64(
    usage.uncached_prompt_tokens,
    "usage.uncached_prompt_tokens",
  );
  const cacheReadTokens = nonnegativeInt64(
    usage.cache_read_tokens,
    "usage.cache_read_tokens",
  );
  const cacheCreationTokens = nonnegativeInt64(
    usage.cache_creation_tokens,
    "usage.cache_creation_tokens",
  );
  const completionTokens = nonnegativeInt64(
    usage.completion_tokens,
    "usage.completion_tokens",
  );
  if (
    uncachedPromptTokens + cacheReadTokens + cacheCreationTokens !==
      promptTokens ||
    promptTokens + completionTokens > MAX_INT64
  ) {
    throw new StrictJsonError(
      "invalid_usage_partition",
      "Usage token partition or total is invalid",
    );
  }
  const result: {
    model: string;
    promptTokens: bigint;
    uncachedPromptTokens: bigint;
    cacheReadTokens: bigint;
    cacheCreationTokens: bigint;
    completionTokens: bigint;
    source: string;
    authority: string;
    purpose: string;
    finality: string;
    contractVersion: string;
    estimateVersion?: string;
    cacheUsageSchema: string;
    cacheUsageStatus: string;
  } = {
    model: boundedOpaqueString(usage.model, "usage.model", 1, 100),
    promptTokens,
    uncachedPromptTokens,
    cacheReadTokens,
    cacheCreationTokens,
    completionTokens,
    source: boundedOpaqueString(usage.source, "usage.source", 0, 32),
    authority: boundedOpaqueString(
      usage.authority,
      "usage.authority",
      0,
      64,
    ),
    purpose: boundedOpaqueString(usage.purpose, "usage.purpose", 0, 64),
    finality: boundedOpaqueString(usage.finality, "usage.finality", 0, 64),
    contractVersion: boundedOpaqueString(
      usage.contract_version,
      "usage.contract_version",
      0,
      80,
    ),
    cacheUsageSchema: boundedOpaqueString(
      usage.cache_usage_schema,
      "usage.cache_usage_schema",
      0,
      80,
    ),
    cacheUsageStatus: boundedOpaqueString(
      usage.cache_usage_status,
      "usage.cache_usage_status",
      0,
      40,
    ),
  };
  if (usage.estimate_version !== undefined) {
    result.estimateVersion = boundedOpaqueString(
      usage.estimate_version,
      "usage.estimate_version",
      0,
      80,
    );
  }
  return result;
}

function validateMoney(value: JsonValue | undefined): JsonObject {
  const money = asObject(value as JsonValue, "money");
  assertExactKeys(
    money,
    [
      "schema",
      "currency",
      "amount_scale",
      "calculated_cost_micros",
      "charged_cost_micros",
      "pricing_version",
    ],
    [],
    "money",
  );
  requireExactString(money.schema, "micro-cny.v1", "money.schema");
  requireExactString(money.currency, "CNY", "money.currency");
  if (asInteger(money.amount_scale, "money.amount_scale") !== 1000000n) {
    throw new StrictJsonError(
      "invalid_money",
      "money.amount_scale must equal 1000000",
    );
  }
  const calculated = asString(
    money.calculated_cost_micros,
    "money.calculated_cost_micros",
  );
  const charged = asString(
    money.charged_cost_micros,
    "money.charged_cost_micros",
  );
  if (!MONEY_PATTERN.test(calculated) || !MONEY_PATTERN.test(charged)) {
    throw new StrictJsonError(
      "invalid_money",
      "Money micros must be canonical nonnegative decimal strings",
    );
  }
  return {
    schema: "micro-cny.v1",
    currency: "CNY",
    amount_scale: 1000000,
    calculated_cost_micros: calculated,
    charged_cost_micros: charged,
    pricing_version: boundedOpaqueString(
      money.pricing_version,
      "money.pricing_version",
      0,
      80,
    ),
  };
}

function nonnegativeInt64(
  value: JsonValue | undefined,
  name: string,
): bigint {
  const integer = asInteger(value, name);
  if (integer < 0 || integer > MAX_INT64) {
    throw new StrictJsonError(
      "invalid_int64_counter",
      `${name} must be a nonnegative signed int64`,
    );
  }
  return integer;
}

function positiveInt64(
  value: JsonValue | undefined,
  name: string,
): bigint {
  const integer = asInteger(value, name);
  if (integer <= 0 || integer > MAX_INT64) {
    throw new StrictJsonError(
      "invalid_scope",
      `${name} must be a positive signed int64`,
    );
  }
  return integer;
}

function boundedOpaqueString(
  value: JsonValue | undefined,
  name: string,
  minimum: number,
  maximum: number,
): string {
  const text = asString(value, name);
  const length = opaqueUtf8(text).length;
  if (length < minimum || length > maximum) {
    throw new StrictJsonError(
      "invalid_source_text",
      `${name} must contain ${minimum}..${maximum} UTF-8 bytes`,
    );
  }
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (
      code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    ) {
      throw new StrictJsonError(
        "invalid_source_text",
        `${name} contains a control character`,
      );
    }
  }
  return text;
}

function requirePatternString(
  value: JsonValue | undefined,
  pattern: RegExp,
  maximum: number,
  name: string,
): string {
  const text = asString(value, name);
  if (text.length > maximum || !pattern.test(text)) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      `${name} does not match the frozen Schema`,
    );
  }
  assertProtocolControlledNfc(text, name);
  return text;
}

function requirePositiveDecimalRef(
  value: JsonValue | undefined,
  name: string,
): string {
  const text = asString(value, name);
  if (!/^[1-9][0-9]*$/.test(text) || text.length > 20) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      `${name} must be a positive decimal reference`,
    );
  }
  return text;
}

function requireCanonicalMicrosecondTime(
  value: JsonValue | undefined,
  name: string,
): string {
  const text = asString(value, name);
  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/
      .test(text)
  ) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      `${name} must be canonical UTC microsecond time`,
    );
  }
  const normalized = normalizeMicrosecondTimestamp(text);
  if (!normalized.valid || normalized.normalized !== text) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      `${name} is not a valid canonical timestamp`,
    );
  }
  return text;
}

function requireSha256(
  value: JsonValue | undefined,
  name: string,
): string {
  const text = asString(value, name);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new StrictJsonError(
      "invalid_event_envelope",
      `${name} must be a lowercase SHA-256 reference`,
    );
  }
  return text;
}

function requireExactString(
  value: JsonValue | undefined,
  expected: string,
  name: string,
): void {
  if (asString(value, name) !== expected) {
    throw new StrictJsonError(
      "invalid_artifact",
      `${name} must equal ${expected}`,
    );
  }
}

function rejectProhibitedRawFields(value: JsonValue): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectProhibitedRawFields(item);
    }
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED_RAW_KEYS.has(key.toLowerCase())) {
      throw new StrictJsonError(
        "prohibited_raw_field",
        "Source payload contains a prohibited raw field",
      );
    }
    rejectProhibitedRawFields(child);
  }
}

function validDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (
    month < 1 || month > 12 || day < 1 ||
    day > daysInMonth(year, month) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) {
    return false;
  }
  return true;
}

function daysInMonth(year: number, month: number): number {
  const values = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return values[month - 1]!;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validZone(zone: string): boolean {
  if (zone === "Z") {
    return true;
  }
  const hour = Number(zone.slice(1, 3));
  const minute = Number(zone.slice(4, 6));
  return hour <= 23 && minute <= 59;
}

function parseOffsetMinutes(zone: string): number {
  const sign = zone[0] === "+" ? 1 : -1;
  return sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
}
