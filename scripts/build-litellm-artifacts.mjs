#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] ?? "--check";
const protocolVersion = "1.1.0";
const context = {
  producer_product: "litellm",
  producer_instance: "litellm-development",
  connector_id: "foigent.litellm.spend-logs",
  connector_version: "1.0.0",
  tenant_ref: null,
  org_ref: "101",
  project_ref: "202",
  adapter_fidelity: "F1",
  payload_capture_mode: "metadata_only",
  raw_payload_present: false,
  source_revision: "1",
  timeline_complete: true,
};
const cases = [
  {
    case_id: "litellm-succeeded",
    source_path: "fixtures/source/litellm/valid-succeeded.json",
    shared_path: "fixtures/shared/litellm-succeeded-envelope.hash-input.json",
  },
  {
    case_id: "litellm-failed",
    source_path: "fixtures/source/litellm/valid-failed.json",
    shared_path: "fixtures/shared/litellm-failed-envelope.hash-input.json",
  },
  {
    case_id: "litellm-cache-hit",
    source_path: "fixtures/source/litellm/valid-cache-hit.json",
    shared_path: "fixtures/shared/litellm-cache-hit-envelope.hash-input.json",
  },
];

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function lpUTF8(value) {
  const bytes = value === null ? Buffer.alloc(0) : Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function identityInput(eventID) {
  return Buffer.concat([
    Buffer.from("foigent.event-idempotency.v1", "ascii"),
    lpUTF8(context.producer_product),
    lpUTF8(context.producer_instance),
    lpUTF8(context.tenant_ref),
    lpUTF8(context.org_ref),
    lpUTF8(context.project_ref),
    lpUTF8("model.request.completed"),
    lpUTF8(eventID),
  ]);
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
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`
    ).join(",")}}`;
  }
  throw new Error(`unsupported JSON type: ${typeof value}`);
}

function validateSource(source, path) {
  const required = [
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
  ];
  const optional = ["model_group", "provider"];
  const keys = Object.keys(source).sort();
  const expected = [...required, ...optional.filter((key) =>
    Object.hasOwn(source, key)
  )].sort();
  if (keys.join("\n") !== expected.join("\n")) {
    throw new Error(`${path}: unexpected or missing Source field`);
  }
  if (
    source.schema_version !== "foigent.litellm.spend-log.v1" ||
    !["succeeded", "failed"].includes(source.status) ||
    source.currency !== "USD" ||
    !["hit", "miss", "unknown"].includes(source.cache_status)
  ) {
    throw new Error(`${path}: invalid Source controlled value`);
  }
  if (
    !validOpaque(source.request_id, 128) ||
    !validOpaque(source.model, 200) ||
    (source.model_group !== undefined &&
      !validOpaque(source.model_group, 200)) ||
    (source.provider !== undefined && !validOpaque(source.provider, 100))
  ) {
    throw new Error(`${path}: invalid Source opaque string`);
  }
  const timePattern =
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/;
  if (
    !timePattern.test(source.start_time) ||
    !timePattern.test(source.end_time) ||
    Date.parse(source.end_time) < Date.parse(source.start_time)
  ) {
    throw new Error(`${path}: invalid Source time interval`);
  }
  const counterPattern =
    /^(0|[1-9][0-9]{0,17}|[1-8][0-9]{18}|9[01][0-9]{17}|92[01][0-9]{16}|922[0-2][0-9]{15}|9223[0-2][0-9]{14}|92233[0-6][0-9]{13}|922337[01][0-9]{12}|92233720[0-2][0-9]{10}|922337203[0-5][0-9]{9}|9223372036[0-7][0-9]{8}|92233720368[0-4][0-9]{7}|922337203685[0-3][0-9]{6}|9223372036854[0-6][0-9]{5}|92233720368547[0-6][0-9]{4}|922337203685477[0-4][0-9]{3}|9223372036854775[0-7][0-9]{2}|922337203685477580[0-7])$/;
  for (const key of [
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
  ]) {
    if (typeof source[key] !== "string" || !counterPattern.test(source[key])) {
      throw new Error(`${path}: invalid ${key}`);
    }
  }
  if (
    BigInt(source.prompt_tokens) + BigInt(source.completion_tokens) !==
      BigInt(source.total_tokens)
  ) {
    throw new Error(`${path}: inconsistent token total`);
  }
  if (
    typeof source.reported_spend !== "string" ||
    !/^(0|[1-9][0-9]*|(0|[1-9][0-9]*)\.[0-9]*[1-9])$/.test(
      source.reported_spend,
    ) ||
    source.reported_spend.length > 80
  ) {
    throw new Error(`${path}: invalid canonical reported_spend`);
  }
}

