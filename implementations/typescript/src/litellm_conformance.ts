import { dirname, resolve, sep } from "node:path";
import {
  asArray,
  asBoolean,
  asObject,
  asSafeInteger,
  assertExactKeys,
  asString,
  canonicalBytes,
  equalBytes,
  JsonObject,
  JsonValue,
  parseStrictJsonBytes,
  sha256,
  toBase64,
  toHex,
} from "./json.ts";
import { buildIdempotencyInput } from "./protocol.ts";

const BUNDLE_SHA256 =
  "sha256:9997bcade1f65f613e2176266a35b43aef64547c3ed4ba87e61de94080803dc7";
const GOLDEN_SHA256 =
  "sha256:c7500da0cbbc045f47c2000dd824e403195f6ade2753b12c319418d3a7df939c";
const BUNDLE_VERSION = "foigent.litellm-connector-vector-bundle.v1";
const GOLDEN_VERSION = "foigent.litellm-golden-fixture-bundle.v1";
const PROTOCOL_VERSION = "1.1.2";
const CONNECTOR_ID = "foigent.litellm.spend-logs";

export class LiteLLMArtifactFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiteLLMArtifactFailure";
  }
}

interface Observation {
  id: string;
  classes: string[];
  kind: "bytes" | "classification" | "error" | "state_transition";
  result: Uint8Array;
  failures: string[];
}

interface Inputs {
  root: string;
  bundle: JsonObject;
  golden: JsonObject;
}

export async function createLiteLLMConformanceReport(
  bundlePath: string,
): Promise<{ report: JsonObject; reportBytes: Uint8Array; failures: string[] }> {
  const absolute = resolve(bundlePath);
  const root = dirname(dirname(absolute));
  const bundleBytes = await Deno.readFile(absolute);
  requireEqual(sha256(bundleBytes), BUNDLE_SHA256, "bundle digest");
  const bundle = asObject(
    parseStrictJsonBytes(bundleBytes),
    "LiteLLM vector bundle",
  );
  requireEqual(bundle.bundle_version, BUNDLE_VERSION, "bundle_version");
  requireEqual(bundle.protocol_version, PROTOCOL_VERSION, "protocol_version");

  const goldenRelative = asString(
    bundle.golden_fixture_bundle_path,
    "golden_fixture_bundle_path",
  );
  const goldenPath = resolveWithin(root, goldenRelative);
  const goldenBytes = await Deno.readFile(goldenPath);
  requireEqual(sha256(goldenBytes), GOLDEN_SHA256, "Golden digest");
  const golden = asObject(
    parseStrictJsonBytes(goldenBytes),
    "LiteLLM Golden bundle",
  );
  requireEqual(golden.bundle_version, GOLDEN_VERSION, "Golden bundle_version");
  requireEqual(golden.protocol_version, PROTOCOL_VERSION, "Golden protocol_version");
  requireEqual(golden.connector, CONNECTOR_ID, "Golden connector");

  const inputs: Inputs = { root, bundle, golden };
  const observations: Observation[] = [
    ...await canonicalCases(inputs),
    ...identityCases(inputs),
    ...decimalCases(inputs),
    ...cacheStatusCases(inputs),
    ...checkpointCases(inputs),
    ...replayCases(inputs),
    ...await negativeCases(inputs),
  ];
  const allFailures = observations.flatMap((item) =>
    item.failures.map((failure) => `${item.id}: ${failure}`)
  );
  const cases: JsonValue[] = observations.map((item) => {
    const status = item.failures.length === 0 ? "pass" : "fail";
    const result: JsonObject = {
      case_id: item.id,
      case_classes: item.classes,
      status,
      result_kind: item.kind,
      result_base64: toBase64(item.result),
      result_sha256: sha256(item.result),
    };
    if (item.failures.length > 0) {
      result.failure_message = bounded(item.failures.join("; "));
    }
    return result;
  });
  const report: JsonObject = {
    report_version: "foigent.conformance-report.v1",
    implementation: "typescript",
    implementation_version: "1.1.2+litellm.1",
    bundle_sha256: BUNDLE_SHA256,
    status: allFailures.length === 0 ? "pass" : "fail",
    cases,
  };
  if (cases.length !== 30) {
    throw new LiteLLMArtifactFailure(`expected 30 cases, got ${cases.length}`);
  }
  return { report, reportBytes: canonicalBytes(report), failures: allFailures };
}

