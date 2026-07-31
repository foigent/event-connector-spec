import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  asArray,
  asBoolean,
  asObject,
  asSafeInteger,
  asString,
  canonicalBytes,
  decodeUtf8,
  equalBytes,
  JsonObject,
  JsonValue,
  parseStrictJson,
  parseStrictJsonBytes,
  sha256,
  StrictJsonError,
  toBase64,
  toHex,
} from "./json.ts";
import {
  buildIdempotencyInput,
  normalizeMicrosecondTimestamp,
  opaqueUtf8,
  protocolControlledNfc,
  validInt64Decimal,
} from "./protocol.ts";

const EXPECTED_BUNDLE_SHA =
  "sha256:cbbcc45af8f2c5b0b12bb23e1094953661c352a1b506233c85405be47baf075f";
const EXPECTED_CONTRACT_SHA =
  "sha256:f11d263a7d2b8e98240a9a9750f349d83c1f8a12263682a49601b74eb7e891d2";
const EXPECTED_BUNDLE_VERSION = "foigent.source-neutral-vector-bundle.v2";
const EXPECTED_PROTOCOL = "2.0.0";
const REPORT_VERSION = "foigent.conformance-report.v1";
const IMPLEMENTATION = "typescript";
const IMPLEMENTATION_VERSION = "2.0.0-rc.1+independent.1";

const REQUIRED_CLASSES = [
  "bounded_offline_receipt",
  "canonical_envelope",
  "capture_gap_derivation",
  "capture_mode_separation",
  "checkpoint_applicability",
  "content_conflict",
  "decimal_boundary",
  "delivery_acknowledgement",
  "delivery_completeness",
  "duplicate_key_rejection",
  "duplicate_noop",
  "manifest_mode_union",
  "mode_state_separation",
  "mutable_delivery_exclusion",
  "opaque_utf8_preservation",
  "partial_batch_rejection",
  "privacy_rejection",
  "protocol_nfc_rejection",
  "scoped_idempotency",
  "source_sanitization",
  "timeline_completeness",
  "timestamp_normalization",
  "v1_pull_compatibility",
] as const;

export class ArtifactFailure extends Error {
  override name = "ArtifactFailure";
}

interface Observation {
  id: string;
  classes: string[];
  kind: string;
  result: Uint8Array;
  failures: string[];
}

export interface SourceNeutralRun {
  report: JsonObject;
  reportBytes: Uint8Array;
  status: "pass" | "fail";
  caseCount: number;
}

export async function createSourceNeutralReport(
  bundlePath: string,
): Promise<SourceNeutralRun> {
  const absoluteBundle = resolve(bundlePath);
  const bundleBytes = await Deno.readFile(absoluteBundle);
  if (sha256(bundleBytes) !== EXPECTED_BUNDLE_SHA) {
    throw new ArtifactFailure("bundle digest mismatch");
  }
  const bundle = asObject(
    parseStrictJsonBytes(bundleBytes),
    "source-neutral vector bundle",
  );
  if (
    asString(bundle.bundle_version, "bundle_version") !==
      EXPECTED_BUNDLE_VERSION ||
    asString(bundle.protocol_version, "protocol_version") !==
      EXPECTED_PROTOCOL ||
    asString(bundle.protocol_status, "protocol_status") !== "not_binding"
  ) {
    throw new ArtifactFailure("bundle identity mismatch");
  }
  const root = resolve(dirname(absoluteBundle), "..");
  const contract = asObject(
    bundle.conformance_contract,
    "conformance_contract",
  );
  const contractPath = asString(contract.path, "conformance_contract.path");
  const contractSHA = asString(
    contract.sha256,
    "conformance_contract.sha256",
  );
  if (contractSHA !== EXPECTED_CONTRACT_SHA) {
    throw new ArtifactFailure("contract identity mismatch");
  }
  const contractBytes = await readWithin(root, contractPath);
  if (sha256(contractBytes) !== contractSHA) {
    throw new ArtifactFailure("contract digest mismatch");
  }

  const observations: Observation[] = [];
  const context = asObject(bundle.mapping_context, "mapping_context");
  for (
    const value of asArray(
      bundle.openinference_mapping,
      "openinference_mapping",
    )
  ) {
    observations.push(
      await runMapping(root, context, asObject(value, "mapping case")),
    );
  }
  for (const value of asArray(bundle.idempotency, "idempotency")) {
    observations.push(runIdempotency(asObject(value, "idempotency case")));
  }
  for (
    const [section, classifier] of [
      ["manifest_semantics", classifyManifest],
      ["lifecycle", classifyLifecycle],
      ["delivery", classifyDelivery],
      ["completeness", classifyCompleteness],
      ["capture_modes", classifyCaptureModes],
    ] as const
  ) {
    for (const value of asArray(bundle[section], section)) {
      const item = asObject(value, `${section} case`);
      observations.push(
        runGeneric(
          section,
          item,
          classifier(asObject(item.input, `${section}.input`)),
        ),
      );
    }
  }
  for (
    const value of asArray(bundle.mutable_delivery, "mutable_delivery")
  ) {
    observations.push(
      await runMutableDelivery(
        root,
        asObject(value, "mutable delivery case"),
      ),
    );
  }
  for (
    const value of asArray(bundle.v1_compatibility, "v1_compatibility")
  ) {
    observations.push(
      await runV1Compatibility(
        root,
        asObject(value, "v1 compatibility case"),
      ),
    );
  }
  for (const value of asArray(bundle.negative, "negative")) {
    observations.push(runNegative(asObject(value, "negative case")));
  }

  const report = buildReport(observations);
  const reportBytes = canonicalBytes(report);
  const status = asString(report.status, "report.status") as "pass" | "fail";
  return {
    report,
    reportBytes,
    status,
    caseCount: observations.length,
  };
}

