import {
  asArray,
  asBoolean,
  asInteger,
  asObject,
  assertExactKeys,
  asString,
  canonicalBytes,
  JsonObject,
  JsonValue,
  Limits,
  parseStrictJsonBytes,
  sha256,
  StrictJsonError,
} from "../canonical/json.ts";
import {
  idempotencyKey,
  isNfc,
  normalizeMicrosecondTimestamp,
} from "../canonical/core.ts";

const EVENT_TYPE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;
const SCHEMA_REF = /^foigent:\/\/events\/[a-z0-9][a-z0-9/_-]*\/v[1-9][0-9]*$/;
const PRODUCT = /^[a-z][a-z0-9_-]*$/;
const CONNECTOR = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const POSITIVE = /^[1-9][0-9]*$/;
const NAME = /^[a-z][a-z0-9_.-]*$/;
const SUBJECT_TYPE = /^[a-z][a-z0-9_]*$/;
const SHA = /^sha256:[0-9a-f]{64}$/;
const MICRO_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/;

export const SDK_PROTOCOL_VERSION = "1.1.2";
export const SDK_AUTHORITY_COMMIT = "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16";
export const SDK_RELEASE_DIGEST =
  "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1";

export interface PayloadValidator {
  validate(
    schemaRef: string,
    schemaVersion: string,
    payload: JsonObject,
  ): void;
}

export interface Envelope {
  readonly value: JsonObject;
  readonly eventId: string;
  readonly eventType: string;
  readonly envelopeHash: string;
  readonly idempotencyKey: string;
}

export interface Batch {
  readonly value: JsonObject;
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly producerInstance: string;
  readonly generatedAt: string;
  readonly events: readonly Envelope[];
  readonly nextCursor: string;
  readonly highWatermark: string;
  readonly hasMore: boolean;
}

export interface Checkpoint {
  readonly value?: JsonObject;
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly producerInstance: string;
  readonly cursor: string;
  readonly highWatermark: string;
  readonly phase: "bootstrap" | "steady" | "error";
  readonly updatedAt: string;
}

export interface ConnectorError {
  readonly value: JsonObject;
  readonly category: string;
  readonly code: string;
  readonly phase: string;
  readonly operation: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly safeMessage: string;
  readonly recovery: string;
}

export interface CompatibilityPin {
  readonly consumer: string;
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly sourceRevision: string;
  readonly protocolVersion: string;
  readonly protocolReleaseDigest: string;
  readonly manifestSchemaSha256: string;
  readonly referenceManifestSha256: string;
  readonly projectionContractSha256: string;
}

export const SUPPORTED_COMPATIBILITY_PINS: readonly CompatibilityPin[] = [
  {
    consumer: "xinsight-reference",
    connectorId: "foigent.unirouter.completed-execution",
    connectorVersion: "1.0.0",
    sourceRevision: "1",
    protocolVersion: "1.0.0",
    protocolReleaseDigest:
      "sha256:aaeb5b37b94a1fd603048d77b2180fa88be1ddbd6eeea6a1369edf0cea9c5e2b",
    manifestSchemaSha256:
      "sha256:a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf",
    referenceManifestSha256:
      "sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79",
    projectionContractSha256:
      "sha256:c812a9c70d55ad0413650218eab6f968fd44974e1e7d77a147d58f62e18e8b03",
  },
  {
    consumer: "xinsight-litellm",
    connectorId: "foigent.litellm.spend-logs",
    connectorVersion: "1.0.0",
    sourceRevision: "1",
    protocolVersion: "1.1.2",
    protocolReleaseDigest: SDK_RELEASE_DIGEST,
    manifestSchemaSha256:
      "sha256:59c405086310d0dfb2aaff37e55d73853e04319e6ccf659c66f98d8ba704a205",
    referenceManifestSha256:
      "sha256:86a10565a8c66abe5b31d6c39e853cebf5e9b90721d6784ea0bf7c28d2c20693",
    projectionContractSha256:
      "sha256:72bb90b6a5ddf0f44f7773a7378c0f7f458438f9fc1363d31a65602c0547f088",
  },
  {
    consumer: "unirouter-reference-runtime",
    connectorId: "foigent.unirouter.completed-execution",
    connectorVersion: "1.0.0",
    sourceRevision: "1",
    protocolVersion: "1.1.0",
    protocolReleaseDigest:
      "sha256:3bb10a544ace17d3b6c4a44e19048c45c557eba19ad79d9cea81728336658c4d",
    manifestSchemaSha256:
      "sha256:59c405086310d0dfb2aaff37e55d73853e04319e6ccf659c66f98d8ba704a205",
    referenceManifestSha256:
      "sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79",
    projectionContractSha256:
      "sha256:c812a9c70d55ad0413650218eab6f968fd44974e1e7d77a147d58f62e18e8b03",
  },
] as const;