async function canonicalCases(inputs: Inputs): Promise<Observation[]> {
  const goldenCases = new Map<string, JsonObject>();
  for (
    const value of asArray(inputs.golden.cases, "Golden cases")
  ) {
    const item = asObject(value, "Golden case");
    goldenCases.set(asString(item.case_id, "Golden case_id"), item);
  }
  const context = asObject(inputs.bundle.mapping_context, "mapping_context");
  const result: Observation[] = [];
  for (
    const value of asArray(
      inputs.bundle.canonical_envelopes,
      "canonical_envelopes",
    )
  ) {
    const vector = asObject(value, "canonical vector");
    const caseId = asString(vector.case_id, "canonical case_id");
    const observation: Observation = {
      id: `canonical_envelopes/${caseId}`,
      classes: ["canonical_envelope", "capture_gap_derivation"],
      kind: "bytes",
      result: new Uint8Array(),
      failures: [],
    };
    const golden = goldenCases.get(caseId);
    if (golden === undefined) {
      observation.failures.push("missing Golden case");
      result.push(observation);
      continue;
    }
    const sourcePath = asString(vector.source_input_path, "source_input_path");
    const sourceBytes = await Deno.readFile(resolveWithin(inputs.root, sourcePath));
    const sourceFixture = asObject(golden.source_fixture, "source_fixture");
    check(
      observation,
      sha256(sourceBytes) === asString(sourceFixture.sha256, "Source sha256"),
      "Source fixture digest mismatch",
    );
    let mapped: JsonObject;
    try {
      mapped = mapLiteLLMSource(sourceBytes, context);
    } catch (error) {
      observation.failures.push(
        error instanceof Error ? error.message : "Source mapping failed",
      );
      result.push(observation);
      continue;
    }
    const canonical = canonicalBytes(mapped);
    observation.result = canonical;
    const expectedPath = asString(vector.input_path, "input_path");
    const expected = canonicalBytes(
      asObject(
        parseStrictJsonBytes(
          await Deno.readFile(resolveWithin(inputs.root, expectedPath)),
        ),
        "Golden Envelope",
      ),
    );
    check(observation, equalBytes(canonical, expected), "mapped Envelope differs");
    check(
      observation,
      canonical.length === asSafeInteger(vector.canonical_bytes, "canonical_bytes"),
      "canonical byte length mismatch",
    );
    check(
      observation,
      sha256(canonical) === asString(vector.envelope_hash, "envelope_hash"),
      "Envelope hash mismatch",
    );
    result.push(observation);
  }
  return result;
}

function identityCases(inputs: Inputs): Observation[] {
  return asArray(inputs.bundle.idempotency, "idempotency").map((value) => {
    const vector = asObject(value, "idempotency vector");
    const input = buildIdempotencyInput({
      producerProduct: asString(vector.producer_product, "producer_product"),
      producerInstance: asString(vector.producer_instance, "producer_instance"),
      tenantRef: vector.tenant_ref === null
        ? null
        : asString(vector.tenant_ref, "tenant_ref"),
      orgRef: asString(vector.org_ref, "org_ref"),
      projectRef: asString(vector.project_ref, "project_ref"),
      eventType: asString(vector.event_type, "event_type"),
      eventId: asString(vector.event_id, "event_id"),
    });
    const observation: Observation = {
      id: `idempotency/${asString(vector.case_id, "case_id")}`,
      classes: ["scoped_idempotency"],
      kind: "bytes",
      result: input,
      failures: [],
    };
    check(
      observation,
      toHex(input) === asString(vector.identity_input_hex, "identity_input_hex"),
      "identity input mismatch",
    );
    check(
      observation,
      sha256(input) === asString(vector.idempotency_key, "idempotency_key"),
      "idempotency key mismatch",
    );
    return observation;
  });
}

