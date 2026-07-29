import {
  canonicalBytes,
  DEFAULT_LIMITS,
  JsonObject,
  parseStrictJson,
  parseStrictJsonBytes,
  sha256,
} from "../src/canonical/json.ts";
import {
  isNfc,
  isValidInt64Decimal,
  normalizeMicrosecondTimestamp,
} from "../src/canonical/core.ts";
import { planSteadyPage, ReplayLedger } from "../src/kernel/kernel.ts";
import {
  parseBatch,
  parseCheckpoint,
  parseConnectorError,
  parseEnvelope,
  parseEnvelopeHashInput,
  parseLifecycle,
  parseManifest,
  parseOperationalReceipt,
  SUPPORTED_COMPATIBILITY_PINS,
  validateCompatibilityPin,
  validateReleasedSourceRevision,
} from "../src/protocol/protocol.ts";
import { buildReport, marshalReport } from "../src/testkit/report.ts";

const protocolRoot = `${Deno.cwd().replace(/\/+$/, "")}/../..`;

Deno.test("frozen canonical and identity vectors", async () => {
  const report = await buildReport(protocolRoot, (path) => Deno.readFile(path));
  equal(report.cases.length, 12);
  const bytes = marshalReport(report);
  assert(bytes.byteLength > 100);
});

Deno.test("strict JSON limits and canonical profile", () => {
  for (
    const input of [
      `{"a":1,"a":2}`,
      `{"a":{"\\u0062":1,"b":2}}`,
      `{"x":"\\ud800"}`,
    ]
  ) {
    throws(() => parseStrictJson(input));
  }
  throws(() =>
    parseStrictJson("[[[0]]]", {
      maxBytes: 32,
      maxDepth: 2,
    })
  );
  throws(() =>
    parseStrictJson(`{"abcdef":1}`, {
      maxBytes: 8,
      maxDepth: 4,
    })
  );
  for (
    const input of ["1.0", "1e2", "9007199254740992", "-9007199254740992"]
  ) {
    throws(() => parseStrictJson(input));
  }
  equal(
    new TextDecoder().decode(
      canonicalBytes(parseStrictJson(`{"":2,"😀":1}`)),
    ),
    `{"😀":1,"":2}`,
  );
});

Deno.test("candidate negative vectors", async () => {
  const vectors = JSON.parse(
    await Deno.readTextFile(
      `${protocolRoot}/sdk/candidate-negative-vectors.v1.json`,
    ),
  ) as {
    strict_json: { case_id: string; input: string }[];
    timestamps: {
      case_id: string;
      input: string;
      expected_error: string;
    }[];
  };
  for (const testCase of vectors.strict_json) {
    throws(() => parseStrictJson(testCase.input));
  }
  for (const testCase of vectors.timestamps) {
    equal(
      normalizeMicrosecondTimestamp(testCase.input).errorCode,
      testCase.expected_error,
    );
  }
});

Deno.test("time decimal and NFC profiles", () => {
  equal(
    normalizeMicrosecondTimestamp(
      "2026-01-02T03:04:05.123456+08:00",
    ).normalized,
    "2026-01-01T19:04:05.123456Z",
  );
  equal(
    normalizeMicrosecondTimestamp(
      "2026-01-02T03:04:05.1234567Z",
    ).errorCode,
    "timestamp_precision_loss",
  );
  equal(
    normalizeMicrosecondTimestamp(
      "0000-01-01T00:00:00.000000Z",
    ).errorCode,
    "invalid_timestamp",
  );
  assert(isValidInt64Decimal("9223372036854775807"));
  assert(!isValidInt64Decimal("9223372036854775808"));
  assert(!isNfc("e\u0301"));
});