function validOpaque(value, maxBytes) {
  if (typeof value !== "string") {
    return false;
  }
  const bytes = Buffer.from(value, "utf8");
  return bytes.length >= 1 && bytes.length <= maxBytes &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function mapSource(source) {
  const canonicalSourceBytes = Buffer.from(canonicalize(source), "utf8");
  const eventID = source.request_id;
  const idempotencyKey = sha256(identityInput(eventID));
  const gaps = [
    "billing_authority",
    "business_outcome",
    "downstream_side_effects",
    "routing_decision",
  ].map((affectedClaim) => ({
    gap_id: `${eventID}:gap:${affectedClaim}`,
    parent_event_id: eventID,
    scope: {
      org_ref: context.org_ref,
      project_ref: context.project_ref,
    },
    correlation: {
      request_ref: eventID,
    },
    affected_claim: affectedClaim,
    gap_type: "not_available_from_source",
    reason_code: "not_exposed_by_litellm_spend_logs_v1",
    severity: "warning",
    observed_at: source.end_time,
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
  const usage = {
    model: source.model,
    ...(source.model_group === undefined
      ? {}
      : { model_group: source.model_group }),
    ...(source.provider === undefined ? {} : { provider: source.provider }),
    prompt_tokens: source.prompt_tokens,
    completion_tokens: source.completion_tokens,
    total_tokens: source.total_tokens,
    source: "litellm_spend_log",
    authority: "source_reported",
    finality: "finalized_after_delay",
    contract_version: "foigent.litellm.spend-log.v1",
    cache_status: source.cache_status,
  };
  return {
    spec_version: "foigent.event-envelope.v1",
    event_id: eventID,
    event_type: "model.request.completed",
    schema_ref: "foigent://events/model/request-completed/v2",
    schema_version: "2",
    producer: {
      product: context.producer_product,
      instance: context.producer_instance,
      connector_id: context.connector_id,
      connector_version: context.connector_version,
    },
    scope: {
      org_ref: context.org_ref,
      project_ref: context.project_ref,
    },
    subject: {
      type: "request",
      ref: eventID,
    },
    actor: {
      type: "system",
    },
    time: {
      occurred_at: source.end_time,
      terminal_at: source.end_time,
    },
    correlation: {
      request_ref: eventID,
    },
    identity: {
      idempotency_key: idempotencyKey,
      source_revision: context.source_revision,
    },
    integrity: {
      source_hash: sha256(canonicalSourceBytes),
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
      terminal: {
        status: source.status,
      },
      usage,
      reported_money: {
        schema: "decimal-currency.v1",
        currency: source.currency,
        amount: source.reported_spend,
        source: "litellm_spend_log",
        authority: "source_reported",
      },
      timeline_complete: true,
      capture_gaps: gaps,
    },
  };
}

function component(path) {
  return {
    path,
    sha256: sha256(readFileSync(resolve(root, path))),
  };
}

function render(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeOrCheck(path, value) {
  const rendered = typeof value === "string" ? value : render(value);
  const absolute = resolve(root, path);
  if (mode === "--write") {
    writeFileSync(absolute, rendered, { encoding: "utf8", mode: 0o644 });
    return;
  }
  if (readFileSync(absolute, "utf8") !== rendered) {
    throw new Error(`${path} is stale`);
  }
}

if (!["--write", "--check"].includes(mode)) {
  throw new Error("usage: build-litellm-artifacts.mjs --write|--check");
}

const builtCases = [];
for (const item of cases) {
  const sourceBytes = readFileSync(resolve(root, item.source_path));
  const source = JSON.parse(sourceBytes.toString("utf8"));
  validateSource(source, item.source_path);
  const envelope = mapSource(source);
  const canonical = Buffer.from(canonicalize(envelope), "utf8");
  writeOrCheck(item.shared_path, render(envelope));
  builtCases.push({
    case_id: item.case_id,
    source_fixture: {
      release_path: item.source_path,
      sha256: sha256(sourceBytes),
    },
    shared_hash_input: {
      path: item.shared_path,
      file_sha256: sha256(readFileSync(resolve(root, item.shared_path))),
      envelope_hash_field: "absent",
    },
    expected: {
      canonical_bytes: canonical.length,
      envelope_hash: sha256(canonical),
      idempotency_key: envelope.identity.idempotency_key,
      terminal_status: source.status,
      capture_gap_count: 4,
    },
  });
}

const negativePath = "fixtures/source/litellm/privacy-rejected.json";
const golden = {
  bundle_version: "foigent.litellm-golden-fixture-bundle.v1",
  protocol_version: protocolVersion,
  connector: context.connector_id,
  cases: builtCases,
  negative_source_seeds: [
    {
      case_id: "privacy-field-rejected",
      release_path: negativePath,
      sha256: sha256(readFileSync(resolve(root, negativePath))),
      expected_error: {
        error_version: "foigent.connector-error.v1",
        category: "privacy",
        code: "prohibited_raw_field",
        phase: "validate",
        operation: "sanitize_litellm_spend_log",
        retryable: false,
        safe_message: "LiteLLM Source row contains a prohibited raw field",
        recovery: "operator_repair",
      },
    },
  ],
};
writeOrCheck("fixtures/litellm-golden-fixture-bundle.v1.json", golden);

const vectors = {
  bundle_version: "foigent.litellm-connector-vector-bundle.v1",
  protocol_version: protocolVersion,
  golden_fixture_bundle_path:
    "fixtures/litellm-golden-fixture-bundle.v1.json",
  mapping_context: context,
  canonical_envelopes: builtCases.map((item) => ({
    case_id: item.case_id,
    source_input_path: item.source_fixture.release_path,
    input_path: item.shared_hash_input.path,
    canonical_bytes: item.expected.canonical_bytes,
    envelope_hash: item.expected.envelope_hash,
  })),
  idempotency: builtCases.map((item) => {
    const source = JSON.parse(
      readFileSync(
        resolve(root, item.source_fixture.release_path),
        "utf8",
      ),
    );
    const input = identityInput(source.request_id);
    return {
      case_id: item.case_id,
      producer_product: context.producer_product,
      producer_instance: context.producer_instance,
      tenant_ref: context.tenant_ref,
      org_ref: context.org_ref,
      project_ref: context.project_ref,
      event_type: "model.request.completed",
      event_id: source.request_id,
      identity_input_hex: input.toString("hex"),
      idempotency_key: sha256(input),
    };
  }),
  canonical_decimals: [
    { case_id: "zero", input: "0", canonical: "0", valid: true },
    {
      case_id: "trim-trailing-zeroes",
      input: "1.2300",
      canonical: "1.23",
      valid: true,
    },
    {
      case_id: "positive-exponent",
      input: "1.2e-7",
      canonical: "0.00000012",
      valid: true,
    },
    {
      case_id: "negative",
      input: "-0.1",
      error_code: "negative_reported_spend",
      valid: false,
    },
    {
      case_id: "nonfinite",
      input: "NaN",
      error_code: "invalid_reported_spend",
      valid: false,
    },
  ],
  checkpoint: [
    {
      case_id: "activation-forward-fence",
      previous: null,
      finalized_through: "2026-07-28T01:00:00.000000Z",
      rows: [],
      expected_next: {
        last_start_time: "2026-07-28T01:00:00.000000Z",
        boundary_request_ids: [],
      },
      accepted_request_ids: [],
      checkpoint_advances: true,
    },
    {
      case_id: "same-timestamp-boundary-expands",
      previous: {
        last_start_time: "2026-07-28T01:02:03.123456Z",
        boundary_request_ids: ["a"],
      },
      finalized_through: "2026-07-28T01:03:00.000000Z",
      rows: [
        {
          request_id: "a",
          start_time: "2026-07-28T01:02:03.123456Z",
        },
        {
          request_id: "b",
          start_time: "2026-07-28T01:02:03.123456Z",
        },
      ],
      expected_next: {
        last_start_time: "2026-07-28T01:02:03.123456Z",
        boundary_request_ids: ["a", "b"],
      },
      accepted_request_ids: ["b"],
      checkpoint_advances: true,
    },
    {
      case_id: "late-older-row-excluded",
      previous: {
        last_start_time: "2026-07-28T01:02:03.123456Z",
        boundary_request_ids: ["a"],
      },
      finalized_through: "2026-07-28T01:03:00.000000Z",
      rows: [
        {
          request_id: "late",
          start_time: "2026-07-28T01:02:02.999999Z",
        },
      ],
      expected_next: {
        last_start_time: "2026-07-28T01:02:03.123456Z",
        boundary_request_ids: ["a"],
      },
      accepted_request_ids: [],
      checkpoint_advances: false,
    },
    {
      case_id: "unique-total-mismatch",
      previous: {
        last_start_time: "2026-07-28T01:02:03.123456Z",
        boundary_request_ids: ["a"],
      },
      finalized_through: "2026-07-28T01:03:00.000000Z",
      rows: [
        {
          request_id: "b",
          start_time: "2026-07-28T01:02:04.000000Z",
        },
        {
          request_id: "b",
          start_time: "2026-07-28T01:02:04.000000Z",
        },
      ],
      source_total: 2,
      error_code: "incomplete_paginated_snapshot",
      accepted_request_ids: [],
      checkpoint_advances: false,
    },
  ],
  replay: [
    {
      case_id: "same-identity-same-hash",
      first_outcome: "inserted",
      replay_outcome: "duplicate_noop",
      checkpoint_advances: true,
    },
    {
      case_id: "same-identity-different-hash",
      first_outcome: "inserted",
      replay_outcome: "conflict",
      checkpoint_advances: false,
    },
    {
      case_id: "partial-batch-failure",
      first_item: "inserted",
      second_item: "retryable_error",
      checkpoint_advances: false,
      next_attempt_first_item: "duplicate_noop",
    },
  ],
};
writeOrCheck("vectors/litellm-connector-vector-bundle.v1.json", vectors);

const mappingPath =
  "mappings/litellm/spend-log-to-model-request-completed.v2.json";
const projectionPath =
  "mappings/xinsight/model-request-completed-v2-to-m0-m0.1-litellm-v1.json";
const vectorPath = "vectors/litellm-connector-vector-bundle.v1.json";
const manifest = {
  manifest_version: "foigent.connector-manifest.v1",
  connector_id: context.connector_id,
  connector_version: context.connector_version,
  connector_class: "integration",
  direction: "source",
  source_product: "litellm",
  source_release: {
    version: "v1.93.0",
    git_commit: "052b5a2169d8d3082e1d66e69f200a72b0c1e274",
    image: {
      repository: "ghcr.io/berriai/litellm",
      index_digest:
        "sha256:a1745e629abfb17d434426ff48b115f54f4f4c4a0f5af241de569e93c63c411e",
    },
    platform_manifests: {
      linux_amd64:
        "sha256:4ce6c997f7652cf4ed787eef8db8b013f1cd6b79af8280c43f782f8491f6adad",
      linux_arm64:
        "sha256:c465a61a9949b59dc1689c0a745e9aaa3c3e4bd7f6ccb4e1858bbde8cf6e83da",
    },
    signature: {
      scheme: "cosign-key-v1",
      public_key_sha256: component(
        "evidence/upstream/litellm-cosign.pub",
      ).sha256,
      verified_index_digest:
        "sha256:a1745e629abfb17d434426ff48b115f54f4f4c4a0f5af241de569e93c63c411e",
    },
  },
  event_identity_profile: "foigent.event-idempotency.v1",
  supported_source_schemas: [
    {
      schema_id: "foigent://sources/litellm/spend-log/v1",
      sha256: component("schemas/litellm-spend-log.v1.schema.json").sha256,
    },
  ],
  emitted_event_schemas: [
    {
      event_type: "model.request.completed",
      schema_ref: "foigent://events/model/request-completed/v2",
      schema_version: "2",
    },
  ],
  transport: {
    mode: "https_pull",
    route: "/spend/logs/v2",
    page_schema: "litellm.spend-logs-v2.page@v1.93.0",
    max_items: 100,
    max_bytes: 8388608,
  },
  delivery: {
    guarantee: "at_least_once",
    checkpoint_commit: "after_all_items_converge",
    conflict: "fail_closed",
    empty_page_cursor_advance: "fail_closed",
  },
  bootstrap: {
    mode: "activation_forward",
    broad_backfill: false,
  },
  checkpoint: {
    strategy: "litellm_start_time_boundary_v1",
    cursor_ownership: "connector_state_only",
  },
  coverage: {
    included: [
      "authenticated LiteLLM spend-log rows finalized at least 60 seconds before poll time",
      "bounded complete HTTP windows with at most 2000 unique request IDs",
      "at most 8 MiB cumulative response bytes per complete poll window",
    ],
    excluded: [
      "retention, logging or emission of prompt, response, proxy request, API key, user, end-user and IP payloads",
      "rows inserted later than the finalization delay with startTime older than the committed checkpoint",
      "windows whose complete pagination cannot be proven",
    ],
  },
  instance_binding: {
    source_field: "source_instance",
    envelope_field: "producer.instance",
    comparison: "exact_utf8_bytes",
    change_semantics: "new_connector_instance_identity_domain",
  },
  payload_policy: {
    ingestion_capture_mode: "api_import",
    payload_capture_mode: "metadata_only",
    raw_payload_present: false,
  },
  required_capabilities: [
    "strict_source_validation",
    "raw_response_allowlist_projection",
    "bounded_complete_window",
    "checkpoint_after_convergence",
    "same_identity_same_hash_duplicate_noop",
    "same_identity_different_hash_conflict",
  ],
  declared_capture_gaps: [
    {
      affected_claim: "billing_authority",
      reason_code: "not_exposed_by_litellm_spend_logs_v1",
    },
    {
      affected_claim: "business_outcome",
      reason_code: "not_exposed_by_litellm_spend_logs_v1",
    },
    {
      affected_claim: "downstream_side_effects",
      reason_code: "not_exposed_by_litellm_spend_logs_v1",
    },
    {
      affected_claim: "routing_decision",
      reason_code: "not_exposed_by_litellm_spend_logs_v1",
    },
  ],
  compatibility: {
    reference_profile:
      "xinsight.foigent-envelope-to-m0.litellm-spend-log.v1",
    reference_projection_contract: component(projectionPath),
    reference_compatibility_vector_bundle: component(vectorPath),
    source_revision: "1",
    timeline_complete: true,
    retention: "7d",
  },
};
writeOrCheck("manifests/foigent.litellm.spend-logs-1.0.0.json", manifest);

process.stdout.write(
  `LiteLLM protocol artifacts ${mode === "--write" ? "written" : "verified"}: ` +
    `${builtCases.length} Golden cases\n`,
);