export function validateCompatibilityPin(candidate: CompatibilityPin): void {
  if (
    !SUPPORTED_COMPATIBILITY_PINS.some((supported) =>
      Object.keys(candidate).length === Object.keys(supported).length &&
      Object.keys(supported).every((key) =>
        supported[key as keyof CompatibilityPin] ===
          candidate[key as keyof CompatibilityPin]
      )
    )
  ) {
    throw new StrictJsonError(
      "unsupported_compatibility",
      `unsupported compatibility tuple ${candidate.consumer}/${candidate.connectorId}/${candidate.protocolVersion}`,
    );
  }
}

export function validateReleasedSourceRevision(revision: string): void {
  if (revision !== "1") {
    throw new StrictJsonError(
      "unsupported_source_revision",
      `unsupported released Source revision ${JSON.stringify(revision)}`,
    );
  }
}

export function parseEnvelope(
  bytes: Uint8Array,
  limits: Limits,
  payloadValidator?: PayloadValidator,
): Envelope {
  return validateEnvelope(
    asObject(parseStrictJsonBytes(bytes, limits), "Envelope"),
    true,
    payloadValidator,
  );
}

export function parseEnvelopeHashInput(
  bytes: Uint8Array,
  limits: Limits,
  payloadValidator?: PayloadValidator,
): Envelope {
  return validateEnvelope(
    asObject(parseStrictJsonBytes(bytes, limits), "Envelope hash input"),
    false,
    payloadValidator,
  );
}

