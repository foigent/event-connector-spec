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
const bundle = readJSON(
  resolve(root, "vectors/canonical-vector-bundle.v1.json"),
);
const golden = readJSON(
  resolve(root, bundle.golden_fixture_bundle_path),
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

function expectedCaseContract() {
  const result = new Map();
  const add = (section, caseID, classes, resultKind) => {
    result.set(`${section}/${caseID}`, {
      case_classes: [...classes].sort(),
      result_kind: resultKind,
    });
  };
  for (const vector of bundle.canonical_envelopes) {
    add(
      "canonical_envelopes",
      vector.case_id,
      ["canonical_envelope", "capture_gap_derivation"],
      "bytes",
    );
  }
  for (const vector of bundle.idempotency) {
    add(
      "idempotency",
      vector.case_id,
      ["scoped_idempotency"],
      "bytes",
    );
  }
  for (const vector of bundle.decimal_strings) {
    add(
      "decimal_strings",
      vector.case_id,
      ["decimal_boundary"],
      "classification",
    );
  }
  for (const vector of bundle.timestamps) {
    add(
      "timestamps",
      vector.case_id,
      ["timestamp_normalization"],
      "classification",
    );
  }
  for (const vector of bundle.unicode) {
    add(
      "unicode",
      vector.case_id,
      vector.class === "protocol_controlled"
        ? ["protocol_nfc_rejection"]
        : ["opaque_utf8_preservation"],
      "classification",
    );
  }
  for (const vector of bundle.strict_json) {
    add(
      "strict_json",
      vector.case_id,
      ["duplicate_key_rejection"],
      "error",
    );
  }
  for (const vector of bundle.replay) {
    const classes = {
      "same-identity-same-hash": ["checkpoint_commit", "duplicate_noop"],
      "same-identity-different-hash": [
        "checkpoint_commit",
        "content_conflict",
      ],
      "partial-page-failure": [
        "checkpoint_commit",
        "partial_page_replay",
      ],
    }[vector.case_id];
    add("replay", vector.case_id, classes, "state_transition");
  }
  for (const vector of golden.negative_source_seeds) {
    add(
      "negative_source_seeds",
      vector.case_id,
      vector.case_id === "cursor-expired"
        ? ["cursor_error"]
        : ["privacy_rejection"],
      "error",
    );
  }
  return result;
}

const expectedCases = expectedCaseContract();

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
  if (
    [...expectedCases.keys()].sort().join("\n") !==
    [...ids].sort().join("\n")
  ) {
    fail(`${implementation}: report case set mismatch`);
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
    const expected = expectedCases.get(entry.case_id);
    if (
      expected.result_kind !== entry.result_kind ||
      expected.case_classes.join("\n") !== entry.case_classes.join("\n")
    ) {
      fail(`${implementation}: ${entry.case_id} case contract mismatch`);
    }
  }
  const classes = new Set(
    report.cases.flatMap((entry) => entry.case_classes),
  );
  for (const entry of report.cases) {
    if (
      [...entry.case_classes].sort().join("\n") !==
      entry.case_classes.join("\n")
    ) {
      fail(`${implementation}: ${entry.case_id} case_classes are not sorted`);
    }
  }
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
