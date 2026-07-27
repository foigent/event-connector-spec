import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  asArray,
  asBoolean,
  asObject,
  asSafeInteger,
  assertExactKeys,
  asString,
  canonicalBytes,
  canonicalize,
  equalBytes,
  fromHex,
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
  classifyCursorError,
  ConnectorFailure,
  envelopeCanonicalBytes,
  IdempotencyInput,
  idempotencyKey,
  MappingContext,
  mapReferenceSource,
  mapSourceOrThrow,
  normalizeMicrosecondTimestamp,
  opaqueUtf8Hex,
  protocolControlledNfc,
  validateFinalReferenceEnvelope,
  validInt64Decimal,
} from "./protocol.ts";
import {
  observePartialPageFailure,
  observeSameIdentityDifferentHash,
  observeSameIdentitySameHash,
} from "./replay.ts";

export const PINNED_CANDIDATE_COMMIT = "f737ca27ebd27342d9a8dc421a44507b5a2a60d8";
export const PINNED_PRECISION_ADDENDUM = "30a2abeb4877253557aaa9d9cbd5a6400eb9c6c3";
export const PINNED_ORDER_ADDENDUM = "191411618714957accbdf0124b64c800e3ae1a4f";
export const PINNED_VECTOR_SHA256 =
  "sha256:50fc8e8be08c37381611d6423e29780894741fb108fc4569df7c895452e5d4db";
export const PINNED_GOLDEN_SHA256 =
  "sha256:e71eef0cc0a3388d5563eeda0c178b751af34bd856f0bdc2b7dc85b00df75a86";
export const PINNED_CONTRACT_SHA256 =
  "sha256:f3ae834265170ff22088943283fd23dcb562bc2308571ccc722414c2c896dc23";
export const PINNED_REPORT_SCHEMA_SHA256 =
  "sha256:42048fbf5a5edc2ca4476727563ab41e96a8fb6d3788d446e0e0d7c4154a31a7";

const IMPLEMENTATION_VERSION = "1.0.0+independent.1";
const REPORT_VERSION = "foigent.conformance-report.v1";

export class ArtifactFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactFailure";
  }
}

export interface ConformanceRun {
  report: JsonObject;
  reportBytes: Uint8Array;
  failures: string[];
}

interface Evaluation {
  resultBytes: Uint8Array;
  failures: string[];
}

interface EvaluationContext {
  root: string;
  mapping: MappingContext;
  golden: JsonObject;
}

