#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const goPath = resolve(
  root,
  process.argv[2] ?? "conformance/reports/go-v1.json",
);
const typescriptPath = resolve(
  root,
  process.argv[3] ?? "conformance/reports/typescript-v1.json",
);

const goReport = readJSON(goPath);
const typescriptReport = readJSON(typescriptPath);
const contract = readJSON(
  resolve(root, "conformance/conformance-contract.v1.json"),
);
const bundleBytes = readFileSync(
  resolve(root, "vectors/canonical-vector-bundle.v1.json"),
);
const bundleDigest = sha256(bundleBytes);

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

function validateReport(report, implementation) {
  if (report.report_version !== "foigent.conformance-report.v1") {
    fail(`${implementation}: invalid report_version`);
  }
  if (report.implementation !== implementation) {
    fail(`${implementation}: implementation mismatch`);
  }
  if (report.bundle_sha256 !== bundleDigest) {
    fail(`${implementation}: bundle_sha256 mismatch`);
  }
  if (report.status !== "pass" || !Array.isArray(report.cases)) {
    fail(`${implementation}: report did not pass`);
  }
  const ids = report.cases.map((entry) => entry.case_id);
  if (new Set(ids).size !== ids.length) {
    fail(`${implementation}: duplicate case_id`);
  }
  if ([...ids].sort().join("\n") !== ids.join("\n")) {
    fail(`${implementation}: cases are not sorted by case_id`);
  }
  for (const entry of report.cases) {
    if (entry.status !== "pass") {
      fail(`${implementation}: ${entry.case_id} did not pass`);
    }
    const result = Buffer.from(entry.result_base64, "base64");
    if (result.toString("base64") !== entry.result_base64) {
      fail(`${implementation}: ${entry.case_id} has noncanonical base64`);
    }
    if (sha256(result) !== entry.result_sha256) {
      fail(`${implementation}: ${entry.case_id} result_sha256 mismatch`);
    }
  }
  const classes = new Set(report.cases.map((entry) => entry.case_class));
  for (const required of contract.required_case_classes) {
    if (!classes.has(required)) {
      fail(`${implementation}: missing case class ${required}`);
    }
  }
}

validateReport(goReport, "go");
validateReport(typescriptReport, "typescript");

const goComparable = {
  report_version: goReport.report_version,
  bundle_sha256: goReport.bundle_sha256,
  status: goReport.status,
  cases: goReport.cases,
};
const typescriptComparable = {
  report_version: typescriptReport.report_version,
  bundle_sha256: typescriptReport.bundle_sha256,
  status: typescriptReport.status,
  cases: typescriptReport.cases,
};
if (JSON.stringify(goComparable) !== JSON.stringify(typescriptComparable)) {
  fail("Go and TypeScript conformance results differ");
}

process.stdout.write(
  `cross-language conformance matched: ${goReport.cases.length} cases, ` +
    `${contract.required_case_classes.length} required classes\n`,
);
