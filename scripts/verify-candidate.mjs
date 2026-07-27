#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const bundle = readJSON("vectors/canonical-vector-bundle.v1.json");
const domainSchema = readJSON("schemas/model-request-completed.v1.schema.json");
const failures = [];

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function idempotencyInput({
  producer_product,
  producer_instance,
  tenant_ref,
  org_ref,
  project_ref,
  event_type,
  event_id,
}) {
  return Buffer.concat([
    Buffer.from("foigent.event-idempotency.v1", "ascii"),
    lpUTF8(producer_product),
    lpUTF8(producer_instance),
    lpUTF8(tenant_ref),
    lpUTF8(org_ref),
    lpUTF8(project_ref),
    lpUTF8(event_type),
    lpUTF8(event_id),
  ]);
}

function lpUTF8(value) {
  if (value === null) {
    return Buffer.alloc(4);
  }
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
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
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${members.join(",")}}`;
  }
  throw new Error(`unsupported JSON type: ${typeof value}`);
}

function normalizeMicrosecondTime(input) {
  const match =
    /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(
      input,
    );
  if (!match) {
    return { valid: false, error_code: "invalid_timestamp" };
  }
  const fraction = match[3] ?? "";
  if (fraction.slice(6).replaceAll("0", "") !== "") {
    return { valid: false, error_code: "timestamp_precision_loss" };
  }
  const instant = new Date(`${match[1]}T${match[2]}${match[4]}`);
  if (Number.isNaN(instant.valueOf())) {
    return { valid: false, error_code: "invalid_timestamp" };
  }
  const whole = instant.toISOString().slice(0, 19);
  return {
    valid: true,
    normalized: `${whole}.${fraction.slice(0, 6).padEnd(6, "0")}Z`,
  };
}

function mapReferenceSource(sourcePath) {
  const sourceBytes = readFileSync(resolve(root, sourcePath));
  const source = JSON.parse(sourceBytes.toString("utf8"));
  const context = bundle.reference_mapping_context;
  const terminalTime = normalizeMicrosecondTime(source.terminal.available_at);
  if (!terminalTime.valid) {
    throw new Error(
      `${sourcePath}: ${terminalTime.error_code ?? "invalid terminal time"}`,
    );
  }
  const eventID = source.request_id;
  const orgRef = String(source.org_id);
  const projectRef = String(source.project_id);
  const eventType = "model.request.completed";
  const idempotencyKey = sha256(
    idempotencyInput({
      producer_product: context.producer_product,
      producer_instance: context.producer_instance,
      tenant_ref: null,
      org_ref: orgRef,
      project_ref: projectRef,
      event_type: eventType,
      event_id: eventID,
    }),
  );
  const gaps = [...source.capture_gaps]
    .sort((left, right) =>
      left.source < right.source ? -1 : left.source > right.source ? 1 : 0,
    )
    .map((gap) => ({
      gap_id: `${eventID}:gap:${gap.source}`,
      parent_event_id: eventID,
      scope: {
        org_ref: orgRef,
        project_ref: projectRef,
      },
      correlation: {
        request_ref: eventID,
      },
      affected_claim: gap.source,
      gap_type: "not_available_from_source",
      reason_code: gap.reason,
      severity: "warning",
      observed_at: terminalTime.normalized,
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
  return {
    spec_version: "foigent.event-envelope.v1",
    event_id: eventID,
    event_type: eventType,
    schema_ref: "foigent://events/model/request-completed/v1",
    schema_version: "1",
    producer: {
      product: context.producer_product,
      instance: context.producer_instance,
      connector_id: context.connector_id,
      connector_version: context.connector_version,
    },
    scope: {
      org_ref: orgRef,
      project_ref: projectRef,
    },
    subject: {
      type: "request",
      ref: eventID,
    },
    actor: {
      type: "system",
    },
    time: {
      occurred_at: terminalTime.normalized,
      terminal_at: terminalTime.normalized,
    },
    correlation: {
      request_ref: eventID,
    },
    identity: {
      idempotency_key: idempotencyKey,
      source_revision: context.source_revision,
    },
    integrity: {
      source_hash: sha256(sourceBytes),
    },
    data_policy: {
      payload_capture_mode: context.payload_capture_mode,
      raw_payload_present: context.raw_payload_present,
    },
    provenance: {
      adapter_fidelity: context.adapter_fidelity,
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
        status: source.terminal.status,
      },
      usage: {
        model: source.usage.model,
        prompt_tokens: String(source.usage.prompt_tokens),
        uncached_prompt_tokens: String(source.usage.uncached_prompt_tokens),
        cache_read_tokens: String(source.usage.cache_read_tokens),
        cache_creation_tokens: String(source.usage.cache_creation_tokens),
        completion_tokens: String(source.usage.completion_tokens),
        source: source.usage.source,
        authority: source.usage.authority,
        purpose: source.usage.purpose,
        finality: source.usage.finality,
        contract_version: source.usage.contract_version,
        ...(source.usage.estimate_version === undefined
          ? {}
          : { estimate_version: source.usage.estimate_version }),
        cache_usage_schema: source.usage.cache_usage_schema,
        cache_usage_status: source.usage.cache_usage_status,
      },
      money: source.money,
      timeline_complete: context.timeline_complete,
      capture_gaps: gaps,
    },
  };
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const int64Pattern = new RegExp(domainSchema.$defs.int64Decimal.pattern);
for (const vector of bundle.decimal_strings) {
  const matches = int64Pattern.test(vector.value);
  check(
    matches === vector.valid_int64_counter,
    `${vector.case_id}: decimal-string classification mismatch`,
  );
}

for (const vector of bundle.timestamps) {
  const result = normalizeMicrosecondTime(vector.input);
  check(
    result.valid === vector.valid,
    `${vector.case_id}: timestamp validity mismatch`,
  );
  if (vector.valid) {
    check(
      result.normalized === vector.normalized,
      `${vector.case_id}: timestamp normalization mismatch`,
    );
  } else if (vector.error_code) {
    check(
      result.error_code === vector.error_code,
      `${vector.case_id}: timestamp error mismatch`,
    );
  }
}

for (const vector of bundle.idempotency) {
  const input = idempotencyInput(vector);
  check(
    input.toString("hex") === vector.identity_input_hex,
    `${vector.case_id}: identity_input_hex mismatch`,
  );
  check(
    sha256(input) === vector.idempotency_key,
    `${vector.case_id}: idempotency_key mismatch`,
  );
}

for (const vector of bundle.canonical_envelopes) {
  const input = readJSON(vector.input_path);
  const mapped = mapReferenceSource(vector.source_input_path);
  check(
    canonicalize(mapped) === canonicalize(input),
    `${vector.case_id}: Source-to-shared mapping mismatch`,
  );
  const canonical = Buffer.from(canonicalize(input), "utf8");
  check(
    canonical.length === vector.canonical_bytes,
    `${vector.case_id}: canonical byte length mismatch`,
  );
  check(
    sha256(canonical) === vector.envelope_hash,
    `${vector.case_id}: envelope_hash mismatch`,
  );
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `candidate vectors verified: ${bundle.canonical_envelopes.length} envelopes, ` +
    `${bundle.idempotency.length} identities\n`,
);