export async function createConformanceReport(
  bundlePath: string,
): Promise<ConformanceRun> {
  const absoluteBundlePath = resolve(bundlePath);
  const root = dirname(dirname(absoluteBundlePath));
  const bundleBytes = await readFile(absoluteBundlePath, "canonical bundle");
  requireDigest(bundleBytes, PINNED_VECTOR_SHA256, "canonical bundle");
  const bundle = parseArtifact(bundleBytes, "canonical bundle");
  validateBundleHeader(bundle);

  const contract = await readPinnedArtifact(
    root,
    "conformance/conformance-contract.v1.json",
    PINNED_CONTRACT_SHA256,
    "conformance contract",
  );
  validateContractHeader(contract);
  const reportSchema = await readPinnedArtifact(
    root,
    "schemas/conformance-report.v1.schema.json",
    PINNED_REPORT_SCHEMA_SHA256,
    "conformance report Schema",
  );
  requireExact(
    reportSchema.$id,
    "foigent://schemas/conformance-report/v1",
    "conformance report Schema $id",
  );

  const goldenPath = asString(
    bundle.golden_fixture_bundle_path,
    "bundle.golden_fixture_bundle_path",
  );
  const golden = await readPinnedArtifact(
    root,
    goldenPath,
    PINNED_GOLDEN_SHA256,
    "Golden fixture bundle",
  );
  validateGoldenHeader(golden);
  const mapping = mappingContext(bundle.reference_mapping_context);
  const context: EvaluationContext = { root, mapping, golden };

  const cases: JsonValue[] = [];
  const allFailures: string[] = [];
  const observedClasses = new Set<string>();
  const observedCaseIds = new Set<string>();
  const caseContracts = asArray(
    contract.case_contract,
    "contract.case_contract",
  );

  for (const rawContract of caseContracts) {
    const caseContract = asObject(rawContract, "contract.case_contract[]");
    const section = asString(
      caseContract.vector_section,
      "case_contract.vector_section",
    );
    requireExact(
      caseContract.case_id_pattern,
      `${section}/<case_id>`,
      `case_contract ${section} pattern`,
    );
    const vectors = vectorsForSection(section, bundle, golden);
    for (const rawVector of vectors) {
      const vector = asObject(rawVector, `${section} vector`);
      const sourceCaseId = asString(vector.case_id, `${section}.case_id`);
      const fullCaseId = `${section}/${sourceCaseId}`;
      if (fullCaseId.length > 160 || observedCaseIds.has(fullCaseId)) {
        throw new ArtifactFailure(
          `${fullCaseId}: duplicate or oversized report case ID`,
        );
      }
      observedCaseIds.add(fullCaseId);
      const caseClasses = classesForCase(caseContract, vector);
      caseClasses.forEach((caseClass) => observedClasses.add(caseClass));
      const resultKind = resultKindForCase(caseContract);
      const evaluation = await evaluateSection(
        section,
        vector,
        context,
      );
      const caseFailures = evaluation.failures.map((failure) =>
        `${fullCaseId}: ${failure}`
      );
      allFailures.push(...caseFailures);
      const status = caseFailures.length === 0 ? "pass" : "fail";
      const reportCase: JsonObject = {
        case_id: fullCaseId,
        case_classes: caseClasses,
        status,
        result_kind: resultKind,
        result_base64: toBase64(evaluation.resultBytes),
        result_sha256: sha256(evaluation.resultBytes),
      };
      if (caseFailures.length > 0) {
        reportCase.failure_message = boundedFailureMessage(caseFailures);
      }
      cases.push(reportCase);
    }
  }

  validateClassCoverage(contract, observedClasses);
  const report: JsonObject = {
    report_version: REPORT_VERSION,
    implementation: "typescript",
    implementation_version: IMPLEMENTATION_VERSION,
    bundle_sha256: PINNED_VECTOR_SHA256,
    status: allFailures.length === 0 ? "pass" : "fail",
    cases,
  };
  validateReport(report);
  return {
    report,
    reportBytes: canonicalBytes(report),
    failures: allFailures,
  };
}