Deno.test("released hash inputs and final Envelopes", async () => {
  let finalEnvelope = "";
  for (
    const relative of [
      "fixtures/shared/settled-envelope.hash-input.json",
      "fixtures/shared/cancelled-envelope.hash-input.json",
      "fixtures/shared/litellm-succeeded-envelope.hash-input.json",
      "fixtures/shared/litellm-failed-envelope.hash-input.json",
      "fixtures/shared/litellm-cache-hit-envelope.hash-input.json",
    ]
  ) {
    const input = await Deno.readFile(`${protocolRoot}/${relative}`);
    parseEnvelopeHashInput(input, DEFAULT_LIMITS);
    const value = parseStrictJsonBytes(input) as JsonObject;
    const hashInput = canonicalBytes(value);
    const integrity = value.integrity as JsonObject;
    integrity.envelope_hash = sha256(hashInput);
    const finalBytes = canonicalBytes(value);
    parseEnvelope(finalBytes, DEFAULT_LIMITS);
    finalEnvelope ||= new TextDecoder().decode(finalBytes);
  }
  parseBatch(
    new TextEncoder().encode(
      `{"batch_version":"foigent.event-batch.v1","connector_id":"foigent.unirouter.completed-execution","connector_version":"1.0.0","producer_instance":"unirouter-development","generated_at":"2026-01-01T00:00:00.000000Z","events":[${finalEnvelope}],"next_cursor":"11","high_watermark":"20","has_more":false}`,
    ),
    DEFAULT_LIMITS,
  );
});

Deno.test("wire parsers apply candidate safe-integer profile", async () => {
  const input = new TextDecoder().decode(
    await Deno.readFile(
      `${protocolRoot}/fixtures/shared/settled-envelope.hash-input.json`,
    ),
  );
  const exponent = input.replace(
    `"amount_scale": 1000000`,
    `"amount_scale": 1e6`,
  );
  assert(exponent !== input, "test setup did not replace amount_scale");
  throws(() =>
    parseEnvelopeHashInput(
      new TextEncoder().encode(exponent),
      DEFAULT_LIMITS,
    )
  );

  throws(() =>
    parseOperationalReceipt(
      new TextEncoder().encode(
        `{"receipt_version":"foigent.operational-receipt.v1","operation_id":"op-1","connector_id":"foigent.example.source","producer_instance":"instance","operation":"commit_page","status":"completed","counts":{"received":9007199254740992,"inserted":0,"duplicate_noop":0,"conflict":0,"rejected":0},"checkpoint_before":"10","checkpoint_after":"10","observed_at":"2026-01-01T00:00:01.000000Z"}`,
      ),
      DEFAULT_LIMITS,
    )
  );
});

Deno.test("released Connector Manifests", async () => {
  for (
    const relative of [
      "manifests/foigent.unirouter.completed-execution-1.0.0.json",
      "manifests/foigent.litellm.spend-logs-1.0.0.json",
    ]
  ) {
    parseManifest(
      await Deno.readFile(`${protocolRoot}/${relative}`),
      DEFAULT_LIMITS,
    );
  }
});

Deno.test("other protocol wire objects", () => {
  const checkpoint =
    `{"checkpoint_version":"foigent.connector-checkpoint.v1","connector_id":"foigent.example.source","connector_version":"1.0.0","producer_instance":"instance","cursor":"10","high_watermark":"20","phase":"steady","updated_at":"2026-01-01T00:00:00.000000Z"}`;
  parseCheckpoint(new TextEncoder().encode(checkpoint), DEFAULT_LIMITS);
  parseConnectorError(
    new TextEncoder().encode(
      `{"error_version":"foigent.connector-error.v1","category":"transport","code":"source.timeout","phase":"fetch","operation":"poll","retryable":true,"retry_after_seconds":10,"safe_message":"source temporarily unavailable","recovery":"automatic_retry"}`,
    ),
    DEFAULT_LIMITS,
  );
  parseLifecycle(
    new TextEncoder().encode(
      `{"lifecycle_version":"foigent.connector-lifecycle.v1","configuration":"configured","authentication":"valid","transport":"ready","processing":"idle","checkpoint":"steady","health":"healthy"}`,
    ),
    DEFAULT_LIMITS,
  );
  parseOperationalReceipt(
    new TextEncoder().encode(
      `{"receipt_version":"foigent.operational-receipt.v1","operation_id":"op-1","connector_id":"foigent.example.source","producer_instance":"instance","operation":"commit_page","status":"completed","counts":{"received":2,"inserted":1,"duplicate_noop":1,"conflict":0,"rejected":0},"checkpoint_before":"10","checkpoint_after":"11","observed_at":"2026-01-01T00:00:01.000000Z"}`,
    ),
    DEFAULT_LIMITS,
  );
  throws(() =>
    parseCheckpoint(
      new TextEncoder().encode(
        checkpoint.replace(
          `"phase":"steady"`,
          `"phase":"steady","unknown":true`,
        ),
      ),
      DEFAULT_LIMITS,
    )
  );
  validateReleasedSourceRevision("1");
  throws(() => validateReleasedSourceRevision("2"));
});