export function validateEnvelope(
  root: JsonObject,
  requireEnvelopeHash: boolean,
  payloadValidator?: PayloadValidator,
): Envelope {
  assertExactKeys(
    root,
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
    "Envelope",
  );
  exactString(root, "spec_version", "foigent.event-envelope.v1", "Envelope");
  const eventId = boundedString(root, "event_id", 1, 128, "Envelope");
  const eventType = patternedString(
    root,
    "event_type",
    EVENT_TYPE,
    128,
    "Envelope",
  );
  const schemaRef = patternedString(
    root,
    "schema_ref",
    SCHEMA_REF,
    200,
    "Envelope",
  );
  const schemaVersion = patternedString(
    root,
    "schema_version",
    POSITIVE,
    20,
    "Envelope",
  );

  const producer = objectMember(root, "producer", "Envelope");
  assertExactKeys(
    producer,
    ["product", "instance", "connector_id", "connector_version"],
    [],
    "Envelope.producer",
  );
  const product = patternedString(
    producer,
    "product",
    PRODUCT,
    64,
    "Envelope.producer",
  );
  const instance = boundedString(
    producer,
    "instance",
    1,
    128,
    "Envelope.producer",
    true,
  );
  patternedString(
    producer,
    "connector_id",
    CONNECTOR,
    160,
    "Envelope.producer",
  );
  patternedString(
    producer,
    "connector_version",
    SEMVER,
    64,
    "Envelope.producer",
  );

  const scope = objectMember(root, "scope", "Envelope");
  assertExactKeys(
    scope,
    ["org_ref", "project_ref"],
    ["tenant_ref"],
    "Envelope.scope",
  );
  const orgRef = patternedString(
    scope,
    "org_ref",
    POSITIVE,
    20,
    "Envelope.scope",
  );
  const projectRef = patternedString(
    scope,
    "project_ref",
    POSITIVE,
    20,
    "Envelope.scope",
  );
  const tenantRef = "tenant_ref" in scope
    ? boundedString(scope, "tenant_ref", 1, 128, "Envelope.scope")
    : null;

  const subject = objectMember(root, "subject", "Envelope");
  assertExactKeys(subject, ["type", "ref"], [], "Envelope.subject");
  patternedString(
    subject,
    "type",
    SUBJECT_TYPE,
    64,
    "Envelope.subject",
  );
  boundedString(subject, "ref", 1, 128, "Envelope.subject");

  const actor = objectMember(root, "actor", "Envelope");
  assertExactKeys(
    actor,
    ["type"],
    ["ref", "on_behalf_of"],
    "Envelope.actor",
  );
  enumString(actor, "type", ["system", "service", "user", "unknown"], "Envelope.actor");
  for (const key of ["ref", "on_behalf_of"]) {
    if (key in actor) {
      boundedString(actor, key, 1, 128, "Envelope.actor");
    }
  }

  const time = objectMember(root, "time", "Envelope");
  assertExactKeys(
    time,
    [],
    ["occurred_at", "observed_at", "terminal_at"],
    "Envelope.time",
  );
  if (Object.keys(time).length === 0) {
    fail("Envelope.time must contain at least one timestamp");
  }
  for (const key of Object.keys(time)) {
    exactMicroTime(time, key, "Envelope.time");
  }

  const correlation = objectMember(root, "correlation", "Envelope");
  assertExactKeys(
    correlation,
    [],
    ["request_ref", "trace_ref", "span_ref", "causation_event_id"],
    "Envelope.correlation",
  );
  for (const key of Object.keys(correlation)) {
    boundedString(correlation, key, 1, 128, "Envelope.correlation");
  }

  const identity = objectMember(root, "identity", "Envelope");
  assertExactKeys(
    identity,
    ["idempotency_key", "source_revision"],
    [],
    "Envelope.identity",
  );
  const actualIdempotency = shaString(
    identity,
    "idempotency_key",
    "Envelope.identity",
  );
  boundedString(
    identity,
    "source_revision",
    1,
    64,
    "Envelope.identity",
  );
  const expectedIdempotency = idempotencyKey({
    producerProduct: product,
    producerInstance: instance,
    tenantRef,
    orgRef,
    projectRef,
    eventType,
    eventId,
  });
  if (actualIdempotency !== expectedIdempotency) {
    fail("Envelope.identity.idempotency_key does not match scoped identity");
  }

  const integrity = objectMember(root, "integrity", "Envelope");
  assertExactKeys(
    integrity,
    requireEnvelopeHash ? ["envelope_hash"] : [],
    requireEnvelopeHash ? ["source_hash"] : ["source_hash"],
    "Envelope.integrity",
  );
  if ("source_hash" in integrity) {
    shaString(integrity, "source_hash", "Envelope.integrity");
  }
  let envelopeHash = "";
  if (requireEnvelopeHash) {
    envelopeHash = shaString(
      integrity,
      "envelope_hash",
      "Envelope.integrity",
    );
    const hashInput = cloneJson(root) as JsonObject;
    const clonedIntegrity = asObject(
      hashInput.integrity,
      "Envelope.integrity",
    );
    delete clonedIntegrity.envelope_hash;
    const expected = sha256(canonicalBytes(hashInput));
    if (envelopeHash !== expected) {
      fail("Envelope.integrity.envelope_hash does not match canonical input");
    }
  } else if ("envelope_hash" in integrity) {
    fail("Envelope hash input must omit integrity.envelope_hash");
  }

  const dataPolicy = objectMember(root, "data_policy", "Envelope");
  assertExactKeys(
    dataPolicy,
    ["payload_capture_mode", "raw_payload_present"],
    ["redaction_profile"],
    "Envelope.data_policy",
  );
  enumString(
    dataPolicy,
    "payload_capture_mode",
    ["none", "metadata_only", "redacted", "full"],
    "Envelope.data_policy",
  );
  asBoolean(dataPolicy.raw_payload_present, "Envelope.data_policy.raw_payload_present");
  if ("redaction_profile" in dataPolicy) {
    boundedString(
      dataPolicy,
      "redaction_profile",
      1,
      128,
      "Envelope.data_policy",
    );
  }

  const provenance = objectMember(root, "provenance", "Envelope");
  assertExactKeys(
    provenance,
    ["adapter_fidelity", "field_groups"],
    [],
    "Envelope.provenance",
  );
  enumString(
    provenance,
    "adapter_fidelity",
    ["F0", "F1", "F2", "F3"],
    "Envelope.provenance",
  );
  const fieldGroups = objectMember(
    provenance,
    "field_groups",
    "Envelope.provenance",
  );
  if (Object.keys(fieldGroups).length === 0) {
    fail("Envelope.provenance.field_groups must not be empty");
  }
  for (const [key, value] of Object.entries(fieldGroups)) {
    if (!NAME.test(key)) {
      fail("Envelope.provenance.field_groups contains an invalid key");
    }
    enumValue(
      value,
      [
        "direct",
        "derived",
        "declared",
        "suppressed",
        "gap",
        "not_applicable",
        "unknown",
      ],
      `Envelope.provenance.field_groups.${key}`,
    );
  }

  const payload = objectMember(root, "payload", "Envelope");
  payloadValidator?.validate(schemaRef, schemaVersion, payload);
  return {
    value: root,
    eventId,
    eventType,
    envelopeHash,
    idempotencyKey: actualIdempotency,
  };
}

export function parseBatch(
  bytes: Uint8Array,
  limits: Limits,
  payloadValidator?: PayloadValidator,
): Batch {
  const root = asObject(parseStrictJsonBytes(bytes, limits), "Batch");
  assertExactKeys(
    root,
    [
      "batch_version",
      "connector_id",
      "connector_version",
      "producer_instance",
      "generated_at",
      "events",
      "next_cursor",
      "high_watermark",
      "has_more",
    ],
    [],
    "Batch",
  );
  exactString(root, "batch_version", "foigent.event-batch.v1", "Batch");
  const connectorId = boundedString(root, "connector_id", 1, 160, "Batch");
  const connectorVersion = patternedString(
    root,
    "connector_version",
    SEMVER,
    64,
    "Batch",
  );
  const producerInstance = boundedString(
    root,
    "producer_instance",
    1,
    128,
    "Batch",
    true,
  );
  const generatedAt = exactMicroTime(root, "generated_at", "Batch");
  const eventValues = asArray(root.events, "Batch.events");
  if (eventValues.length > 50) {
    fail("Batch.events must contain at most 50 items");
  }
  const events = eventValues.map((event, index) =>
    validateEnvelope(
      asObject(event, `Batch.events[${index}]`),
      true,
      payloadValidator,
    )
  );
  const nextCursor = boundedString(
    root,
    "next_cursor",
    0,
    512,
    "Batch",
    true,
  );
  const highWatermark = boundedString(
    root,
    "high_watermark",
    0,
    512,
    "Batch",
    true,
  );
  const hasMore = asBoolean(root.has_more, "Batch.has_more");
  return {
    value: root,
    connectorId,
    connectorVersion,
    producerInstance,
    generatedAt,
    events,
    nextCursor,
    highWatermark,
    hasMore,
  };
}