export function validateReport(report: JsonObject): void {
  assertExactKeys(
    report,
    [
      "report_version",
      "implementation",
      "implementation_version",
      "bundle_sha256",
      "status",
      "cases",
    ],
    [],
    "conformance report",
  );
  requireExact(report.report_version, REPORT_VERSION, "report_version");
  requireExact(report.implementation, "typescript", "implementation");
  const implementationVersion = asString(
    report.implementation_version,
    "implementation_version",
  );
  if (
    implementationVersion.length === 0 || implementationVersion.length > 120
  ) {
    throw new ArtifactFailure("implementation_version is outside Schema bounds");
  }
  requireExact(report.bundle_sha256, PINNED_VECTOR_SHA256, "bundle_sha256");
  const reportStatus = asString(report.status, "report.status");
  if (reportStatus !== "pass" && reportStatus !== "fail") {
    throw new ArtifactFailure("report.status is invalid");
  }
  const cases = asArray(report.cases, "report.cases");
  if (cases.length === 0) {
    throw new ArtifactFailure("report.cases must not be empty");
  }
  let hasFailure = false;
  const caseIds = new Set<string>();
  for (const [index, rawCase] of cases.entries()) {
    const reportCase = asObject(rawCase, `report.cases[${index}]`);
    assertExactKeys(
      reportCase,
      [
        "case_id",
        "case_classes",
        "status",
        "result_kind",
        "result_base64",
        "result_sha256",
      ],
      ["failure_message"],
      `report.cases[${index}]`,
    );
    const caseId = asString(reportCase.case_id, "report case_id");
    if (
      caseId.length === 0 || caseId.length > 160 || caseIds.has(caseId)
    ) {
      throw new ArtifactFailure(`${caseId}: invalid or duplicate case ID`);
    }
    caseIds.add(caseId);
    const classes = asArray(reportCase.case_classes, `${caseId}.case_classes`)
      .map((value) => asString(value, `${caseId}.case_classes[]`));
    if (
      classes.length === 0 ||
      classes.some((value) => !/^[a-z][a-z0-9_]*$/.test(value) || value.length > 80) ||
      canonicalize(classes as JsonValue) !==
        canonicalize(sortedUnique(classes) as JsonValue)
    ) {
      throw new ArtifactFailure(`${caseId}: case_classes are not sorted unique`);
    }
    const caseStatus = asString(reportCase.status, `${caseId}.status`);
    if (caseStatus !== "pass" && caseStatus !== "fail") {
      throw new ArtifactFailure(`${caseId}: invalid status`);
    }
    const resultKind = asString(
      reportCase.result_kind,
      `${caseId}.result_kind`,
    );
    if (
      !["bytes", "classification", "error", "state_transition"].includes(
        resultKind,
      )
    ) {
      throw new ArtifactFailure(`${caseId}: invalid result_kind`);
    }
    const base64 = asString(
      reportCase.result_base64,
      `${caseId}.result_base64`,
    );
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new ArtifactFailure(`${caseId}: invalid result_base64`);
    }
    const resultBytes = decodeBase64(base64, caseId);
    requireExact(
      reportCase.result_sha256,
      sha256(resultBytes),
      `${caseId}.result_sha256`,
    );
    if (caseStatus === "pass" && reportCase.failure_message !== undefined) {
      throw new ArtifactFailure(`${caseId}: passing case has failure_message`);
    }
    if (reportCase.failure_message !== undefined) {
      const message = asString(
        reportCase.failure_message,
        `${caseId}.failure_message`,
      );
      if (message.length > 512) {
        throw new ArtifactFailure(`${caseId}: failure_message is too long`);
      }
    }
    hasFailure ||= caseStatus === "fail";
  }
  if ((reportStatus === "fail") !== hasFailure) {
    throw new ArtifactFailure("report status does not match case statuses");
  }
}

async function evaluateSection(
  section: string,
  vector: JsonObject,
  context: EvaluationContext,
): Promise<Evaluation> {
  switch (section) {
    case "canonical_envelopes":
      return await evaluateCanonicalEnvelope(vector, context);
    case "idempotency":
      return evaluateIdempotency(vector);
    case "decimal_strings":
      return evaluateDecimal(vector);
    case "timestamps":
      return evaluateTimestamp(vector);
    case "unicode":
      return evaluateUnicode(vector);
    case "strict_json":
      return evaluateStrictJson(vector);
    case "replay":
      return evaluateReplay(vector);
    case "negative_source_seeds":
      return await evaluateNegativeSource(vector, context);
    default:
      throw new ArtifactFailure(`Unsupported vector section ${section}`);
  }
}