async function runMapping(
  root: string,
  context: JsonObject,
  item: JsonObject,
): Promise<Observation> {
  const observation = baseObservation("openinference_mapping", item);
  try {
    const raw = await readPinned(
      root,
      asString(item.raw_input_path, "raw_input_path"),
      asString(item.raw_file_sha256, "raw_file_sha256"),
    );
    const sourceFixture = await readPinned(
      root,
      asString(item.source_input_path, "source_input_path"),
      asString(item.source_file_sha256, "source_file_sha256"),
    );
    const hashInputFixture = await readPinned(
      root,
      asString(item.hash_input_path, "hash_input_path"),
      asString(item.hash_input_file_sha256, "hash_input_file_sha256"),
    );
    const source = sanitizeOTLP(raw);
    const sourceBytes = canonicalBytes(source);
    const fixtureBytes = canonicalBytes(
      parseStrictJsonBytes(sourceFixture),
    );
    if (!equalBytes(sourceBytes, fixtureBytes)) {
      observation.failures.push("sanitized Source mismatch");
    }
    if (
      sha256(sourceBytes) !==
        asString(item.canonical_source_sha256, "canonical_source_sha256")
    ) {
      observation.failures.push("Source hash mismatch");
    }
    if (decodeUtf8(sourceBytes).includes("MUST_NOT_SURVIVE_SANITIZATION")) {
      observation.failures.push("raw payload survived");
    }
    const mapped = mapSourceToEnvelope(source, context);
    const result = canonicalBytes(mapped.hashInput);
    const expected = canonicalBytes(
      parseStrictJsonBytes(hashInputFixture),
    );
    if (!equalBytes(result, expected)) {
      observation.failures.push("Envelope hash input mismatch");
    }
    if (
      result.length !== asSafeInteger(item.canonical_bytes, "canonical_bytes")
    ) {
      observation.failures.push("canonical byte count mismatch");
    }
    if (sha256(result) !== asString(item.envelope_hash, "envelope_hash")) {
      observation.failures.push("Envelope hash mismatch");
    }
    if (
      sha256(mapped.identityInput) !==
        asString(item.idempotency_key, "idempotency_key")
    ) {
      observation.failures.push("idempotency mismatch");
    }
    const payload = asObject(mapped.hashInput.payload, "payload");
    if (
      asArray(payload.capture_gaps, "capture_gaps").length !==
        asSafeInteger(item.capture_gap_count, "capture_gap_count")
    ) {
      observation.failures.push("Capture Gap count mismatch");
    }
    observation.result = result;
  } catch (error) {
    observation.failures.push(message(error));
  }
  return observation;
}

