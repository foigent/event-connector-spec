import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import {
  asArray,
  asObject,
  asString,
  canonicalBytes,
  canonicalize,
  JsonObject,
  JsonValue,
  parseStrictJson,
  parseStrictJsonBytes,
  sha256,
  StrictJsonError,
  toHex,
} from "../src/json.ts";
import {
  createConformanceReport,
  PINNED_VECTOR_SHA256,
  resultBytesHex,
} from "../src/conformance.ts";
import {
  buildIdempotencyInput,
  normalizeMicrosecondTimestamp,
  opaqueUtf8Hex,
  protocolControlledNfc,
  validInt64Decimal,
} from "../src/protocol.ts";
import {
  observePartialPageFailure,
  observeSameIdentityDifferentHash,
  observeSameIdentitySameHash,
} from "../src/replay.ts";

const BUNDLE_PATH = fileURLToPath(
  new URL("../../../vectors/canonical-vector-bundle.v1.json", import.meta.url),
);

Deno.test("strict parser rejects a duplicate key at nested depth", () => {
  const error = expectStrictJsonError(
    () =>
      parseStrictJson(
        '{"payload":{"terminal":{"status":"settled","status":"cancelled"}}}',
      ),
  );
  strictEqual(error.code, "duplicate_json_key");
});

Deno.test("safe-integer canonical profile never coerces int64 through Number", () => {
  const parsed = asObject(
    parseStrictJson('{"counter":9223372036854775807}'),
    "parsed",
  );
  strictEqual(typeof parsed.counter, "bigint");
  strictEqual(parsed.counter, 9223372036854775807n);
  const error = expectStrictJsonError(() => canonicalBytes(parsed));
  strictEqual(error.code, "unsafe_json_number");
});

Deno.test("canonical decimal counter boundaries use bigint", () => {
  const expectations = new Map<string, boolean>([
    ["0", true],
    ["9007199254740991", true],
    ["9007199254740992", true],
    ["9223372036854775807", true],
    ["01", false],
    ["-1", false],
    ["9223372036854775808", false],
    ["1.0", false],
    ["1e3", false],
    [" 1", false],
  ]);
  for (const [value, expected] of expectations) {
    strictEqual(validInt64Decimal(value), expected, value);
  }
});

Deno.test("UTC microsecond normalization is lossless", () => {
  deepStrictEqual(normalizeMicrosecondTimestamp("2026-07-25T04:05:06Z"), {
    valid: true,
    normalized: "2026-07-25T04:05:06.000000Z",
  });
  deepStrictEqual(
    normalizeMicrosecondTimestamp("2026-07-25T12:05:06.123456+08:00"),
    {
      valid: true,
      normalized: "2026-07-25T04:05:06.123456Z",
    },
  );
  deepStrictEqual(
    normalizeMicrosecondTimestamp("2026-07-25T04:05:06.123456789Z"),
    {
      valid: false,
      error_code: "timestamp_precision_loss",
    },
  );
});

Deno.test("NFC applies only to protocol control strings", () => {
  strictEqual(protocolControlledNfc("model.request.completed"), true);
  strictEqual(protocolControlledNfc("model.reque\u0301st.completed"), false);
  strictEqual(opaqueUtf8Hex("req_e\u0301"), "7265715f65cc81");
});

Deno.test("LP identity includes absent tenant and opaque event bytes", () => {
  const identity = buildIdempotencyInput({
    producerProduct: "unirouter",
    producerInstance: "unirouter-development",
    tenantRef: null,
    orgRef: "101",
    projectRef: "202",
    eventType: "model.request.completed",
    eventId: "req_e\u0301",
  });
  strictEqual(
    toHex(identity),
    "666f6967656e742e6576656e742d6964656d706f74656e63792e7631" +
      "00000009756e69726f75746572" +
      "00000015756e69726f757465722d646576656c6f706d656e74" +
      "00000000" +
      "00000003313031" +
      "00000003323032" +
      "000000176d6f64656c2e726571756573742e636f6d706c65746564" +
      "000000077265715f65cc81",
  );
  strictEqual(
    sha256(identity),
    "sha256:fd256a506369a0fa05dad3ee68f2e577918b97810778e1802d11950112275447",
  );
});

Deno.test("replay observations preserve checkpoint commit rules", () => {
  deepStrictEqual(observeSameIdentitySameHash(), {
    first_outcome: "inserted",
    replay_outcome: "duplicate_noop",
    checkpoint_advances: true,
  });
  deepStrictEqual(observeSameIdentityDifferentHash(), {
    first_outcome: "inserted",
    replay_outcome: "conflict",
    checkpoint_advances: false,
  });
  deepStrictEqual(observePartialPageFailure(), {
    first_item: "inserted",
    second_item: "retryable_error",
    checkpoint_advances: false,
    next_attempt_first_item: "duplicate_noop",
  });
});