async function evaluateCanonicalEnvelope(
  vector: JsonObject,
  context: EvaluationContext,
): Promise<Evaluation> {
  const failures: string[] = [];
  const caseId = asString(vector.case_id, "canonical case_id");
  const goldenCase = goldenCaseById(context.golden, caseId);
  const sourcePath = asString(
    vector.source_input_path,
    `${caseId}.source_input_path`,
  );
  const sourceFixture = asObject(
    goldenCase.source_fixture,
    `${caseId}.source_fixture`,
  );
  checkEqual(
    failures,
    sourcePath,
    asString(sourceFixture.release_path, `${caseId}.release_path`),
    "Source release path",
  );
  const sourceBytes = await readRootFile(
    context.root,
    sourcePath,
    `${caseId} Source fixture`,
  );
  const sourceDigest = sha256(sourceBytes);
  checkEqual(
    failures,
    sourceDigest,
    asString(sourceFixture.sha256, `${caseId}.source sha256`),
    "Source exact-byte SHA-256",
  );

  const inputPath = asString(vector.input_path, `${caseId}.input_path`);
  const sharedFixture = asObject(
    goldenCase.shared_hash_input,
    `${caseId}.shared_hash_input`,
  );
  checkEqual(
    failures,
    inputPath,
    asString(sharedFixture.path, `${caseId}.shared path`),
    "shared hash-input path",
  );
  requireExact(
    sharedFixture.envelope_hash_field,
    "absent",
    `${caseId}.envelope_hash_field`,
  );
  const expectedBytes = await readRootFile(
    context.root,
    inputPath,
    `${caseId} shared hash input`,
  );
  checkEqual(
    failures,
    sha256(expectedBytes),
    asString(sharedFixture.file_sha256, `${caseId}.shared file SHA-256`),
    "shared hash-input file SHA-256",
  );
  const expectedEnvelope = parseArtifact(
    expectedBytes,
    `${caseId} shared hash input`,
  );
  const mappedEnvelope = mapReferenceSource(sourceBytes, context.mapping);
  const mappedCanonical = envelopeCanonicalBytes(mappedEnvelope);
  const expectedCanonical = envelopeCanonicalBytes(expectedEnvelope);
  checkBytes(
    failures,
    mappedCanonical,
    expectedCanonical,
    "complete Source-to-shared mapping",
  );

  const expectedLength = asSafeInteger(
    vector.canonical_bytes,
    `${caseId}.canonical_bytes`,
  );
  checkEqual(
    failures,
    mappedCanonical.length,
    expectedLength,
    "canonical byte length",
  );
  const envelopeHash = sha256(mappedCanonical);
  checkEqual(
    failures,
    envelopeHash,
    asString(vector.envelope_hash, `${caseId}.envelope_hash`),
    "Envelope hash",
  );
  const expected = asObject(goldenCase.expected, `${caseId}.expected`);
  checkEqual(
    failures,
    expectedLength,
    asSafeInteger(expected.canonical_bytes, `${caseId}.expected bytes`),
    "Golden canonical byte length",
  );
  checkEqual(
    failures,
    envelopeHash,
    asString(expected.envelope_hash, `${caseId}.Golden envelope hash`),
    "Golden Envelope hash",
  );
  const identity = asObject(mappedEnvelope.identity, `${caseId}.identity`);
  checkEqual(
    failures,
    asString(identity.idempotency_key, `${caseId}.idempotency_key`),
    asString(expected.idempotency_key, `${caseId}.Golden idempotency_key`),
    "Golden idempotency key",
  );
  const integrity = asObject(mappedEnvelope.integrity, `${caseId}.integrity`);
  checkEqual(
    failures,
    asString(integrity.source_hash, `${caseId}.source_hash`),
    sourceDigest,
    "mapped Source exact-byte hash",
  );

  const finalEnvelope: JsonObject = {
    ...mappedEnvelope,
    integrity: {
      ...integrity,
      envelope_hash: envelopeHash,
    },
  };
  validateFinalReferenceEnvelope(finalEnvelope);
  const finalPayload = asObject(finalEnvelope.payload, `${caseId}.payload`);
  const finalTerminal = asObject(
    finalPayload.terminal,
    `${caseId}.payload.terminal`,
  );
  checkEqual(
    failures,
    asString(finalTerminal.status, `${caseId}.terminal.status`),
    asString(expected.terminal_status, `${caseId}.terminal_status`),
    "Golden terminal status",
  );
  const gaps = asArray(
    finalPayload.capture_gaps,
    `${caseId}.capture_gaps`,
  );
  checkEqual(
    failures,
    gaps.length,
    asSafeInteger(expected.capture_gap_count, `${caseId}.gap count`),
    "Golden Capture Gap count",
  );

  const strippedEnvelope: JsonObject = {
    ...finalEnvelope,
    integrity: {
      source_hash: asString(integrity.source_hash, `${caseId}.source_hash`),
    },
  };
  checkBytes(
    failures,
    envelopeCanonicalBytes(strippedEnvelope),
    mappedCanonical,
    "post-validation hash-input reproduction",
  );
  return { resultBytes: mappedCanonical, failures };
}