export function parseCheckpoint(
  bytes: Uint8Array,
  limits: Limits,
): Checkpoint {
  return validateCheckpoint(
    asObject(parseStrictJsonBytes(bytes, limits), "Checkpoint"),
  );
}

export function validateCheckpoint(root: JsonObject): Checkpoint {
  assertExactKeys(
    root,
    [
      "checkpoint_version",
      "connector_id",
      "connector_version",
      "producer_instance",
      "cursor",
      "high_watermark",
      "phase",
      "updated_at",
    ],
    [],
    "Checkpoint",
  );
  exactString(
    root,
    "checkpoint_version",
    "foigent.connector-checkpoint.v1",
    "Checkpoint",
  );
  const connectorId = boundedString(
    root,
    "connector_id",
    1,
    160,
    "Checkpoint",
  );
  const connectorVersion = patternedString(
    root,
    "connector_version",
    SEMVER,
    64,
    "Checkpoint",
  );
  const producerInstance = boundedString(
    root,
    "producer_instance",
    1,
    128,
    "Checkpoint",
    true,
  );
  const cursor = boundedString(
    root,
    "cursor",
    0,
    512,
    "Checkpoint",
    true,
  );
  const highWatermark = boundedString(
    root,
    "high_watermark",
    0,
    512,
    "Checkpoint",
    true,
  );
  const phase = enumString(
    root,
    "phase",
    ["bootstrap", "steady", "error"],
    "Checkpoint",
  ) as Checkpoint["phase"];
  const updatedAt = exactMicroTime(root, "updated_at", "Checkpoint");
  return {
    value: root,
    connectorId,
    connectorVersion,
    producerInstance,
    cursor,
    highWatermark,
    phase,
    updatedAt,
  };
}

export function parseConnectorError(
  bytes: Uint8Array,
  limits: Limits,
): ConnectorError {
  return validateConnectorError(
    asObject(parseStrictJsonBytes(bytes, limits), "ConnectorError"),
  );
}

export function validateConnectorError(root: JsonObject): ConnectorError {
  assertExactKeys(
    root,
    [
      "error_version",
      "category",
      "code",
      "phase",
      "operation",
      "retryable",
      "safe_message",
      "recovery",
    ],
    ["retry_after_seconds"],
    "ConnectorError",
  );
  exactString(
    root,
    "error_version",
    "foigent.connector-error.v1",
    "ConnectorError",
  );
  const category = enumString(
    root,
    "category",
    [
      "configuration",
      "authentication",
      "authorization",
      "transport",
      "source",
      "contract",
      "privacy",
      "cursor",
      "conflict",
      "persistence",
      "internal",
    ],
    "ConnectorError",
  );
  const code = patternedString(
    root,
    "code",
    NAME,
    160,
    "ConnectorError",
  );
  const phase = enumString(
    root,
    "phase",
    [
      "configure",
      "activate",
      "fetch",
      "decode",
      "validate",
      "normalize",
      "commit",
      "checkpoint",
      "status",
      "shutdown",
    ],
    "ConnectorError",
  );
  const operation = patternedString(
    root,
    "operation",
    NAME,
    128,
    "ConnectorError",
  );
  const retryable = asBoolean(root.retryable, "ConnectorError.retryable");
  let retryAfterSeconds: number | undefined;
  if ("retry_after_seconds" in root) {
    retryAfterSeconds = boundedInteger(
      root.retry_after_seconds,
      0,
      300,
      "ConnectorError.retry_after_seconds",
    );
    if (!retryable) {
      fail("ConnectorError.retry_after_seconds requires retryable=true");
    }
  }
  const safeMessage = boundedString(
    root,
    "safe_message",
    1,
    512,
    "ConnectorError",
    true,
  );
  const recovery = enumString(
    root,
    "recovery",
    [
      "automatic_retry",
      "restart",
      "reauthorize",
      "operator_repair",
      "explicit_resync",
      "none",
    ],
    "ConnectorError",
  );
  return {
    value: root,
    category,
    code,
    phase,
    operation,
    retryable,
    retryAfterSeconds,
    safeMessage,
    recovery,
  };
}