Deno.test("exact candidate produces deterministic 30-case pass report", async () => {
  const first = await createConformanceReport(BUNDLE_PATH);
  const second = await createConformanceReport(BUNDLE_PATH);
  strictEqual(first.failures.length, 0);
  strictEqual(second.failures.length, 0);
  strictEqual(toHex(first.reportBytes), toHex(second.reportBytes));
  strictEqual(first.report.bundle_sha256, PINNED_VECTOR_SHA256);
  strictEqual(first.report.status, "pass");
  const cases = asArray(first.report.cases, "report.cases")
    .map((value) => asObject(value, "report case"));
  strictEqual(cases.length, 30);
  deepStrictEqual(
    cases.map((value) => asString(value.case_id, "case_id")),
    EXPECTED_CASE_ORDER,
  );

  const classes = [
    ...new Set(
      cases.flatMap((value) =>
        asArray(value.case_classes, "case_classes")
          .map((item) => asString(item, "case class"))
      ),
    ),
  ].sort();
  deepStrictEqual(classes, EXPECTED_CLASSES);
  deepStrictEqual(
    stringArray(
      reportCase(first.report, "canonical_envelopes/reference-settled")
        .case_classes,
    ),
    ["canonical_envelope", "capture_gap_derivation"],
  );
  deepStrictEqual(
    stringArray(
      reportCase(first.report, "replay/same-identity-same-hash")
        .case_classes,
    ),
    ["checkpoint_commit", "duplicate_noop"],
  );
});

Deno.test("canonical cases preserve mapping, Gap, provenance and exclusions", async () => {
  const run = await createConformanceReport(BUNDLE_PATH);
  const settledCase = reportCase(
    run.report,
    "canonical_envelopes/reference-settled",
  );
  strictEqual(
    settledCase.result_sha256,
    "sha256:0d11f98f981427b7bcf175e82294511ca42981c0ecea8e02f841c3777743d1d2",
  );
  const envelope = asObject(
    parseStrictJsonBytes(resultBytes(settledCase)),
    "settled Envelope hash input",
  );
  const time = asObject(envelope.time, "time");
  deepStrictEqual(Object.keys(time).sort(), ["occurred_at", "terminal_at"]);
  strictEqual(time.occurred_at, time.terminal_at);
  const integrity = asObject(envelope.integrity, "integrity");
  deepStrictEqual(Object.keys(integrity), ["source_hash"]);
  strictEqual(
    integrity.source_hash,
    "sha256:5e9eda0a2630d52c5589d38b8ec480604c47c2cc77391b75a57b2a159db6dd27",
  );

  const payload = asObject(envelope.payload, "payload");
  const gaps = asArray(payload.capture_gaps, "payload.capture_gaps")
    .map((value) => asObject(value, "Capture Gap"));
  deepStrictEqual(
    gaps.map((gap) => gap.affected_claim),
    [
      "call_log",
      "client_ip_presence",
      "request_trace",
      "upstream_error_presence",
    ],
  );
  for (const gap of gaps) {
    strictEqual(gap.parent_event_id, envelope.event_id);
    strictEqual(gap.observed_at, time.terminal_at);
    strictEqual(gap.payload_capture_mode, "none");
    strictEqual(
      asObject(gap.field_provenance, "field_provenance").observed_at,
      "derived",
    );
  }
  assertAbsentRecursively(
    envelope,
    new Set([
      "delivery_cursor",
      "high_watermark",
      "page_time",
      "retry_state",
      "ingestion_time",
      "source_watermark",
      "import_watermark",
    ]),
  );
});

