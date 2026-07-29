import {
  canonicalBytes,
  DEFAULT_LIMITS,
  JsonObject,
  JsonValue,
  parseStrictJson,
  sha256,
} from "../src/canonical/json.ts";
import {
  isNfc,
  isValidInt64Decimal,
  normalizeMicrosecondTimestamp,
} from "../src/canonical/core.ts";
import {
  loadCompatibilityCatalog,
  validateCompatibilityPin,
  validateReleasedSourceRevision,
} from "../src/compatibility/catalog.ts";
import { planSteadyPage } from "../src/experimental/page_plan.ts";
import {
  parseBatch,
  parseCheckpoint,
  parseConnectorError,
  parseEnvelope,
  parseEnvelopeHashInput,
  parseLifecycle,
  parseOperationalReceipt,
  PayloadValidator,
} from "../src/protocol/v2_candidate.ts";
import { buildReport, marshalReport } from "../src/testkit/report.ts";
import { ReplayLedger } from "../src/testkit/replay.ts";

const protocolRoot = `${Deno.cwd().replace(/\/+$/, "")}/../..`;
const payloadValidator: PayloadValidator = Object.freeze({
  validatePinned(
    schemaRef: string,
    schemaVersion: string,
    canonicalPayload: Uint8Array,
  ): string {
    assert(canonicalPayload.byteLength > 0, "payload must not be empty");
    switch (`${schemaRef}@${schemaVersion}`) {
      case "foigent://events/model/request-completed/v1@1":
        return "sha256:ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6";
      case "foigent://events/model/request-completed/v2@2":
        return "sha256:75e5af3fe8a433054988c6afa3faf5a9a9fbe03a300c8d1d5a869912ecd9154e";
      default:
        throw new Error(`schema is not pinned: ${schemaRef}@${schemaVersion}`);
    }
  },
});

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
    const [input, expected] of [
      ["1.0", "1"],
      ["1e2", "100"],
      ["1.5e1", "15"],
    ] as const
  ) {
    equal(
      new TextDecoder().decode(canonicalBytes(parseStrictJson(input))),
      expected,
    );
  }
  for (
    const input of [
      "1.5",
      "1.0000000000000001",
      "9007199254740992",
      "-9007199254740992",
    ]
  ) {
    throws(() => parseStrictJson(input));
  }
  equal(
    new TextDecoder().decode(
      canonicalBytes(parseStrictJson(`{"":2,"😀":1}`)),
    ),
    `{"😀":1,"":2}`,
  );
  const frozen = parseStrictJson(`{"nested":[1]}`) as JsonObject;
  assert(Object.isFrozen(frozen));
  assert(Object.isFrozen(frozen.nested));
  throws(() => {
    (frozen as { nested: JsonObject["nested"] }).nested = [];
  });
});