export function parseOperationalReceipt(
  bytes: Uint8Array,
  limits: Limits,
): JsonObject {
  const root = asObject(
    parseStrictJsonBytes(bytes, limits),
    "OperationalReceipt",
  );
  assertExactKeys(
    root,
    [
      "receipt_version",
      "operation_id",
      "connector_id",
      "producer_instance",
      "operation",
      "status",
      "counts",
      "observed_at",
    ],
    ["checkpoint_before", "checkpoint_after", "error"],
    "OperationalReceipt",
  );
  exactString(
    root,
    "receipt_version",
    "foigent.operational-receipt.v1",
    "OperationalReceipt",
  );
  boundedString(root, "operation_id", 1, 128, "OperationalReceipt");
  boundedString(root, "connector_id", 1, 160, "OperationalReceipt");
  boundedString(
    root,
    "producer_instance",
    1,
    128,
    "OperationalReceipt",
    true,
  );
  enumString(
    root,
    "operation",
    [
      "activate",
      "poll",
      "commit_page",
      "pause",
      "resume",
      "stop",
      "start",
      "rotate",
      "retire",
    ],
    "OperationalReceipt",
  );
  const status = enumString(
    root,
    "status",
    ["accepted", "completed", "retryable_error", "permanent_error"],
    "OperationalReceipt",
  );
  const counts = objectMember(root, "counts", "OperationalReceipt");
  const countKeys = [
    "received",
    "inserted",
    "duplicate_noop",
    "conflict",
    "rejected",
  ];
  assertExactKeys(counts, countKeys, [], "OperationalReceipt.counts");
  const received = boundedInteger(
    counts.received,
    0,
    Number.MAX_SAFE_INTEGER,
    "counts.received",
  );
  const inserted = boundedInteger(
    counts.inserted,
    0,
    Number.MAX_SAFE_INTEGER,
    "counts.inserted",
  );
  const duplicateNoop = boundedInteger(
    counts.duplicate_noop,
    0,
    Number.MAX_SAFE_INTEGER,
    "counts.duplicate_noop",
  );
  const conflict = boundedInteger(
    counts.conflict,
    0,
    Number.MAX_SAFE_INTEGER,
    "counts.conflict",
  );
  const rejected = boundedInteger(
    counts.rejected,
    0,
    Number.MAX_SAFE_INTEGER,
    "counts.rejected",
  );
  if (
    status === "completed" &&
    received !== inserted + duplicateNoop + conflict + rejected
  ) {
    fail("completed receipt counts must fully classify received items");
  }
  for (const key of ["checkpoint_before", "checkpoint_after"]) {
    if (key in root) {
      boundedString(root, key, 0, 512, "OperationalReceipt", true);
    }
  }
  exactMicroTime(root, "observed_at", "OperationalReceipt");
  if ("error" in root) {
    validateConnectorError(asObject(root.error, "OperationalReceipt.error"));
  }
  return root;
}

export function parseLifecycle(
  bytes: Uint8Array,
  limits: Limits,
): JsonObject {
  const root = asObject(parseStrictJsonBytes(bytes, limits), "Lifecycle");
  assertExactKeys(
    root,
    [
      "lifecycle_version",
      "configuration",
      "authentication",
      "transport",
      "processing",
      "checkpoint",
      "health",
    ],
    [],
    "Lifecycle",
  );
  exactString(
    root,
    "lifecycle_version",
    "foigent.connector-lifecycle.v1",
    "Lifecycle",
  );
  enumString(
    root,
    "configuration",
    ["unconfigured", "configured", "retired"],
    "Lifecycle",
  );
  enumString(
    root,
    "authentication",
    ["absent", "staged", "valid", "revoked", "error"],
    "Lifecycle",
  );
  enumString(
    root,
    "transport",
    ["stopped", "starting", "ready", "backoff", "error"],
    "Lifecycle",
  );
  enumString(root, "processing", [
    "inactive",
    "idle",
    "polling",
    "committing",
    "backoff",
    "stopping",
    "error",
  ], "Lifecycle");
  enumString(
    root,
    "checkpoint",
    ["absent", "bootstrap", "steady", "error"],
    "Lifecycle",
  );
  enumString(root, "health", [
    "unknown",
    "healthy",
    "degraded",
    "permanent_error",
    "stopped",
    "retired",
  ], "Lifecycle");
  return root;
}