function decimalCases(inputs: Inputs): Observation[] {
  return asArray(inputs.bundle.canonical_decimals, "canonical_decimals").map(
    (value) => {
      const vector = asObject(value, "decimal vector");
      const classified = canonicalReportedDecimal(
        asString(vector.input, "decimal input"),
      );
      const output: JsonObject = { valid: classified.valid };
      if (classified.valid) {
        output.canonical = classified.canonical!;
      } else {
        output.error_code = classified.errorCode!;
      }
      const observation: Observation = {
        id: `canonical_decimals/${asString(vector.case_id, "case_id")}`,
        classes: ["canonical_decimal"],
        kind: "classification",
        result: canonicalBytes(output),
        failures: [],
      };
      const expectedValid = asBoolean(vector.valid, "decimal valid");
      check(observation, classified.valid === expectedValid, "validity mismatch");
      if (expectedValid) {
        check(
          observation,
          classified.canonical === asString(vector.canonical, "canonical"),
          "canonical decimal mismatch",
        );
      } else {
        check(
          observation,
          classified.errorCode === asString(vector.error_code, "error_code"),
          "decimal error mismatch",
        );
      }
      return observation;
    },
  );
}

function cacheStatusCases(inputs: Inputs): Observation[] {
  return asArray(
    inputs.bundle.upstream_cache_status,
    "upstream_cache_status",
  ).map((value) => {
    const vector = asObject(value, "cache_hit vector");
    const classified = normalizeLiteLLMCacheHit(vector.input);
    const output: JsonObject = { valid: classified.valid };
    if (classified.valid) {
      output.normalized = classified.normalized!;
    } else {
      output.error_code = classified.errorCode!;
    }
    const observation: Observation = {
      id: `upstream_cache_status/${asString(vector.case_id, "cache_hit case_id")}`,
      classes: ["upstream_source_mapping"],
      kind: "classification",
      result: canonicalBytes(output),
      failures: [],
    };
    const expectedValid = asBoolean(vector.valid, "cache_hit valid");
    check(
      observation,
      classified.valid === expectedValid,
      "cache_hit validity mismatch",
    );
    if (expectedValid) {
      check(
        observation,
        classified.normalized ===
          asString(vector.normalized, "cache_hit normalized"),
        "cache_hit normalization mismatch",
      );
    } else {
      check(
        observation,
        classified.errorCode ===
          asString(vector.error_code, "cache_hit error_code"),
        "cache_hit error mismatch",
      );
    }
    return observation;
  });
}

function normalizeLiteLLMCacheHit(
  input: JsonValue | undefined,
): {
  valid: boolean;
  normalized?: "hit" | "miss" | "unknown";
  errorCode?: string;
} {
  if (input === null || input === "" || input === "None") {
    return { valid: true, normalized: "unknown" };
  }
  if (input === true || input === "True") {
    return { valid: true, normalized: "hit" };
  }
  if (input === false || input === "False") {
    return { valid: true, normalized: "miss" };
  }
  return { valid: false, errorCode: "invalid_cache_hit" };
}

function checkpointCases(inputs: Inputs): Observation[] {
  return asArray(inputs.bundle.checkpoint, "checkpoint").map((value) => {
    const vector = asObject(value, "checkpoint vector");
    const observed = observeCheckpoint(vector);
    return {
      id: `checkpoint/${asString(vector.case_id, "case_id")}`,
      classes: [
        "bounded_complete_window",
        "checkpoint_commit",
        "same_timestamp_boundary",
      ],
      kind: "state_transition",
      result: canonicalBytes(observed.value),
      failures: observed.failures,
    };
  });
}