function evaluateIdempotency(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  const input: IdempotencyInput = {
    producerProduct: asString(vector.producer_product, "producer_product"),
    producerInstance: asString(vector.producer_instance, "producer_instance"),
    tenantRef: nullableString(vector.tenant_ref, "tenant_ref"),
    orgRef: asString(vector.org_ref, "org_ref"),
    projectRef: asString(vector.project_ref, "project_ref"),
    eventType: asString(vector.event_type, "event_type"),
    eventId: asString(vector.event_id, "event_id"),
  };
  const identityBytes = buildIdempotencyInput(input);
  checkBytes(
    failures,
    identityBytes,
    fromHex(asString(vector.identity_input_hex, "identity_input_hex")),
    "full LP identity input",
  );
  checkEqual(
    failures,
    idempotencyKey(input),
    asString(vector.idempotency_key, "idempotency_key"),
    "scoped idempotency key",
  );
  if (vector.event_id_utf8_hex !== undefined) {
    checkEqual(
      failures,
      opaqueUtf8Hex(input.eventId),
      asString(vector.event_id_utf8_hex, "event_id_utf8_hex"),
      "opaque event_id UTF-8 bytes",
    );
  }
  return { resultBytes: identityBytes, failures };
}

function evaluateDecimal(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  const value = asString(vector.value, "decimal.value");
  const valid = validInt64Decimal(value);
  checkEqual(
    failures,
    valid,
    asBoolean(vector.valid_int64_counter, "valid_int64_counter"),
    "decimal int64 classification",
  );
  return {
    resultBytes: canonicalBytes({ valid, value }),
    failures,
  };
}

function evaluateTimestamp(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  const observed = normalizeMicrosecondTimestamp(
    asString(vector.input, "timestamp.input"),
  );
  const expectedValid = asBoolean(vector.valid, "timestamp.valid");
  checkEqual(
    failures,
    observed.valid,
    expectedValid,
    "timestamp validity",
  );
  let result: JsonObject;
  if (observed.valid) {
    const normalized = observed.normalized ?? "";
    checkEqual(
      failures,
      normalized,
      asString(vector.normalized, "timestamp.normalized"),
      "timestamp normalization",
    );
    result = { normalized, valid: true };
  } else {
    const errorCode = observed.error_code ?? "invalid_timestamp";
    checkEqual(
      failures,
      errorCode,
      asString(vector.error_code, "timestamp.error_code"),
      "timestamp error code",
    );
    result = { error_code: errorCode, valid: false };
  }
  return { resultBytes: canonicalBytes(result), failures };
}

function evaluateUnicode(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  const value = asString(vector.value, "unicode.value");
  const vectorClass = asString(vector.class, "unicode.class");
  const expectedValid = asBoolean(vector.valid, "unicode.valid");
  let result: JsonObject;
  if (vectorClass === "protocol_controlled") {
    const valid = protocolControlledNfc(value);
    checkEqual(
      failures,
      valid,
      expectedValid,
      "protocol-controlled NFC classification",
    );
    result = { valid };
  } else if (vectorClass === "source_opaque") {
    const utf8Hex = opaqueUtf8Hex(value);
    checkEqual(
      failures,
      utf8Hex,
      asString(vector.utf8_hex, "unicode.utf8_hex"),
      "opaque exact UTF-8 preservation",
    );
    checkEqual(
      failures,
      true,
      expectedValid,
      "opaque UTF-8 validity",
    );
    result = { utf8_hex: utf8Hex, valid: true };
  } else {
    throw new ArtifactFailure(`Unsupported unicode class ${vectorClass}`);
  }
  return { resultBytes: canonicalBytes(result), failures };
}

function evaluateStrictJson(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  let result: JsonObject;
  try {
    parseStrictJson(asString(vector.raw_json, "strict_json.raw_json"));
    result = { valid: true };
  } catch (error) {
    if (!(error instanceof StrictJsonError)) {
      throw error;
    }
    result = { error_code: error.code, valid: false };
  }
  checkEqual(
    failures,
    asBoolean(result.valid, "strict_json observed valid"),
    asBoolean(vector.valid, "strict_json.valid"),
    "strict JSON validity",
  );
  if (!asBoolean(vector.valid, "strict_json.valid")) {
    checkEqual(
      failures,
      asString(result.error_code, "strict_json observed error_code"),
      asString(vector.error_code, "strict_json.error_code"),
      "strict JSON error code",
    );
  }
  return { resultBytes: canonicalBytes(result), failures };
}