Deno.test("replay and steady-only checkpoint transition", () => {
  const ledger = new ReplayLedger();
  equal(ledger.classify("identity", "hash-a"), "inserted");
  equal(ledger.classify("identity", "hash-a"), "duplicate_noop");
  equal(ledger.classify("identity", "hash-b"), "conflict");

  const current = {
    connectorId: "foigent.example.source",
    connectorVersion: "1.0.0",
    producerInstance: "instance",
    cursor: "10",
    highWatermark: "20",
    phase: "steady" as const,
    updatedAt: "2026-01-01T00:00:00.000000Z",
  };
  const batch = {
    value: Object.create(null) as JsonObject,
    connectorId: current.connectorId,
    connectorVersion: current.connectorVersion,
    producerInstance: current.producerInstance,
    generatedAt: current.updatedAt,
    events: [{}, {}] as never[],
    nextCursor: "11",
    highWatermark: "20",
    hasMore: false,
  };
  const plan = planSteadyPage(
    current,
    batch,
    ["inserted", "duplicate_noop"],
    "2026-01-01T00:00:01.000000Z",
  );
  assert(plan.checkpointAdvances);
  equal(plan.candidateCheckpoint?.cursor, "11");
  throws(() =>
    planSteadyPage(
      current,
      { ...batch, nextCursor: "10", hasMore: true },
      ["inserted", "duplicate_noop"],
      "2026-01-01T00:00:01.000000Z",
    )
  );
  throws(() =>
    planSteadyPage(
      current,
      { ...batch, events: [], nextCursor: "11" },
      [],
      "2026-01-01T00:00:01.000000Z",
    )
  );
  throws(() =>
    planSteadyPage(
      current,
      { ...batch, events: [{}] as never[] },
      ["conflict"],
      "2026-01-01T00:00:01.000000Z",
    )
  );
  throws(() =>
    planSteadyPage(
      { ...current, phase: "bootstrap" },
      { ...batch, events: [{}] as never[] },
      ["inserted"],
      "2026-01-01T00:00:01.000000Z",
    )
  );
});

Deno.test("compatibility matrix fails closed", () => {
  assert(Object.isFrozen(SUPPORTED_COMPATIBILITY_PINS));
  assert(Object.isFrozen(SUPPORTED_COMPATIBILITY_PINS[0]));
  const original = { ...SUPPORTED_COMPATIBILITY_PINS[0]! };
  throws(() => {
    (SUPPORTED_COMPATIBILITY_PINS[0] as {
      protocolVersion: string;
    }).protocolVersion = "latest";
  });
  validateCompatibilityPin(original);
  for (const pin of SUPPORTED_COMPATIBILITY_PINS) {
    validateCompatibilityPin(pin);
  }
  throws(() =>
    validateCompatibilityPin({
      ...SUPPORTED_COMPATIBILITY_PINS[0]!,
      protocolVersion: "latest",
    })
  );
});

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

function throws(callback: () => unknown): void {
  let thrown = false;
  try {
    callback();
  } catch {
    thrown = true;
  }
  if (!thrown) {
    throw new Error("expected callback to throw");
  }
}