function runIdempotency(item: JsonObject): Observation {
  const observation = baseObservation("idempotency", item);
  try {
    const components = asArray(item.components, "components");
    if (components.length !== 7) {
      throw new Error("identity component count");
    }
    const input = buildIdempotencyInput({
      producerProduct: asString(components[0], "producer product"),
      producerInstance: asString(components[1], "producer instance"),
      tenantRef: components[2] === null ? null : asString(components[2], "tenant ref"),
      orgRef: asString(components[3], "org ref"),
      projectRef: asString(components[4], "project ref"),
      eventType: asString(components[5], "event type"),
      eventId: asString(components[6], "event id"),
    });
    if (toHex(input) !== asString(item.identity_input_hex, "identity hex")) {
      observation.failures.push("identity bytes mismatch");
    }
    if (sha256(input) !== asString(item.idempotency_key, "idempotency key")) {
      observation.failures.push("idempotency digest mismatch");
    }
    observation.result = input;
  } catch (error) {
    observation.failures.push(message(error));
  }
  return observation;
}

function runGeneric(
  section: string,
  item: JsonObject,
  observed: JsonObject,
): Observation {
  const observation = baseObservation(section, item);
  const result = canonicalBytes(observed);
  const expected = canonicalBytes(asObject(item.expected, "expected"));
  if (!equalBytes(result, expected)) {
    observation.failures.push("classification mismatch");
  }
  observation.result = result;
  return observation;
}

async function runMutableDelivery(
  root: string,
  item: JsonObject,
): Promise<Observation> {
  const observation = baseObservation("mutable_delivery", item);
  try {
    const raw = await readWithin(
      root,
      asString(item.hash_input_path, "hash_input_path"),
    );
    const hashInput = asObject(parseStrictJsonBytes(raw), "hash input");
    const identity = asObject(hashInput.identity, "identity");
    const observed: JsonObject = {
      envelope_hash: sha256(canonicalBytes(hashInput)),
      idempotency_key: asString(
        identity.idempotency_key,
        "idempotency_key",
      ),
      unchanged: asArray(item.variants, "variants").length === 3,
    };
    const result = canonicalBytes(observed);
    const expected = canonicalBytes(asObject(item.expected, "expected"));
    if (!equalBytes(result, expected)) {
      observation.failures.push("delivery exclusion mismatch");
    }
    observation.result = result;
  } catch (error) {
    observation.failures.push(message(error));
  }
  return observation;
}

async function runV1Compatibility(
  root: string,
  item: JsonObject,
): Promise<Observation> {
  const observation = baseObservation("v1_compatibility", item);
  try {
    const raw = await readWithin(
      root,
      asString(item.manifest_path, "manifest_path"),
    );
    const manifest = asObject(parseStrictJsonBytes(raw), "v1 manifest");
    const transport = asObject(manifest.transport, "transport");
    const compatibility = asObject(
      manifest.compatibility,
      "compatibility",
    );
    if (compatibility.timeline_complete !== true) {
      observation.failures.push("v1 timeline is not complete");
    }
    const observed: JsonObject = {
      checkpoint: "required",
      delivery_scope: "poll_page",
      execution_timeline: "complete",
      ingestion_capture_mode: "api_pull_import",
      original_manifest_version: asString(
        manifest.manifest_version,
        "manifest_version",
      ),
      projected_mode: asString(transport.mode, "transport.mode"),
    };
    const result = canonicalBytes(observed);
    const expected = canonicalBytes(asObject(item.expected, "expected"));
    if (!equalBytes(result, expected)) {
      observation.failures.push("v1 projection mismatch");
    }
    observation.result = result;
  } catch (error) {
    observation.failures.push(message(error));
  }
  return observation;
}

