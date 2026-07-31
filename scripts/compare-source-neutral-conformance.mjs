#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const goPath = resolve(
  root,
  process.argv[2] ?? "conformance/reports/go-source-neutral-v2.json",
);
const typescriptPath = resolve(
  root,
  process.argv[3] ??
    "conformance/reports/typescript-source-neutral-v2.json",
);
const contract = readJSON(
  resolve(root, "conformance/source-neutral-conformance-contract.v2.json"),
);
const bundlePath = resolve(
  root,
  "vectors/source-neutral-vector-bundle.v2.json",
);
const bundleBytes = readFileSync(bundlePath);
const bundle = JSON.parse(bundleBytes);
const expectedBundleSHA = sha256(bundleBytes);

const goReport = readJSON(goPath);
const typescriptReport = readJSON(typescriptPath);
const expectedCases = buildExpectedCases();

validateReport(goReport, "go");
validateReport(typescriptReport, "typescript");

const goComparable = comparable(goReport);
const typescriptComparable = comparable(typescriptReport);
if (JSON.stringify(goComparable) !== JSON.stringify(typescriptComparable)) {
  fail("Go and TypeScript source-neutral observations differ");
}

process.stdout.write(
  `source-neutral cross-language conformance matched: ` +
    `${expectedCases.length} cases, ` +
    `${contract.required_case_classes.length} required classes\n`,
);

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

function buildExpectedCases() {
  const expected = [];
  const seen = new Set();
  for (const sectionContract of contract.case_contract) {
    const section = sectionContract.section;
    const vectors = bundle[section];
    if (!Array.isArray(vectors)) {
      fail(`vector section ${section} is absent`);
    }
    for (const vector of vectors) {
      const caseID = `${section}/${vector.case_id}`;
      if (seen.has(caseID)) {
        fail(`duplicate source-neutral case ${caseID}`);
      }
      seen.add(caseID);
      let classes;
      if (sectionContract.case_classes_by_case !== undefined) {
        classes = sectionContract.case_classes_by_case[vector.case_id];
      } else {
        classes = sectionContract.case_classes;
      }
      if (!Array.isArray(classes) || classes.length === 0) {
        fail(`case contract does not classify ${caseID}`);
      }
      const sortedClasses = [...new Set(classes)].sort();
      if (
        JSON.stringify(vector.case_classes) !==
          JSON.stringify(sortedClasses) ||
        vector.result_kind !== sectionContract.result_kind
      ) {
        fail(`vector metadata differs from case contract for ${caseID}`);
      }
      expected.push({
        case_id: caseID,
        case_classes: sortedClasses,
        result_kind: sectionContract.result_kind,
      });
    }
  }
  return expected;
}

function validateReport(report, implementation) {
  if (
    report.report_version !== "foigent.conformance-report.v1" ||
    report.implementation !== implementation ||
    report.bundle_sha256 !== expectedBundleSHA ||
    report.status !== "pass" ||
    !Array.isArray(report.cases)
  ) {
    fail(`${implementation}: invalid report identity or status`);
  }
  if (report.cases.length !== expectedCases.length) {
    fail(`${implementation}: report case count mismatch`);
  }
  const observedClasses = new Set();
  for (let index = 0; index < expectedCases.length; index += 1) {
    const expected = expectedCases[index];
    const entry = report.cases[index];
    if (
      entry.case_id !== expected.case_id ||
      entry.status !== "pass" ||
      entry.result_kind !== expected.result_kind ||
      JSON.stringify(entry.case_classes) !==
        JSON.stringify(expected.case_classes) ||
      Object.hasOwn(entry, "failure_message")
    ) {
      fail(`${implementation}: case contract mismatch at ${expected.case_id}`);
    }
    for (const className of entry.case_classes) {
      observedClasses.add(className);
    }
    const result = Buffer.from(entry.result_base64, "base64");
    if (
      result.toString("base64") !== entry.result_base64 ||
      sha256(result) !== entry.result_sha256
    ) {
      fail(`${implementation}: result encoding mismatch at ${expected.case_id}`);
    }
  }
  const required = [...contract.required_case_classes].sort();
  if (
    JSON.stringify([...observedClasses].sort()) !== JSON.stringify(required)
  ) {
    fail(`${implementation}: required case-class coverage mismatch`);
  }
}

function comparable(report) {
  return {
    report_version: report.report_version,
    bundle_sha256: report.bundle_sha256,
    status: report.status,
    cases: report.cases,
  };
}