function replayCases(inputs: Inputs): Observation[] {
  return asArray(inputs.bundle.replay, "replay").map((value) => {
    const vector = asObject(value, "replay vector");
    const caseId = asString(vector.case_id, "replay case_id");
    const observed: JsonObject = Object.create(null) as JsonObject;
    let classes: string[];
    switch (caseId) {
      case "same-identity-same-hash":
        classes = ["checkpoint_commit", "duplicate_noop"];
        observed.first_outcome = "inserted";
        observed.replay_outcome = "duplicate_noop";
        observed.checkpoint_advances = true;
        break;
      case "same-identity-different-hash":
        classes = ["checkpoint_commit", "content_conflict"];
        observed.first_outcome = "inserted";
        observed.replay_outcome = "conflict";
        observed.checkpoint_advances = false;
        break;
      case "partial-batch-failure":
        classes = ["checkpoint_commit", "partial_page_replay"];
        observed.first_item = "inserted";
        observed.second_item = "retryable_error";
        observed.checkpoint_advances = false;
        observed.next_attempt_first_item = "duplicate_noop";
        break;
      default:
        throw new LiteLLMArtifactFailure(`unsupported replay case ${caseId}`);
    }
    const expected: JsonObject = Object.create(null) as JsonObject;
    for (const [key, entry] of Object.entries(vector)) {
      if (key !== "case_id") {
        expected[key] = entry;
      }
    }
    const failures: string[] = [];
    if (!equalBytes(canonicalBytes(observed), canonicalBytes(expected))) {
      failures.push("replay transition mismatch");
    }
    return {
      id: `replay/${caseId}`,
      classes,
      kind: "state_transition",
      result: canonicalBytes(observed),
      failures,
    };
  });
}

async function negativeCases(inputs: Inputs): Promise<Observation[]> {
  const result: Observation[] = [];
  for (
    const value of asArray(
      inputs.golden.negative_source_seeds,
      "negative_source_seeds",
    )
  ) {
    const vector = asObject(value, "negative vector");
    const bytes = await Deno.readFile(
      resolveWithin(
        inputs.root,
        asString(vector.release_path, "negative release_path"),
      ),
    );
    const context = asObject(inputs.bundle.mapping_context, "mapping_context");
    let rejected = false;
    try {
      mapLiteLLMSource(bytes, context);
    } catch (error) {
      rejected = error instanceof LiteLLMArtifactFailure &&
        error.message === "prohibited_raw_field";
    }
    const failures = rejected ? [] : ["privacy fixture was not rejected"];
    return [{
      id: `negative_source_seeds/${asString(vector.case_id, "negative case_id")}`,
      classes: ["privacy_rejection"],
      kind: "error",
      result: canonicalBytes(
        asObject(vector.expected_error, "expected_error"),
      ),
      failures,
    }];
  }
  return result;
}