function evaluateReplay(vector: JsonObject): Evaluation {
  const failures: string[] = [];
  const caseId = asString(vector.case_id, "replay.case_id");
  let result: JsonObject;
  switch (caseId) {
    case "same-identity-same-hash":
      result = { ...observeSameIdentitySameHash() };
      break;
    case "same-identity-different-hash":
      result = { ...observeSameIdentityDifferentHash() };
      break;
    case "partial-page-failure":
      result = { ...observePartialPageFailure() };
      break;
    default:
      throw new ArtifactFailure(`Unsupported replay case ${caseId}`);
  }
  const expected = withoutKey(vector, "case_id");
  checkEqual(
    failures,
    canonicalize(result),
    canonicalize(expected),
    "replay/checkpoint state transition",
  );
  return { resultBytes: canonicalBytes(result), failures };
}

async function evaluateNegativeSource(
  vector: JsonObject,
  context: EvaluationContext,
): Promise<Evaluation> {
  const failures: string[] = [];
  const caseId = asString(vector.case_id, "negative Source case_id");
  const path = asString(vector.release_path, `${caseId}.release_path`);
  const sourceBytes = await readRootFile(
    context.root,
    path,
    `${caseId} Source fixture`,
  );
  checkEqual(
    failures,
    sha256(sourceBytes),
    asString(vector.sha256, `${caseId}.sha256`),
    "negative Source exact-byte SHA-256",
  );
  let observed: JsonObject;
  if (caseId === "cursor-expired") {
    observed = classifyCursorError(sourceBytes);
  } else if (caseId === "privacy-redaction-rejected") {
    try {
      mapSourceOrThrow(sourceBytes, context.mapping);
      throw new Error("privacy fixture unexpectedly mapped");
    } catch (error) {
      if (!(error instanceof ConnectorFailure)) {
        throw error;
      }
      observed = error.value;
    }
  } else {
    throw new ArtifactFailure(`Unsupported negative Source case ${caseId}`);
  }
  const expected = asObject(vector.expected_error, `${caseId}.expected_error`);
  checkEqual(
    failures,
    canonicalize(observed),
    canonicalize(expected),
    "exact Connector error",
  );
  return { resultBytes: canonicalBytes(observed), failures };
}

function vectorsForSection(
  section: string,
  bundle: JsonObject,
  golden: JsonObject,
): JsonValue[] {
  if (section === "negative_source_seeds") {
    return asArray(
      golden.negative_source_seeds,
      "golden.negative_source_seeds",
    );
  }
  if (
    ![
      "canonical_envelopes",
      "idempotency",
      "decimal_strings",
      "timestamps",
      "unicode",
      "strict_json",
      "replay",
    ].includes(section)
  ) {
    throw new ArtifactFailure(`Unknown case_contract section ${section}`);
  }
  return asArray(bundle[section], `bundle.${section}`);
}

function classesForCase(
  caseContract: JsonObject,
  vector: JsonObject,
): string[] {
  let rawClasses: JsonValue[];
  if (caseContract.case_classes !== undefined) {
    rawClasses = asArray(caseContract.case_classes, "case_contract.case_classes");
  } else if (caseContract.case_classes_by_class !== undefined) {
    const byClass = asObject(
      caseContract.case_classes_by_class,
      "case_contract.case_classes_by_class",
    );
    const vectorClass = asString(vector.class, "vector.class");
    rawClasses = asArray(byClass[vectorClass], `case classes for ${vectorClass}`);
  } else if (caseContract.case_classes_by_case !== undefined) {
    const byCase = asObject(
      caseContract.case_classes_by_case,
      "case_contract.case_classes_by_case",
    );
    const caseId = asString(vector.case_id, "vector.case_id");
    rawClasses = asArray(byCase[caseId], `case classes for ${caseId}`);
  } else {
    throw new ArtifactFailure("case_contract does not declare case classes");
  }
  const classes = rawClasses.map((value) => asString(value, "case_contract class"));
  if (
    classes.length === 0 ||
    classes.some((value) => !/^[a-z][a-z0-9_]*$/.test(value) || value.length > 80)
  ) {
    throw new ArtifactFailure("case_contract declares an invalid class");
  }
  return sortedUnique(classes);
}