Deno.test("candidate wire boundary vectors", async () => {
  const vectors = JSON.parse(
    await Deno.readTextFile(
      `${protocolRoot}/sdk/candidate-wire-boundary-vectors.v1.json`,
    ),
  ) as {
    number_profile: {
      cases: {
        case_id: string;
        input: string;
        expected: "canonical" | "reject";
        canonical?: string;
      }[];
    };
    timestamp_profile: {
      cases: {
        case_id: string;
        input: string;
        expected: "normalized" | "reject";
        normalized?: string;
        error_code?: string;
      }[];
    };
  };
  for (const testCase of vectors.number_profile.cases) {
    if (testCase.expected === "reject") {
      throws(() => parseStrictJson(testCase.input));
    } else {
      equal(
        new TextDecoder().decode(
          canonicalBytes(parseStrictJson(testCase.input)),
        ),
        testCase.canonical,
      );
    }
  }
  for (const testCase of vectors.timestamp_profile.cases) {
    const result = normalizeMicrosecondTimestamp(testCase.input);
    if (testCase.expected === "reject") {
      equal(result.errorCode, testCase.error_code);
    } else {
      equal(result.normalized, testCase.normalized);
    }
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
    ).normalized,
    "0000-01-01T00:00:00.000000Z",
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
    const parsed = parseEnvelopeHashInput(
      input,
      DEFAULT_LIMITS,
      payloadValidator,
    );
    assert(Object.isFrozen(parsed));
    const leaked = parsed.canonicalBytes();
    leaked[0] = (leaked[0] ?? 0) ^ 0xff;
    assert(
      leaked[0] !== parsed.canonicalBytes()[0],
      "validated result leaked canonical byte backing storage",
    );
    const value = JSON.parse(new TextDecoder().decode(input)) as {
      [key: string]: JsonValue;
      integrity: { [key: string]: JsonValue };
    };
    const hashInput = canonicalBytes(value);
    value.integrity.envelope_hash = sha256(hashInput);
    const finalBytes = canonicalBytes(value);
    parseEnvelope(finalBytes, DEFAULT_LIMITS, payloadValidator);
    finalEnvelope ||= new TextDecoder().decode(finalBytes);
  }
  parseBatch(
    new TextEncoder().encode(
      `{"batch_version":"foigent.event-batch.v1","connector_id":"foigent.unirouter.completed-execution","connector_version":"1.0.0","producer_instance":"unirouter-development","generated_at":"2026-01-01T00:00:00.000000Z","events":[${finalEnvelope}],"next_cursor":"11","high_watermark":"20","has_more":false}`,
    ),
    DEFAULT_LIMITS,
    payloadValidator,
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
  parseEnvelopeHashInput(
    new TextEncoder().encode(exponent),
    DEFAULT_LIMITS,
    payloadValidator,
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
    updatedAt: "2026-01-01T00:00:00.000000Z",
  };
  const page = {
    connectorId: current.connectorId,
    connectorVersion: current.connectorVersion,
    producerInstance: current.producerInstance,
    eventCount: 2,
    nextCursor: "11",
    highWatermark: "20",
    hasMore: false,
  };
  const plan = planSteadyPage(
    current,
    page,
    ["inserted", "duplicate_noop"],
    "2026-01-01T00:00:01.000000Z",
  );
  equal(plan.candidateCheckpoint.cursor, "11");
  assert(Object.isFrozen(plan));
  assert(Object.isFrozen(plan.outcomes));
  throws(() =>
    planSteadyPage(
      current,
      { ...page, nextCursor: "10", hasMore: true },
      ["inserted", "duplicate_noop"],
      "2026-01-01T00:00:01.000000Z",
    )
  );
  throws(() =>
    planSteadyPage(
      current,
      { ...page, eventCount: 0, nextCursor: "11" },
      [],
      "2026-01-01T00:00:01.000000Z",
    )
  );
  throws(() =>
    planSteadyPage(
      current,
      { ...page, eventCount: 1 },
      ["conflict"],
      "2026-01-01T00:00:01.000000Z",
    )
  );
});

Deno.test("digest-pinned compatibility catalog fails closed", async () => {
  const catalog = loadCompatibilityCatalog(
    await Deno.readFile(
      `${protocolRoot}/sdk/compatibility-catalog.v1.json`,
    ),
  );
  assert(Object.isFrozen(catalog));
  assert(Object.isFrozen(catalog.pins));
  assert(Object.isFrozen(catalog.pins[0]));
  for (const pin of catalog.pins) {
    validateCompatibilityPin(catalog, pin);
  }
  throws(() =>
    validateCompatibilityPin(catalog, {
      ...catalog.pins[0]!,
      protocolVersion: "latest",
    })
  );
  const bytes = await Deno.readFile(
    `${protocolRoot}/sdk/compatibility-catalog.v1.json`,
  );
  const tampered = bytes.slice();
  const tamperIndex = tampered.length - 2;
  tampered[tamperIndex] = (tampered[tamperIndex] ?? 0) ^ 1;
  throws(() => loadCompatibilityCatalog(tampered));
  validateReleasedSourceRevision("1");
  throws(() => validateReleasedSourceRevision("2"));
});

Deno.test("pinned payload validator is mandatory", async () => {
  const input = await Deno.readFile(
    `${protocolRoot}/fixtures/shared/settled-envelope.hash-input.json`,
  );
  throws(() =>
    parseEnvelopeHashInput(
      input,
      DEFAULT_LIMITS,
      undefined as unknown as PayloadValidator,
    )
  );
  throws(() =>
    parseEnvelopeHashInput(input, DEFAULT_LIMITS, {
      validatePinned: () => "not-a-digest",
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