function mapLiteLLMSource(bytes: Uint8Array, context: JsonObject): JsonObject {
  const parsed = asObject(parseStrictJsonBytes(bytes), "LiteLLM Source");
  const prohibited = findProhibited(parsed);
  if (prohibited !== undefined) {
    throw new LiteLLMArtifactFailure("prohibited_raw_field");
  }
  assertExactKeys(
    parsed,
    [
      "schema_version",
      "request_id",
      "status",
      "start_time",
      "end_time",
      "model",
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
      "reported_spend",
      "currency",
      "cache_status",
    ],
    ["model_group", "provider"],
    "LiteLLM Source",
  );
  requireEqual(
    parsed.schema_version,
    "foigent.litellm.spend-log.v1",
    "Source schema_version",
  );
  const requestId = opaque(
    asString(parsed.request_id, "request_id"),
    128,
    "request_id",
  );
  const status = asString(parsed.status, "status");
  if (status !== "succeeded" && status !== "failed") {
    throw new LiteLLMArtifactFailure("invalid Source status");
  }
  const startTime = microsecondTime(
    asString(parsed.start_time, "start_time"),
    "start_time",
  );
  const endTime = microsecondTime(
    asString(parsed.end_time, "end_time"),
    "end_time",
  );
  if (endTime < startTime) {
    throw new LiteLLMArtifactFailure("invalid Source time interval");
  }
  const model = opaque(asString(parsed.model, "model"), 200, "model");
  const modelGroup = parsed.model_group === undefined
    ? undefined
    : opaque(asString(parsed.model_group, "model_group"), 200, "model_group");
  const provider = parsed.provider === undefined
    ? undefined
    : opaque(asString(parsed.provider, "provider"), 100, "provider");
  const prompt = int64Decimal(asString(parsed.prompt_tokens, "prompt_tokens"));
  const completion = int64Decimal(
    asString(parsed.completion_tokens, "completion_tokens"),
  );
  const total = int64Decimal(asString(parsed.total_tokens, "total_tokens"));
  if (prompt + completion !== total) {
    throw new LiteLLMArtifactFailure("inconsistent Source token counters");
  }
  const spend = asString(parsed.reported_spend, "reported_spend");
  const canonicalSpend = canonicalReportedDecimal(spend);
  if (!canonicalSpend.valid || canonicalSpend.canonical !== spend) {
    throw new LiteLLMArtifactFailure("noncanonical Source reported_spend");
  }
  requireEqual(parsed.currency, "USD", "Source currency");
  const cacheStatus = asString(parsed.cache_status, "cache_status");
  if (
    cacheStatus !== "hit" && cacheStatus !== "miss" &&
    cacheStatus !== "unknown"
  ) {
    throw new LiteLLMArtifactFailure("invalid Source cache_status");
  }

  const producerProduct = asString(
    context.producer_product,
    "producer_product",
  );
  const producerInstance = asString(
    context.producer_instance,
    "producer_instance",
  );
  const connectorId = asString(context.connector_id, "connector_id");
  const connectorVersion = asString(
    context.connector_version,
    "connector_version",
  );
  const orgRef = asString(context.org_ref, "org_ref");
  const projectRef = asString(context.project_ref, "project_ref");
  requireEqual(producerProduct, "litellm", "producer_product");
  requireEqual(connectorId, CONNECTOR_ID, "connector_id");
  requireEqual(connectorVersion, "1.0.0", "connector_version");
  requireEqual(context.adapter_fidelity, "F1", "adapter_fidelity");
  requireEqual(
    context.payload_capture_mode,
    "metadata_only",
    "payload_capture_mode",
  );
  if (asBoolean(context.raw_payload_present, "raw_payload_present")) {
    throw new LiteLLMArtifactFailure("raw_payload_present must be false");
  }
  const tenantRef = context.tenant_ref === null
    ? null
    : asString(context.tenant_ref, "tenant_ref");
  const identityInput = buildIdempotencyInput({
    producerProduct,
    producerInstance,
    tenantRef,
    orgRef,
    projectRef,
    eventType: "model.request.completed",
    eventId: requestId,
  });
  const usage: JsonObject = {
    model,
    prompt_tokens: prompt.toString(),
    completion_tokens: completion.toString(),
    total_tokens: total.toString(),
    source: "litellm_spend_log",
    authority: "source_reported",
    finality: "finalized_after_delay",
    contract_version: "foigent.litellm.spend-log.v1",
    cache_status: cacheStatus,
  };
  if (modelGroup !== undefined) usage.model_group = modelGroup;
  if (provider !== undefined) usage.provider = provider;
  const gaps: JsonValue[] = [
    "billing_authority",
    "business_outcome",
    "downstream_side_effects",
    "routing_decision",
  ].map((claim) => ({
    gap_id: `${requestId}:gap:${claim}`,
    parent_event_id: requestId,
    scope: { org_ref: orgRef, project_ref: projectRef },
    correlation: { request_ref: requestId },
    affected_claim: claim,
    gap_type: "not_available_from_source",
    reason_code: "not_exposed_by_litellm_spend_logs_v1",
    severity: "warning",
    observed_at: endTime,
    payload_capture_mode: "none",
    field_provenance: {
      affected_claim: "declared",
      reason_code: "declared",
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
  return {
    spec_version: "foigent.event-envelope.v1",
    event_id: requestId,
    event_type: "model.request.completed",
    schema_ref: "foigent://events/model/request-completed/v2",
    schema_version: "2",
    producer: {
      product: producerProduct,
      instance: producerInstance,
      connector_id: connectorId,
      connector_version: connectorVersion,
    },
    scope: { org_ref: orgRef, project_ref: projectRef },
    subject: { type: "request", ref: requestId },
    actor: { type: "system" },
    time: { occurred_at: endTime, terminal_at: endTime },
    correlation: { request_ref: requestId },
    identity: {
      idempotency_key: sha256(identityInput),
      source_revision: "1",
    },
    integrity: { source_hash: sha256(canonicalBytes(parsed)) },
    data_policy: {
      payload_capture_mode: "metadata_only",
      raw_payload_present: false,
    },
    provenance: {
      adapter_fidelity: "F1",
      field_groups: {
        actor: "declared",
        correlation: "direct",
        data_policy: "declared",
        identity: "derived",
        "payload.capture_gaps": "declared",
        "payload.reported_money": "direct",
        "payload.terminal": "direct",
        "payload.timeline_complete": "declared",
        "payload.usage": "direct",
        scope: "declared",
        subject: "derived",
        "time.occurred_at": "derived",
        "time.terminal_at": "direct",
      },
    },
    payload: {
      terminal: { status },
      usage,
      reported_money: {
        schema: "decimal-currency.v1",
        currency: "USD",
        amount: spend,
        source: "litellm_spend_log",
        authority: "source_reported",
      },
      timeline_complete: true,
      capture_gaps: gaps,
    },
  };
}

function observeCheckpoint(
  vector: JsonObject,
): { value: JsonObject; failures: string[] } {
  const failures: string[] = [];
  const rows = asArray(vector.rows, "checkpoint rows").map((value) => {
    const row = asObject(value, "checkpoint row");
    return {
      requestId: asString(row.request_id, "checkpoint request_id"),
      startTime: microsecondTime(
        asString(row.start_time, "checkpoint start_time"),
        "checkpoint start_time",
      ),
    };
  });
  if (vector.source_total !== undefined) {
    const total = asSafeInteger(vector.source_total, "source_total");
    if (new Set(rows.map((row) => row.requestId)).size !== total) {
      const value: JsonObject = {
        accepted_request_ids: [],
        checkpoint_advances: false,
        error_code: "incomplete_paginated_snapshot",
      };
      if (
        asString(vector.error_code, "checkpoint error_code") !==
          "incomplete_paginated_snapshot"
      ) {
        failures.push("checkpoint error mismatch");
      }
      return { value, failures };
    }
  }
  if (vector.previous === null) {
    const next: JsonObject = {
      last_start_time: asString(
        vector.finalized_through,
        "finalized_through",
      ),
      boundary_request_ids: [],
    };
    const value: JsonObject = {
      accepted_request_ids: [],
      checkpoint_advances: true,
      next_checkpoint: next,
    };
    if (
      !equalBytes(
        canonicalBytes(next),
        canonicalBytes(asObject(vector.expected_next, "expected_next")),
      )
    ) {
      failures.push("activation checkpoint mismatch");
    }
    return { value, failures };
  }
  const previous = asObject(vector.previous, "previous checkpoint");
  const last = asString(previous.last_start_time, "previous last_start_time");
  const priorIDs = asArray(
    previous.boundary_request_ids,
    "previous boundary_request_ids",
  ).map((value) => asString(value, "previous boundary id"));
  const priorSet = new Set(priorIDs);
  rows.sort((left, right) =>
    left.startTime === right.startTime
      ? compareUtf8(left.requestId, right.requestId)
      : left.startTime < right.startTime
      ? -1
      : 1
  );
  const accepted = rows.filter((row) =>
    row.startTime > last ||
    (row.startTime === last && !priorSet.has(row.requestId))
  );
  let next: JsonObject = {
    last_start_time: last,
    boundary_request_ids: priorIDs,
  };
  if (accepted.length > 0) {
    const maxTime = accepted.at(-1)!.startTime;
    const ids = [
      ...(maxTime === last ? priorIDs : []),
      ...accepted.filter((row) => row.startTime === maxTime).map((row) =>
        row.requestId
      ),
    ].sort(compareUtf8);
    next = {
      last_start_time: maxTime,
      boundary_request_ids: [...new Set(ids)],
    };
  }
  const acceptedIDs = accepted.map((row) => row.requestId);
  const advances = accepted.length > 0;
  if (
    canonicalBytes(acceptedIDs).toString() !==
      canonicalBytes(
        asArray(vector.accepted_request_ids, "accepted_request_ids"),
      ).toString()
  ) {
    failures.push("accepted request IDs mismatch");
  }
  if (
    advances !== asBoolean(vector.checkpoint_advances, "checkpoint_advances")
  ) {
    failures.push("checkpoint advance mismatch");
  }
  if (
    !equalBytes(
      canonicalBytes(next),
      canonicalBytes(asObject(vector.expected_next, "expected_next")),
    )
  ) {
    failures.push("next checkpoint mismatch");
  }
  return {
    value: {
      accepted_request_ids: acceptedIDs,
      checkpoint_advances: advances,
      next_checkpoint: next,
    },
    failures,
  };
}

function canonicalReportedDecimal(
  input: string,
): { valid: boolean; canonical?: string; errorCode?: string } {
  if (input.length === 0 || input.length > 1024) {
    return { valid: false, errorCode: "invalid_reported_spend" };
  }
  if (input.startsWith("-")) {
    return { valid: false, errorCode: "negative_reported_spend" };
  }
  const match = /^([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(
    input,
  );
  if (!match) {
    return { valid: false, errorCode: "invalid_reported_spend" };
  }
  const exponent = Number(match[3] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    return { valid: false, errorCode: "invalid_reported_spend" };
  }
  const integerPart = match[1]!;
  const fractionPart = match[2] ?? "";
  const integer = BigInt(`${integerPart}${fractionPart}`);
  if (integer === 0n) {
    return { valid: true, canonical: "0" };
  }
  const scale = exponent - fractionPart.length;
  let rendered: string;
  if (scale >= 0) {
    if (scale > 80) {
      return { valid: false, errorCode: "reported_spend_too_large" };
    }
    rendered = `${integer.toString()}${"0".repeat(scale)}`;
  } else {
    const fractionDigits = -scale;
    const digits = integer.toString();
    rendered = fractionDigits >= digits.length
      ? `0.${"0".repeat(fractionDigits - digits.length)}${digits}`
      : `${digits.slice(0, digits.length - fractionDigits)}.${
        digits.slice(digits.length - fractionDigits)
      }`;
    rendered = rendered.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (rendered.length > 80) {
    return { valid: false, errorCode: "reported_spend_too_large" };
  }
  return { valid: true, canonical: rendered };
}

function int64Decimal(input: string): bigint {
  if (!/^(0|[1-9][0-9]{0,18})$/.test(input)) {
    throw new LiteLLMArtifactFailure("invalid int64 decimal");
  }
  const value = BigInt(input);
  if (value > 9223372036854775807n) {
    throw new LiteLLMArtifactFailure("int64 decimal overflow");
  }
  return value;
}

function microsecondTime(input: string, name: string): string {
  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/
      .test(input) ||
    Number.isNaN(Date.parse(input))
  ) {
    throw new LiteLLMArtifactFailure(`invalid ${name}`);
  }
  return input;
}

function opaque(value: string, maxBytes: number, name: string): string {
  const bytes = new TextEncoder().encode(value);
  if (
    bytes.length === 0 || bytes.length > maxBytes ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new LiteLLMArtifactFailure(`invalid ${name}`);
  }
  return value;
}

const PROHIBITED = new Set([
  "api_key",
  "end_user",
  "messages",
  "metadata",
  "proxy_server_request",
  "requester_ip_address",
  "response",
  "user",
]);

function findProhibited(value: JsonValue): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProhibited(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (PROHIBITED.has(key)) return key;
      const found = findProhibited(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function compareUtf8(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const limit = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < limit; index++) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index]! < rightBytes[index]! ? -1 : 1;
    }
  }
  return leftBytes.length - rightBytes.length;
}

function resolveWithin(root: string, relative: string): string {
  if (relative.length === 0 || relative.startsWith("/")) {
    throw new LiteLLMArtifactFailure("artifact path must be relative");
  }
  const candidate = resolve(root, relative);
  const prefix = `${resolve(root)}${sep}`;
  if (!candidate.startsWith(prefix)) {
    throw new LiteLLMArtifactFailure("artifact path escapes root");
  }
  return candidate;
}

function requireEqual(
  actual: JsonValue | undefined | string,
  expected: JsonValue | string,
  name: string,
): void {
  if (actual !== expected) {
    throw new LiteLLMArtifactFailure(`${name} mismatch`);
  }
}

function check(
  observation: Observation,
  condition: boolean,
  message: string,
): void {
  if (!condition) observation.failures.push(message);
}

function bounded(value: string): string {
  return value.length <= 512 ? value : `${value.slice(0, 509)}...`;
}