function resultKindForCase(caseContract: JsonObject): string {
  const resultKind = asString(
    caseContract.result_kind,
    "case_contract.result_kind",
  );
  if (
    !["bytes", "classification", "error", "state_transition"].includes(
      resultKind,
    )
  ) {
    throw new ArtifactFailure(`Invalid result_kind ${resultKind}`);
  }
  return resultKind;
}

function validateClassCoverage(
  contract: JsonObject,
  observed: Set<string>,
): void {
  const required = asArray(
    contract.required_case_classes,
    "contract.required_case_classes",
  ).map((value) => asString(value, "required case class"));
  const observedList = [...observed].sort();
  if (
    canonicalize(sortedUnique(required) as JsonValue) !==
      canonicalize(observedList as JsonValue)
  ) {
    throw new ArtifactFailure("report cases do not cover required case classes");
  }
}

function validateBundleHeader(bundle: JsonObject): void {
  assertExactKeys(
    bundle,
    [
      "bundle_version",
      "protocol_version",
      "golden_fixture_bundle_path",
      "reference_mapping_context",
      "canonical_envelopes",
      "idempotency",
      "decimal_strings",
      "timestamps",
      "unicode",
      "strict_json",
      "capture_gaps",
      "replay",
    ],
    [],
    "canonical bundle",
  );
  requireExact(
    bundle.bundle_version,
    "foigent.canonical-vector-bundle.v1",
    "bundle_version",
  );
  requireExact(bundle.protocol_version, "1.0.0", "protocol_version");
}

function validateContractHeader(contract: JsonObject): void {
  requireExact(
    contract.contract_version,
    "foigent.connector-conformance.v1",
    "contract_version",
  );
  const runner = asObject(contract.runner, "contract.runner");
  requireExact(
    runner.invocation,
    "<runner> --bundle <canonical-vector-bundle.json> --report <report.json>",
    "runner invocation",
  );
  requireExact(
    runner.report_schema,
    "foigent://schemas/conformance-report/v1",
    "runner report_schema",
  );
  const comparison = asObject(contract.comparison, "contract.comparison");
  requireExact(
    comparison.case_order,
    "Emit cases in case_contract array order. Within each section, preserve " +
      "the source vector array order from the canonical vector bundle or " +
      "Golden fixture bundle.",
    "comparison.case_order",
  );
}

function validateGoldenHeader(golden: JsonObject): void {
  assertExactKeys(
    golden,
    [
      "bundle_version",
      "protocol_version",
      "reference_connector",
      "source_seed_index",
      "cases",
      "negative_source_seeds",
    ],
    [],
    "Golden fixture bundle",
  );
  requireExact(
    golden.bundle_version,
    "foigent.golden-fixture-bundle.v1",
    "Golden bundle_version",
  );
  requireExact(
    golden.protocol_version,
    "1.0.0",
    "Golden protocol_version",
  );
  requireExact(
    golden.reference_connector,
    "foigent.unirouter.completed-execution",
    "Golden reference_connector",
  );
}

function mappingContext(value: JsonValue | undefined): MappingContext {
  const context = asObject(value, "reference_mapping_context");
  assertExactKeys(
    context,
    [
      "producer_product",
      "producer_instance",
      "connector_id",
      "connector_version",
      "adapter_fidelity",
      "payload_capture_mode",
      "raw_payload_present",
      "source_revision",
      "timeline_complete",
    ],
    [],
    "reference_mapping_context",
  );
  return {
    producerProduct: asString(context.producer_product, "producer_product"),
    producerInstance: asString(context.producer_instance, "producer_instance"),
    connectorId: asString(context.connector_id, "connector_id"),
    connectorVersion: asString(context.connector_version, "connector_version"),
    adapterFidelity: asString(context.adapter_fidelity, "adapter_fidelity"),
    payloadCaptureMode: asString(
      context.payload_capture_mode,
      "payload_capture_mode",
    ),
    rawPayloadPresent: asBoolean(
      context.raw_payload_present,
      "raw_payload_present",
    ),
    sourceRevision: asString(context.source_revision, "source_revision"),
    timelineComplete: asBoolean(
      context.timeline_complete,
      "timeline_complete",
    ),
  };
}