function runNegative(item: JsonObject): Observation {
  const observation = baseObservation("negative", item);
  let observed: JsonObject;
  const kind = asString(item.kind, "negative kind");
  switch (kind) {
    case "strict_json": {
      try {
        parseStrictJson(asString(item.input, "strict JSON input"));
        observed = { valid: true };
      } catch (error) {
        if (
          error instanceof StrictJsonError &&
          error.code === "duplicate_json_key"
        ) {
          observed = { error_code: "duplicate_json_key", valid: false };
        } else {
          observed = { valid: false };
        }
      }
      break;
    }
    case "privacy": {
      const input = asObject(item.input, "privacy input");
      observed = Object.hasOwn(input, "input_value")
        ? { error_code: "raw_payload_forbidden", valid: false }
        : { valid: true };
      break;
    }
    case "decimal": {
      const value = asString(item.input, "decimal input");
      observed = { valid: validInt64Decimal(value), value };
      break;
    }
    case "timestamp": {
      const value = asString(item.input, "timestamp input");
      const result = normalizeMicrosecondTimestamp(value);
      observed = result.valid
        ? { normalized: result.normalized!, valid: true }
        : { error_code: result.error_code!, valid: false };
      break;
    }
    case "protocol_unicode": {
      observed = {
        valid: protocolControlledNfc(
          asString(item.input, "protocol Unicode input"),
        ),
      };
      break;
    }
    case "opaque_unicode": {
      const bytes = opaqueUtf8(asString(item.input, "opaque Unicode input"));
      observed = { utf8_hex: toHex(bytes), valid: true };
      break;
    }
    default:
      observed = { error_code: "unknown_negative_kind", valid: false };
  }
  const result = canonicalBytes(observed);
  const expected = canonicalBytes(asObject(item.expected, "expected"));
  if (!equalBytes(result, expected)) {
    observation.failures.push("negative classification mismatch");
  }
  observation.result = result;
  return observation;
}

function classifyManifest(input: JsonObject): JsonObject {
  const mode = asString(input.transport, "transport");
  if (asString(input.delivery, "delivery") !== mode) {
    return invalid("mode_axis_mismatch");
  }
  const rules: Record<string, {
    activation: string;
    checkpoint: string;
    capture: string;
    scope: string;
  }> = {
    https_pull: {
      activation: "activation_forward",
      checkpoint: "required",
      capture: "api_pull_import",
      scope: "poll_page",
    },
    otlp_http_push: {
      activation: "receiver_activation_forward",
      checkpoint: "not_applicable",
      capture: "otlp_http_receive",
      scope: "accepted_request",
    },
    bounded_offline: {
      activation: "explicit_bounded_import",
      checkpoint: "not_applicable",
      capture: "bounded_offline_import",
      scope: "bounded_bundle",
    },
  };
  const rule = rules[mode];
  if (rule === undefined) {
    return invalid("mode_axis_mismatch");
  }
  if (asString(input.checkpoint, "checkpoint") !== rule.checkpoint) {
    return invalid(
      mode === "https_pull" ? "mode_axis_mismatch" : "checkpoint_not_applicable",
    );
  }
  if (
    asString(input.partial_acceptance, "partial_acceptance") !==
      "reject_batch"
  ) {
    return invalid("partial_acceptance_forbidden");
  }
  if (
    asString(input.activation, "activation") !== rule.activation ||
    asString(input.ingestion_capture_mode, "capture mode") !== rule.capture ||
    asString(input.delivery_scope, "delivery scope") !== rule.scope
  ) {
    return invalid("mode_axis_mismatch");
  }
  return { checkpoint: rule.checkpoint, mode, valid: true };
}

function classifyLifecycle(input: JsonObject): JsonObject {
  const mode = asString(input.delivery_mode, "delivery_mode");
  const checkpoint = asString(input.checkpoint, "checkpoint");
  if (mode !== "https_pull" && checkpoint !== "not_applicable") {
    return invalid("checkpoint_not_applicable");
  }
  if (mode === "https_pull" && checkpoint !== "required") {
    return invalid("checkpoint_required");
  }
  const allowed: Record<string, Set<string>> = {
    https_pull: new Set([
      "inactive",
      "idle",
      "polling",
      "committing",
      "backoff",
      "stopping",
      "error",
    ]),
    otlp_http_push: new Set([
      "inactive",
      "idle",
      "receiving",
      "committing",
      "backoff",
      "stopping",
      "error",
    ]),
    bounded_offline: new Set([
      "inactive",
      "idle",
      "importing",
      "committing",
      "stopping",
      "error",
    ]),
  };
  if (
    !allowed[mode]?.has(asString(input.processing, "processing"))
  ) {
    return invalid("processing_mode_mismatch");
  }
  return {
    checkpoint_state: mode === "https_pull"
      ? asString(input.checkpoint_state, "checkpoint_state")
      : "not_applicable",
    valid: true,
  };
}