Deno.test("each section emits the addendum's exact result bytes", async () => {
  const run = await createConformanceReport(BUNDLE_PATH);
  strictEqual(
    resultBytesHex(run, "idempotency/absent-tenant-settled"),
    "666f6967656e742e6576656e742d6964656d706f74656e63792e7631" +
      "00000009756e69726f75746572" +
      "00000015756e69726f757465722d646576656c6f706d656e74" +
      "00000000" +
      "00000003313031" +
      "00000003323032" +
      "000000176d6f64656c2e726571756573742e636f6d706c65746564" +
      "000000137265715f666565645f76315f736574746c6564",
  );
  assertCanonicalResult(
    run.report,
    "decimal_strings/max-int64",
    { valid: true, value: "9223372036854775807" },
  );
  assertCanonicalResult(
    run.report,
    "timestamps/sub-microsecond-loss",
    { error_code: "timestamp_precision_loss", valid: false },
  );
  assertCanonicalResult(
    run.report,
    "unicode/protocol-non-nfc",
    { valid: false },
  );
  assertCanonicalResult(
    run.report,
    "unicode/opaque-non-nfc",
    { utf8_hex: "7265715f65cc81", valid: true },
  );
  assertCanonicalResult(
    run.report,
    "strict_json/nested-duplicate-key",
    { error_code: "duplicate_json_key", valid: false },
  );
  assertCanonicalResult(
    run.report,
    "replay/partial-page-failure",
    {
      first_item: "inserted",
      second_item: "retryable_error",
      checkpoint_advances: false,
      next_attempt_first_item: "duplicate_noop",
    },
  );
  assertCanonicalResult(
    run.report,
    "negative_source_seeds/cursor-expired",
    {
      error_version: "foigent.connector-error.v1",
      category: "cursor",
      code: "completed_execution_feed.cursor_expired",
      phase: "fetch",
      operation: "fetch_page",
      retryable: false,
      safe_message: "Cursor is outside the retained replay window",
      recovery: "operator_repair",
    },
  );
  assertCanonicalResult(
    run.report,
    "negative_source_seeds/privacy-redaction-rejected",
    {
      error_version: "foigent.connector-error.v1",
      category: "privacy",
      code: "prohibited_raw_field",
      phase: "validate",
      operation: "map_source_snapshot",
      retryable: false,
      safe_message: "Source payload contains a prohibited raw field",
      recovery: "operator_repair",
    },
  );
});

const EXPECTED_CASE_ORDER = [
  "canonical_envelopes/reference-settled",
  "canonical_envelopes/reference-cancelled",
  "idempotency/absent-tenant-settled",
  "idempotency/absent-tenant-cancelled",
  "idempotency/present-tenant",
  "idempotency/opaque-non-nfc-event-id",
  "decimal_strings/zero",
  "decimal_strings/max-safe-integer",
  "decimal_strings/above-safe-integer",
  "decimal_strings/max-int64",
  "decimal_strings/leading-zero",
  "decimal_strings/negative",
  "decimal_strings/overflow-int64",
  "decimal_strings/decimal-point",
  "decimal_strings/exponent",
  "decimal_strings/whitespace",
  "timestamps/whole-second",
  "timestamps/offset-to-utc",
  "timestamps/nonzero-microsecond",
  "timestamps/sub-microsecond-loss",
  "timestamps/missing-zone",
  "unicode/protocol-nfc",
  "unicode/protocol-non-nfc",
  "unicode/opaque-non-nfc",
  "strict_json/nested-duplicate-key",
  "replay/same-identity-same-hash",
  "replay/same-identity-different-hash",
  "replay/partial-page-failure",
  "negative_source_seeds/privacy-redaction-rejected",
  "negative_source_seeds/cursor-expired",
];

const EXPECTED_CLASSES = [
  "canonical_envelope",
  "capture_gap_derivation",
  "checkpoint_commit",
  "content_conflict",
  "cursor_error",
  "decimal_boundary",
  "duplicate_key_rejection",
  "duplicate_noop",
  "opaque_utf8_preservation",
  "partial_page_replay",
  "privacy_rejection",
  "protocol_nfc_rejection",
  "scoped_idempotency",
  "timestamp_normalization",
];

function reportCase(report: JsonObject, caseId: string): JsonObject {
  const result = asArray(report.cases, "report.cases")
    .map((value) => asObject(value, "report case"))
    .find((value) => asString(value.case_id, "case_id") === caseId);
  if (result === undefined) {
    throw new Error(`missing report case ${caseId}`);
  }
  return result;
}

function resultBytes(reportCaseValue: JsonObject): Uint8Array {
  return new Uint8Array(
    Buffer.from(asString(reportCaseValue.result_base64, "result_base64"), "base64"),
  );
}

function assertCanonicalResult(
  report: JsonObject,
  caseId: string,
  expected: JsonObject,
): void {
  const bytes = resultBytes(reportCase(report, caseId));
  strictEqual(new TextDecoder().decode(bytes), canonicalize(expected));
}

function stringArray(value: JsonValue | undefined): string[] {
  return asArray(value, "string array")
    .map((item) => asString(item, "string array item"));
}

function assertAbsentRecursively(
  value: JsonValue,
  prohibited: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => assertAbsentRecursively(item, prohibited));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    strictEqual(prohibited.has(key), false, `prohibited field ${key}`);
    assertAbsentRecursively(child, prohibited);
  }
}

function expectStrictJsonError(operation: () => unknown): StrictJsonError {
  try {
    operation();
  } catch (error) {
    if (error instanceof StrictJsonError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected StrictJsonError");
}
