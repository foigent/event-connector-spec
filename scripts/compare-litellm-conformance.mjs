#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const goPath = resolve(
  root,
  process.argv[2] ?? "conformance/reports/go-litellm-v1.json",
);
const typescriptPath = resolve(
  root,
  process.argv[3] ?? "conformance/reports/typescript-litellm-v1.json",
);
const bundlePath = resolve(
  root,
  "vectors/litellm-connector-vector-bundle.v1.json",
);
const contract = readJSON(
  resolve(root, "conformance/litellm-conformance-contract.v1.json"),
);
const bundle = readJSON(bundlePath);
const golden = readJSON(resolve(root, bundle.golden_fixture_bundle_path));
const bundleDigest = sha256(readFileSync(bundlePath));
const goReport = readJSON(goPath);
const typescriptReport = readJSON(typescriptPath);

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const expected = [
  ...bundle.canonical_envelopes.map((item) =>
    `canonical_envelopes/${item.case_id}`
  ),
  ...bundle.idempotency.map((item) => `idempotency/${item.case_id}`),
  ...bundle.canonical_decimals.map((item) =>
    `canonical_decimals/${item.case_id}`
  ),
  ...bundle.checkpoint.map((item) => `checkpoint/${item.case_id}`),
  ...bundle.replay.map((item) => `replay/${item.case_id}`),
  ...golden.negative_source_seeds.map((item) =>
    `negative_source_seeds/${item.case_id}`
  ),
];

function validate(report, implementation) {
  if (
    report.report_version !== "foigent.conformance-report.v1" ||
    report.implementation !== implementation ||
    report.bundle_sha256 !== bundleDigest ||
    report.status !== "pass" ||
    !Array.isArray(report.cases)
  ) {
    fail(`${implementation}: invalid report header`);
  }
  const ids = report.cases.map((item) => item.case_id);
  if (ids.join("\n") !== expected.join("\n")) {
    fail(`${implementation}: case set or order mismatch`);
  }
  const classes = new Set();
  for (const item of report.cases) {
    if (
      item.status !== "pass" ||
      item.failure_message !== undefined ||
      !Array.isArray(item.case_classes) ||
      [...item.case_classes].sort().join("\n") !==
        item.case_classes.join("\n")
    ) {
      fail(`${implementation}: invalid case ${item.case_id}`);
    }
    item.case_classes.forEach((value) => classes.add(value));
    const result = Buffer.from(item.result_base64, "base64");
    if (
      result.toString("base64") !== item.result_base64 ||
      sha256(result) !== item.result_sha256
    ) {
      fail(`${implementation}: invalid result bytes ${item.case_id}`);
    }
  }
  for (const required of contract.required_case_classes) {
    if (!classes.has(required)) {
      fail(`${implementation}: missing case class ${required}`);
    }
  }
}

validate(goReport, "go");
validate(typescriptReport, "typescript");
const comparable = (report) => ({
  report_version: report.report_version,
  bundle_sha256: report.bundle_sha256,
  status: report.status,
  cases: report.cases,
});
if (
  JSON.stringify(comparable(goReport)) !==
    JSON.stringify(comparable(typescriptReport))
) {
  fail("Go and TypeScript LiteLLM conformance results differ");
}
process.stdout.write(
  `LiteLLM cross-language conformance matched: ${expected.length} cases\n`,
);