export function parseManifest(
  bytes: Uint8Array,
  limits: Limits,
): JsonObject {
  const root = asObject(parseStrictJsonBytes(bytes, limits), "Manifest");
  assertExactKeys(
    root,
    [
      "manifest_version",
      "connector_id",
      "connector_version",
      "connector_class",
      "direction",
      "source_product",
      "event_identity_profile",
      "supported_source_schemas",
      "emitted_event_schemas",
      "transport",
      "delivery",
      "bootstrap",
      "checkpoint",
      "coverage",
      "instance_binding",
      "payload_policy",
      "required_capabilities",
      "declared_capture_gaps",
      "compatibility",
    ],
    ["source_release"],
    "Manifest",
  );
  exactString(
    root,
    "manifest_version",
    "foigent.connector-manifest.v1",
    "Manifest",
  );
  patternedString(root, "connector_id", CONNECTOR, 160, "Manifest");
  patternedString(root, "connector_version", SEMVER, 64, "Manifest");
  enumString(
    root,
    "connector_class",
    ["integration", "value", "enforcement"],
    "Manifest",
  );
  enumString(root, "direction", ["source", "sink", "bidirectional"], "Manifest");
  patternedString(root, "source_product", PRODUCT, 64, "Manifest");
  patternedString(root, "event_identity_profile", CONNECTOR, 200, "Manifest");
  validateManifestSchemas(root);
  validateManifestPolicy(root);
  if ("source_release" in root) {
    validateSourceRelease(asObject(root.source_release, "Manifest.source_release"));
  }
  return root;
}

function validateManifestSchemas(root: JsonObject): void {
  const sourceSchemas = asArray(
    root.supported_source_schemas,
    "Manifest.supported_source_schemas",
  );
  if (sourceSchemas.length === 0) {
    fail("Manifest.supported_source_schemas must not be empty");
  }
  const seen = new Set<string>();
  for (const [index, item] of sourceSchemas.entries()) {
    const value = asObject(item, `supported_source_schemas[${index}]`);
    assertExactKeys(value, ["schema_id", "sha256"], [], "source schema");
    const id = boundedString(value, "schema_id", 1, 200, "source schema");
    if (seen.has(id)) {
      fail("Manifest.supported_source_schemas must be unique");
    }
    seen.add(id);
    shaString(value, "sha256", "source schema");
  }
  const eventSchemas = asArray(
    root.emitted_event_schemas,
    "Manifest.emitted_event_schemas",
  );
  if (eventSchemas.length === 0) {
    fail("Manifest.emitted_event_schemas must not be empty");
  }
  for (const item of eventSchemas) {
    const value = asObject(item, "emitted event schema");
    assertExactKeys(
      value,
      ["event_type", "schema_ref", "schema_version"],
      [],
      "emitted event schema",
    );
    boundedString(value, "event_type", 1, 128, "emitted event schema");
    boundedString(value, "schema_ref", 1, 200, "emitted event schema");
    patternedString(
      value,
      "schema_version",
      POSITIVE,
      20,
      "emitted event schema",
    );
  }
}