function classifyDelivery(input: JsonObject): JsonObject {
  const mode = asString(input.mode, "mode");
  const relation = asString(input.relation, "relation");
  let converged = asBoolean(input.all_items_converged, "converged");
  let outcome = "inserted";
  if (relation === "same_identity_different_hash") {
    outcome = "conflict";
    converged = false;
  } else if (!converged) {
    outcome = "retry_batch";
  } else if (relation === "same_identity_same_hash") {
    outcome = "duplicate_noop";
  }
  let acknowledgement = "not_applicable";
  let checkpointCommitted = false;
  let receiptCompleted = false;
  if (mode === "https_pull") {
    checkpointCommitted = converged;
  } else if (mode === "otlp_http_push") {
    acknowledgement = converged ? "durable" : "withheld";
  } else if (mode === "bounded_offline") {
    receiptCompleted = converged;
  }
  return {
    acknowledgement,
    checkpoint_committed: checkpointCommitted,
    outcome,
    receipt_completed: receiptCompleted,
  };
}

function classifyCompleteness(input: JsonObject): JsonObject {
  if (
    !asBoolean(input.delivery_scope_complete, "delivery_scope_complete")
  ) {
    return invalid("partial_delivery_scope_forbidden");
  }
  const timeline = asString(input.execution_timeline, "execution_timeline");
  if (!["complete", "partial", "not_asserted"].includes(timeline)) {
    return invalid("timeline_claim_invalid");
  }
  return {
    delivery_complete: true,
    timeline_claim: timeline,
    valid: true,
  };
}

function classifyCaptureModes(input: JsonObject): JsonObject {
  const ingestion = asString(
    input.ingestion_capture_mode,
    "ingestion_capture_mode",
  );
  if (
    ![
      "api_pull_import",
      "otlp_http_receive",
      "bounded_offline_import",
    ].includes(ingestion)
  ) {
    return invalid("ingestion_capture_mode_invalid");
  }
  return {
    ingestion_capture_mode: ingestion,
    payload_capture_mode: asString(
      input.payload_capture_mode,
      "payload_capture_mode",
    ),
    valid: true,
  };
}

function invalid(errorCode: string): JsonObject {
  return { error_code: errorCode, valid: false };
}

function sanitizeOTLP(raw: Uint8Array): JsonObject {
  const document = asObject(parseStrictJsonBytes(raw), "OTLP export");
  const resourceSpans = asArray(document.resourceSpans, "resourceSpans");
  if (resourceSpans.length !== 1) {
    throw new Error("unexpected bounded OTLP shape");
  }
  const resourceGroup = asObject(resourceSpans[0], "resourceSpans[0]");
  const resource = asObject(resourceGroup.resource, "resource");
  const resourceAttributes = attributes(
    asArray(resource.attributes, "resource attributes"),
  );
  const scopeSpans = asArray(resourceGroup.scopeSpans, "scopeSpans");
  if (scopeSpans.length !== 1) {
    throw new Error("unexpected bounded OTLP scope");
  }
  const spans = asArray(
    asObject(scopeSpans[0], "scopeSpans[0]").spans,
    "spans",
  );
  if (spans.length !== 1) {
    throw new Error("unexpected bounded OTLP span count");
  }
  const span = asObject(spans[0], "span");
  const spanAttributes = attributes(asArray(span.attributes, "attributes"));
  if (spanAttributes.get("openinference.span.kind") !== "LLM") {
    throw new Error("fixture is not an OpenInference LLM span");
  }
  const prompt = requiredAttribute(
    spanAttributes,
    "llm.token_count.prompt",
  );
  const completion = requiredAttribute(
    spanAttributes,
    "llm.token_count.completion",
  );
  const total = requiredAttribute(spanAttributes, "llm.token_count.total");
  if (
    !validInt64Decimal(prompt) ||
    !validInt64Decimal(completion) ||
    !validInt64Decimal(total) ||
    BigInt(prompt) + BigInt(completion) !== BigInt(total)
  ) {
    throw new Error("token counters are invalid");
  }
  const status = asObject(span.status, "span.status");
  const code = asString(status.code, "span.status.code");
  return {
    schema_version: "xinsight.otlp-openinference-span.v1",
    trace_id: asString(span.traceId, "traceId").toLowerCase(),
    span_id: asString(span.spanId, "spanId").toLowerCase(),
    session_id: requiredAttribute(spanAttributes, "session.id"),
    span_name: asString(span.name, "span.name"),
    span_kind: "LLM",
    start_time: unixNanoToMicrosecond(
      asString(span.startTimeUnixNano, "startTimeUnixNano"),
    ),
    end_time: unixNanoToMicrosecond(
      asString(span.endTimeUnixNano, "endTimeUnixNano"),
    ),
    status: code === "STATUS_CODE_ERROR" ? "failed" : "succeeded",
    model: requiredAttribute(spanAttributes, "llm.model_name"),
    provider: requiredAttribute(spanAttributes, "llm.provider"),
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    actor_ref: requiredAttribute(spanAttributes, "user.id"),
    service_name: requiredAttribute(resourceAttributes, "service.name"),
    missing_parent: false,
  };
}