function goldenCaseById(golden: JsonObject, caseId: string): JsonObject {
  const matches = asArray(golden.cases, "golden.cases")
    .map((value) => asObject(value, "golden case"))
    .filter((value) => asString(value.case_id, "golden case_id") === caseId);
  if (matches.length !== 1) {
    throw new ArtifactFailure(`${caseId}: expected exactly one Golden case`);
  }
  return matches[0]!;
}

async function readPinnedArtifact(
  root: string,
  path: string,
  expectedDigest: string,
  name: string,
): Promise<JsonObject> {
  const bytes = await readRootFile(root, path, name);
  requireDigest(bytes, expectedDigest, name);
  return parseArtifact(bytes, name);
}

async function readRootFile(
  root: string,
  path: string,
  name: string,
): Promise<Uint8Array> {
  if (isAbsolute(path)) {
    throw new ArtifactFailure(`${name} path must be repository-relative`);
  }
  const absolute = resolve(root, path);
  const rootRelative = relative(root, absolute);
  if (
    rootRelative === ".." || rootRelative.startsWith(`..${sep}`) ||
    isAbsolute(rootRelative)
  ) {
    throw new ArtifactFailure(`${name} path escapes the artifact root`);
  }
  return await readFile(absolute, name);
}

async function readFile(path: string, name: string): Promise<Uint8Array> {
  try {
    return await Deno.readFile(path);
  } catch {
    throw new ArtifactFailure(`${name} is unavailable`);
  }
}

function parseArtifact(bytes: Uint8Array, name: string): JsonObject {
  try {
    return asObject(parseStrictJsonBytes(bytes), name);
  } catch (error) {
    if (error instanceof StrictJsonError) {
      throw new ArtifactFailure(`${name}: ${error.code}`);
    }
    throw error;
  }
}

function requireDigest(
  bytes: Uint8Array,
  expected: string,
  name: string,
): void {
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new ArtifactFailure(`${name} digest mismatch`);
  }
}

function requireExact(
  actual: JsonValue | undefined,
  expected: string,
  name: string,
): void {
  if (asString(actual, name) !== expected) {
    throw new ArtifactFailure(`${name} is not the frozen value`);
  }
}

function nullableString(
  value: JsonValue | undefined,
  name: string,
): string | null {
  if (value === null) {
    return null;
  }
  return asString(value, name);
}

function withoutKey(value: JsonObject, excluded: string): JsonObject {
  const result: JsonObject = Object.create(null) as JsonObject;
  for (const [key, child] of Object.entries(value)) {
    if (key !== excluded) {
      result[key] = child;
    }
  }
  return result;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function checkEqual(
  failures: string[],
  actual: string | number | boolean,
  expected: string | number | boolean,
  label: string,
): void {
  if (actual !== expected) {
    failures.push(`${label} mismatch`);
  }
}

function checkBytes(
  failures: string[],
  actual: Uint8Array,
  expected: Uint8Array,
  label: string,
): void {
  if (!equalBytes(actual, expected)) {
    failures.push(`${label} mismatch`);
  }
}

function boundedFailureMessage(failures: readonly string[]): string {
  const joined = failures.join("; ");
  return joined.length <= 512 ? joined : `${joined.slice(0, 509)}...`;
}

function decodeBase64(value: string, caseId: string): Uint8Array {
  try {
    const binary = atob(value);
    const result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      result[index] = binary.charCodeAt(index);
    }
    if (toBase64(result) !== value) {
      throw new Error("non-canonical base64");
    }
    return result;
  } catch {
    throw new ArtifactFailure(`${caseId}: result_base64 is not canonical`);
  }
}

export function resultBytesHex(run: ConformanceRun, caseId: string): string {
  const cases = asArray(run.report.cases, "report.cases");
  const reportCase = cases
    .map((value) => asObject(value, "report case"))
    .find((value) => asString(value.case_id, "case_id") === caseId);
  if (reportCase === undefined) {
    throw new ArtifactFailure(`${caseId}: report case not found`);
  }
  return toHex(
    decodeBase64(asString(reportCase.result_base64, "result_base64"), caseId),
  );
}