function validateManifestPolicy(root: JsonObject): void {
  const transport = objectMember(root, "transport", "Manifest");
  assertExactKeys(
    transport,
    ["mode", "route", "page_schema", "max_items", "max_bytes"],
    [],
    "Manifest.transport",
  );
  exactString(transport, "mode", "https_pull", "Manifest.transport");
  patternedString(
    transport,
    "route",
    /^\/[A-Za-z0-9_./-]+$/,
    240,
    "Manifest.transport",
  );
  boundedString(transport, "page_schema", 1, 160, "Manifest.transport");
  boundedInteger(transport.max_items, 1, 1000, "Manifest.transport.max_items");
  boundedInteger(
    transport.max_bytes,
    1,
    Number.MAX_SAFE_INTEGER,
    "Manifest.transport.max_bytes",
  );
  const delivery = objectMember(root, "delivery", "Manifest");
  assertExactKeys(
    delivery,
    ["guarantee", "checkpoint_commit", "conflict", "empty_page_cursor_advance"],
    [],
    "Manifest.delivery",
  );
  exactString(delivery, "guarantee", "at_least_once", "Manifest.delivery");
  exactString(
    delivery,
    "checkpoint_commit",
    "after_all_items_converge",
    "Manifest.delivery",
  );
  exactString(delivery, "conflict", "fail_closed", "Manifest.delivery");
  exactString(
    delivery,
    "empty_page_cursor_advance",
    "fail_closed",
    "Manifest.delivery",
  );
  const bootstrap = objectMember(root, "bootstrap", "Manifest");
  assertExactKeys(
    bootstrap,
    ["mode", "broad_backfill"],
    [],
    "Manifest.bootstrap",
  );
  exactString(bootstrap, "mode", "activation_forward", "Manifest.bootstrap");
  if (asBoolean(bootstrap.broad_backfill, "broad_backfill")) {
    fail("Manifest.bootstrap.broad_backfill must be false");
  }
  const checkpoint = objectMember(root, "checkpoint", "Manifest");
  assertExactKeys(
    checkpoint,
    ["strategy", "cursor_ownership"],
    [],
    "Manifest.checkpoint",
  );
  enumString(
    checkpoint,
    "strategy",
    ["opaque_cursor", "litellm_start_time_boundary_v1"],
    "Manifest.checkpoint",
  );
  exactString(
    checkpoint,
    "cursor_ownership",
    "connector_state_only",
    "Manifest.checkpoint",
  );
  const coverage = objectMember(root, "coverage", "Manifest");
  assertExactKeys(
    coverage,
    ["included", "excluded"],
    [],
    "Manifest.coverage",
  );
  validateStringArray(
    coverage,
    "included",
    240,
    false,
    "Manifest.coverage",
  );
  validateStringArray(
    coverage,
    "excluded",
    240,
    false,
    "Manifest.coverage",
  );
  const instanceBinding = objectMember(root, "instance_binding", "Manifest");
  assertExactKeys(
    instanceBinding,
    ["source_field", "envelope_field", "comparison", "change_semantics"],
    [],
    "Manifest.instance_binding",
  );
  exactString(
    instanceBinding,
    "source_field",
    "source_instance",
    "Manifest.instance_binding",
  );
  exactString(
    instanceBinding,
    "envelope_field",
    "producer.instance",
    "Manifest.instance_binding",
  );
  exactString(
    instanceBinding,
    "comparison",
    "exact_utf8_bytes",
    "Manifest.instance_binding",
  );
  exactString(
    instanceBinding,
    "change_semantics",
    "new_connector_instance_identity_domain",
    "Manifest.instance_binding",
  );
  const payloadPolicy = objectMember(root, "payload_policy", "Manifest");
  assertExactKeys(
    payloadPolicy,
    ["ingestion_capture_mode", "payload_capture_mode", "raw_payload_present"],
    [],
    "Manifest.payload_policy",
  );
  exactString(
    payloadPolicy,
    "ingestion_capture_mode",
    "api_import",
    "Manifest.payload_policy",
  );
  exactString(
    payloadPolicy,
    "payload_capture_mode",
    "metadata_only",
    "Manifest.payload_policy",
  );
  if (asBoolean(payloadPolicy.raw_payload_present, "raw_payload_present")) {
    fail("Manifest.payload_policy.raw_payload_present must be false");
  }
  validateStringArray(
    root,
    "required_capabilities",
    128,
    true,
    "Manifest",
  );
  const gaps = asArray(
    root.declared_capture_gaps,
    "Manifest.declared_capture_gaps",
  );
  if (gaps.length === 0) {
    fail("Manifest.declared_capture_gaps must not be empty");
  }
  const seenGaps = new Set<string>();
  for (const [index, item] of gaps.entries()) {
    const gap = asObject(item, `Manifest.declared_capture_gaps[${index}]`);
    assertExactKeys(
      gap,
      ["affected_claim", "reason_code"],
      [],
      `Manifest.declared_capture_gaps[${index}]`,
    );
    const claim = boundedString(
      gap,
      "affected_claim",
      1,
      128,
      `Manifest.declared_capture_gaps[${index}]`,
    );
    const reason = boundedString(
      gap,
      "reason_code",
      1,
      128,
      `Manifest.declared_capture_gaps[${index}]`,
    );
    const identity = `${claim}\u0000${reason}`;
    if (seenGaps.has(identity)) {
      fail("Manifest.declared_capture_gaps must be unique");
    }
    seenGaps.add(identity);
  }
  const compatibility = objectMember(root, "compatibility", "Manifest");
  assertExactKeys(
    compatibility,
    [
      "reference_profile",
      "reference_projection_contract",
      "reference_compatibility_vector_bundle",
      "source_revision",
      "timeline_complete",
      "retention",
    ],
    [],
    "Manifest.compatibility",
  );
  exactString(
    compatibility,
    "source_revision",
    "1",
    "Manifest.compatibility",
  );
  exactString(compatibility, "retention", "7d", "Manifest.compatibility");
  if (!asBoolean(compatibility.timeline_complete, "timeline_complete")) {
    fail("Manifest.compatibility.timeline_complete must be true");
  }
  boundedString(
    compatibility,
    "reference_profile",
    1,
    200,
    "Manifest.compatibility",
  );
  for (
    const key of [
      "reference_projection_contract",
      "reference_compatibility_vector_bundle",
    ]
  ) {
    const component = objectMember(
      compatibility,
      key,
      "Manifest.compatibility",
    );
    assertExactKeys(
      component,
      ["path", "sha256"],
      [],
      `Manifest.compatibility.${key}`,
    );
    patternedString(
      component,
      "path",
      /^[A-Za-z0-9._/-]+$/,
      240,
      `Manifest.compatibility.${key}`,
    );
    shaString(component, "sha256", `Manifest.compatibility.${key}`);
  }
}