function attributes(values: JsonValue[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of values) {
    const attribute = asObject(value, "attribute");
    const key = asString(attribute.key, "attribute.key");
    if (result.has(key)) {
      throw new Error("duplicate OTLP attribute");
    }
    const raw = asObject(attribute.value, "attribute.value");
    const stringValue = raw.stringValue;
    const intValue = raw.intValue;
    if (typeof stringValue === "string" && intValue === undefined) {
      result.set(key, stringValue);
    } else if (stringValue === undefined && typeof intValue === "string") {
      if (!validInt64Decimal(intValue)) {
        throw new Error("OTLP int attribute is invalid");
      }
      result.set(key, intValue);
    } else if (stringValue !== undefined || intValue !== undefined) {
      throw new Error("OTLP AnyValue has multiple scalar values");
    }
  }
  return result;
}

function requiredAttribute(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined) {
    throw new Error(`required attribute ${key} is absent`);
  }
  return value;
}

function unixNanoToMicrosecond(value: string): string {
  if (!validInt64Decimal(value)) {
    throw new Error("timestamp is outside canonical int64");
  }
  const nanos = BigInt(value);
  if (nanos % 1000n !== 0n) {
    throw new Error("timestamp_precision_loss");
  }
  const seconds = nanos / 1_000_000_000n;
  const remainder = nanos % 1_000_000_000n;
  const millis = Number(seconds * 1000n + remainder / 1_000_000n);
  const base = new Date(millis).toISOString().slice(0, 19);
  const micros = (remainder / 1000n).toString().padStart(6, "0");
  return `${base}.${micros}Z`;
}

function mapSourceToEnvelope(
  source: JsonObject,
  context: JsonObject,
): { hashInput: JsonObject; identityInput: Uint8Array } {
  const traceID = asString(source.trace_id, "trace_id");
  const spanID = asString(source.span_id, "span_id");
  const eventID = `${traceID}:${spanID}`;
  const identityInput = buildIdempotencyInput({
    producerProduct: asString(
      context.producer_product,
      "producer_product",
    ),
    producerInstance: asString(
      context.producer_instance,
      "producer_instance",
    ),
    tenantRef: context.tenant_ref === null
      ? null
      : asString(context.tenant_ref, "tenant_ref"),
    orgRef: asString(context.org_ref, "org_ref"),
    projectRef: asString(context.project_ref, "project_ref"),
    eventType: "observability.span.completed",
    eventId: eventID,
  });
  const gaps = [
    "billing_authority",
    "business_outcome",
    "downstream_side_effects",
    "routing_decision",
  ].map((claim): JsonObject => ({
    affected_claim: claim,
    gap_type: "not_available_from_source",
    reason_code: "not_exposed_by_openinference_span_v1",
    severity: "warning",
  }));
  const endTime = asString(source.end_time, "end_time");
  const hashInput: JsonObject = {
    spec_version: "foigent.event-envelope.v1",
    event_id: eventID,
    event_type: "observability.span.completed",
    schema_ref: "foigent://events/observability/openinference-span-completed/v1",
    schema_version: "1",
    producer: {
      product: asString(context.producer_product, "producer_product"),
      instance: asString(context.producer_instance, "producer_instance"),
      connector_id: asString(context.connector_id, "connector_id"),
      connector_version: asString(
        context.connector_version,
        "connector_version",
      ),
    },
    scope: {
      org_ref: asString(context.org_ref, "org_ref"),
      project_ref: asString(context.project_ref, "project_ref"),
    },
    subject: { type: "span", ref: spanID },
    actor: {
      type: "user",
      ref: asString(source.actor_ref, "actor_ref"),
    },
    time: { occurred_at: endTime, terminal_at: endTime },
    correlation: {
      request_ref: eventID,
      trace_ref: traceID,
      span_ref: spanID,
    },
    identity: {
      idempotency_key: sha256(identityInput),
      source_revision: "1",
    },
    integrity: { source_hash: sha256(canonicalBytes(source)) },
    data_policy: {
      payload_capture_mode: "metadata_only",
      raw_payload_present: false,
      redaction_profile: "openinference.metadata-allowlist.v1",
    },
    provenance: {
      adapter_fidelity: "F2",
      field_groups: {
        actor: "direct",
        correlation: "direct",
        data_policy: "declared",
        identity: "derived",
        "payload.capture_gaps": "derived",
        "payload.model": "direct",
        "payload.span": "direct",
        "payload.timeline_complete": "declared",
        "payload.trace": "direct",
        "payload.usage": "direct",
        scope: "declared",
        subject: "derived",
        "time.occurred_at": "derived",
        "time.terminal_at": "direct",
      },
    },
    payload: {
      terminal: { status: asString(source.status, "status") },
      span: {
        kind: asString(source.span_kind, "span_kind"),
        name: asString(source.span_name, "span_name"),
      },
      trace: {
        trace_id: traceID,
        span_id: spanID,
        session_id: asString(source.session_id, "session_id"),
      },
      model: {
        name: asString(source.model, "model"),
        provider: asString(source.provider, "provider"),
      },
      usage: {
        prompt_tokens: asString(source.prompt_tokens, "prompt_tokens"),
        completion_tokens: asString(
          source.completion_tokens,
          "completion_tokens",
        ),
        total_tokens: asString(source.total_tokens, "total_tokens"),
      },
      service: { name: asString(source.service_name, "service_name") },
      timeline_complete: false,
      capture_gaps: gaps,
    },
  };
  return { hashInput, identityInput };
}

function buildReport(observations: Observation[]): JsonObject {
  const seen = new Set<string>();
  const coverage = new Set<string>();
  let status: "pass" | "fail" = "pass";
  const cases: JsonValue[] = [];
  for (const observation of observations) {
    if (seen.has(observation.id)) {
      throw new Error(`duplicate case id ${observation.id}`);
    }
    seen.add(observation.id);
    if (
      observation.classes.join("\u0000") !==
        [...observation.classes].sort().join("\u0000") ||
      new Set(observation.classes).size !== observation.classes.length
    ) {
      throw new Error(`${observation.id} classes are not sorted and unique`);
    }
    for (const value of observation.classes) {
      coverage.add(value);
    }
    const caseStatus = observation.failures.length === 0 ? "pass" : "fail";
    if (caseStatus === "fail") {
      status = "fail";
    }
    const item: JsonObject = {
      case_id: observation.id,
      case_classes: observation.classes,
      status: caseStatus,
      result_kind: observation.kind,
      result_base64: toBase64(observation.result),
      result_sha256: sha256(observation.result),
    };
    if (observation.failures.length > 0) {
      item.failure_message = observation.failures.join("; ").slice(0, 512);
    }
    cases.push(item);
  }
  if (
    coverage.size !== REQUIRED_CLASSES.length ||
    REQUIRED_CLASSES.some((value) => !coverage.has(value))
  ) {
    throw new Error("case class coverage differs from contract");
  }
  return {
    report_version: REPORT_VERSION,
    implementation: IMPLEMENTATION,
    implementation_version: IMPLEMENTATION_VERSION,
    bundle_sha256: EXPECTED_BUNDLE_SHA,
    status,
    cases,
  };
}

function baseObservation(section: string, item: JsonObject): Observation {
  return {
    id: `${section}/${asString(item.case_id, "case_id")}`,
    classes: asArray(item.case_classes, "case_classes").map((value) =>
      asString(value, "case class")
    ),
    kind: asString(item.result_kind, "result_kind"),
    result: new Uint8Array(),
    failures: [],
  };
}

async function readPinned(
  root: string,
  path: string,
  expected: string,
): Promise<Uint8Array> {
  const bytes = await readWithin(root, path);
  if (sha256(bytes) !== expected) {
    throw new ArtifactFailure(`${path} digest mismatch`);
  }
  return bytes;
}

async function readWithin(root: string, path: string): Promise<Uint8Array> {
  if (path.length === 0 || isAbsolute(path)) {
    throw new ArtifactFailure("artifact path must be relative");
  }
  const cleanRoot = resolve(root);
  const candidate = resolve(cleanRoot, path);
  const rel = relative(cleanRoot, candidate);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new ArtifactFailure("artifact path escapes root");
  }
  return await Deno.readFile(candidate);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "unknown failure";
}