function validateSourceRelease(root: JsonObject): void {
  assertExactKeys(
    root,
    ["version", "git_commit", "image", "platform_manifests", "signature"],
    [],
    "Manifest.source_release",
  );
  boundedString(root, "version", 1, 80, "Manifest.source_release");
  patternedString(
    root,
    "git_commit",
    /^[0-9a-f]{40}$/,
    40,
    "Manifest.source_release",
  );
  const image = objectMember(root, "image", "Manifest.source_release");
  assertExactKeys(
    image,
    ["repository", "index_digest"],
    [],
    "Manifest.source_release.image",
  );
  patternedString(
    image,
    "repository",
    /^[a-z0-9.-]+(\/[a-z0-9._-]+)+$/,
    200,
    "Manifest.source_release.image",
  );
  shaString(image, "index_digest", "Manifest.source_release.image");
  const platforms = objectMember(
    root,
    "platform_manifests",
    "Manifest.source_release",
  );
  assertExactKeys(
    platforms,
    ["linux_amd64", "linux_arm64"],
    [],
    "Manifest.source_release.platform_manifests",
  );
  shaString(
    platforms,
    "linux_amd64",
    "Manifest.source_release.platform_manifests",
  );
  shaString(
    platforms,
    "linux_arm64",
    "Manifest.source_release.platform_manifests",
  );
  const signature = objectMember(
    root,
    "signature",
    "Manifest.source_release",
  );
  assertExactKeys(
    signature,
    ["scheme", "public_key_sha256", "verified_index_digest"],
    [],
    "Manifest.source_release.signature",
  );
  exactString(
    signature,
    "scheme",
    "cosign-key-v1",
    "Manifest.source_release.signature",
  );
  shaString(
    signature,
    "public_key_sha256",
    "Manifest.source_release.signature",
  );
  shaString(
    signature,
    "verified_index_digest",
    "Manifest.source_release.signature",
  );
}

function validateStringArray(
  root: JsonObject,
  key: string,
  maximum: number,
  unique: boolean,
  path: string,
): void {
  const items = asArray(root[key], `${path}.${key}`);
  if (items.length === 0) {
    fail(`${path}.${key} must not be empty`);
  }
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const value = asString(item, `${path}.${key}[${index}]`);
    const length = Array.from(value).length;
    if (length === 0 || length > maximum) {
      fail(`${path}.${key}[${index}] has invalid length`);
    }
    if (unique && seen.has(value)) {
      fail(`${path}.${key} must contain unique values`);
    }
    seen.add(value);
  }
}

function objectMember(
  root: JsonObject,
  key: string,
  path: string,
): JsonObject {
  return asObject(root[key], `${path}.${key}`);
}

function boundedString(
  root: JsonObject,
  key: string,
  minimum: number,
  maximum: number,
  path: string,
  rejectControls = false,
): string {
  const value = asString(root[key], `${path}.${key}`);
  const length = Array.from(value).length;
  if (length < minimum || length > maximum) {
    fail(`${path}.${key} must contain ${minimum}..${maximum} Unicode scalars`);
  }
  if (rejectControls && /\p{Cc}/u.test(value)) {
    fail(`${path}.${key} must not contain control characters`);
  }
  return value;
}

function patternedString(
  root: JsonObject,
  key: string,
  pattern: RegExp,
  maximum: number,
  path: string,
): string {
  const value = boundedString(root, key, 1, maximum, path);
  if (!isNfc(value) || !pattern.test(value)) {
    fail(`${path}.${key} does not match the protocol-controlled format`);
  }
  return value;
}

function enumString(
  root: JsonObject,
  key: string,
  allowed: readonly string[],
  path: string,
): string {
  return enumValue(root[key], allowed, `${path}.${key}`);
}

function enumValue(
  value: JsonValue | undefined,
  allowed: readonly string[],
  path: string,
): string {
  const text = asString(value, path);
  if (!allowed.includes(text)) {
    fail(`${path} contains an unsupported enum value`);
  }
  return text;
}

function exactString(
  root: JsonObject,
  key: string,
  expected: string,
  path: string,
): void {
  if (asString(root[key], `${path}.${key}`) !== expected) {
    fail(`${path}.${key} must equal ${expected}`);
  }
}

function exactMicroTime(
  root: JsonObject,
  key: string,
  path: string,
): string {
  const value = boundedString(root, key, 27, 27, path);
  const normalized = normalizeMicrosecondTimestamp(value);
  if (!MICRO_TIME.test(value) || normalized.normalized !== value) {
    fail(`${path}.${key} must be a valid exact UTC microsecond timestamp`);
  }
  return value;
}

function shaString(root: JsonObject, key: string, path: string): string {
  const value = boundedString(root, key, 71, 71, path);
  if (!SHA.test(value)) {
    fail(`${path}.${key} must be a lowercase sha256 reference`);
  }
  return value;
}

function boundedInteger(
  value: JsonValue | undefined,
  minimum: number,
  maximum: number,
  path: string,
): number {
  const integer = asInteger(value, path);
  if (integer < BigInt(minimum) || integer > BigInt(maximum)) {
    fail(`${path} is out of range`);
  }
  return Number(integer);
}

function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cloneJson);
  }
  const result: JsonObject = Object.create(null) as JsonObject;
  for (const [key, item] of Object.entries(value)) {
    result[key] = cloneJson(item);
  }
  return result;
}

function fail(message: string): never {
  throw new StrictJsonError("invalid_protocol_object", message);
}
