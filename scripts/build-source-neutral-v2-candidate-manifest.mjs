#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] ?? "--check";
const outputPath = resolve(
  root,
  "docs/candidates/v2.0.0-rc.1/candidate-manifest.json",
);
const componentPaths = {
  governance: "GOVERNANCE.md",
  predecessor_release_manifest:
    "releases/v1.1.2/release-manifest.json",
  preserved_event_envelope_schema:
    "schemas/event-envelope.v1.schema.json",
  preserved_capture_gap_schema:
    "schemas/capture-gap.v1.schema.json",
  preserved_conformance_report_schema:
    "schemas/conformance-report.v1.schema.json",
  preserved_unirouter_manifest:
    "manifests/foigent.unirouter.completed-execution-1.0.0.json",
  preserved_litellm_manifest:
    "manifests/foigent.litellm.spend-logs-1.0.0.json",
  preserved_xinsight_compatibility_seed:
    "mappings/xinsight/completed-execution-compatibility-seed-v1.json",
  preserved_unirouter_compatibility_matrix:
    "compatibility/foigent-unirouter-completed-execution-1.0.0-to-xinsight-m0.1.json",
  preserved_litellm_compatibility_matrix:
    "compatibility/foigent-litellm-spend-logs-1.0.0-to-xinsight-m0.1.json",
  semantic_decision:
    "docs/decisions/0002-source-neutral-transport-completeness-v2-candidate.md",
  protocol_candidate: "spec/protocol-v2-candidate.md",
  domain_catalog: "catalog/domain-catalog.v2.json",
  connector_manifest_schema:
    "schemas/connector-manifest.v2.schema.json",
  connector_lifecycle_schema:
    "schemas/connector-lifecycle.v2.schema.json",
  connector_checkpoint_schema:
    "schemas/connector-checkpoint.v2.schema.json",
  event_batch_schema: "schemas/event-batch.v2.schema.json",
  connector_error_schema:
    "schemas/connector-error.v2.schema.json",
  operational_receipt_schema:
    "schemas/operational-receipt.v2.schema.json",
  openinference_source_schema:
    "schemas/openinference-span.v1.schema.json",
  openinference_payload_schema:
    "schemas/observability-openinference-span-completed.v1.schema.json",
  openinference_manifest:
    "manifests/foigent.openinference.otlp-spans-1.0.0.json",
  openinference_otlp_source_mapping:
    "mappings/openinference/otlp-json-to-sanitized-span.v1.json",
  openinference_event_mapping:
    "mappings/openinference/sanitized-span-to-event-envelope.v1.json",
  xinsight_openinference_projection:
    "mappings/xinsight/openinference-span-to-m0-m0.1-v2.json",
  v1_to_v2_compatibility_matrix:
    "compatibility/v1-to-v2-source-neutral-matrix.json",
  xinsight_openinference_compatibility_matrix:
    "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json",
  openinference_raw_fixture:
    "fixtures/source/openinference/reference-otlp-export.v1.json",
  openinference_source_fixture:
    "fixtures/source/openinference/reference-sanitized-span.v1.json",
  openinference_envelope_hash_input:
    "fixtures/shared/openinference-span-envelope.hash-input.json",
  conformance_contract:
    "conformance/source-neutral-conformance-contract.v2.json",
  vector_bundle: "vectors/source-neutral-vector-bundle.v2.json",
  go_conformance_report:
    "conformance/reports/go-source-neutral-v2.json",
  typescript_conformance_report:
    "conformance/reports/typescript-source-neutral-v2.json",
  go_implementation_manifest:
    "implementations/source-neutral-v2/go/implementation-manifest.v2.json",
  typescript_implementation_manifest:
    "implementations/source-neutral-v2/typescript/implementation-manifest.v2.json",
  artifact_builder:
    "scripts/build-source-neutral-v2-artifacts.mjs",
  implementation_manifest_builder:
    "scripts/build-source-neutral-v2-implementation-manifests.mjs",
  candidate_manifest_builder:
    "scripts/build-source-neutral-v2-candidate-manifest.mjs",
  conformance_comparator:
    "scripts/compare-source-neutral-conformance.mjs",
  compatibility_validator:
    "scripts/validate_source_neutral_v2_candidate.py",
  conformance_kit:
    "scripts/run-source-neutral-v2-conformance-kit.sh",
  schema_audit_main: "tools/schema-audit-v2/main.go",
  schema_audit_overlay: "tools/schema-audit-v2/overlay.json",
  schema_audit_runner: "tools/schema-audit-v2/run.sh",
  compatibility_tests:
    "tests/test_source_neutral_v2_candidate.py",
};

if (!["--write", "--check", "--content-digest"].includes(mode)) {
  process.stderr.write(
    "usage: build-source-neutral-v2-candidate-manifest.mjs " +
      "--write|--check|--content-digest\n",
  );
  process.exit(2);
}

const components = Object.fromEntries(
  Object.entries(componentPaths).map(([name, path]) => [
    name,
    {
      path,
      sha256: sha256(readFileSync(resolve(root, path))),
    },
  ]),
);
const hashInput = {
  candidate_manifest_version: "foigent.protocol-candidate-manifest.v1",
  protocol_version: "2.0.0",
  protocol_status: "not_binding",
  authority: {
    repository: "https://github.com/foigent/event-connector-spec",
    repository_id: 1313391565,
  },
  predecessor: {
    protocol_version: "1.1.2",
    tag: "v1.1.2",
    tag_commit: "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16",
    tree: "d316d6ada678066ed7679a772856aea6157d869d",
    content_digest:
      "sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813",
    release_digest:
      "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1",
  },
  components,
};
const contentDigest = sha256(
  Buffer.from(canonicalize(hashInput), "utf8"),
);

if (mode === "--content-digest") {
  process.stdout.write(`${contentDigest}\n`);
  process.exit(0);
}

const manifest = {
  ...hashInput,
  content_digest: contentDigest,
  approvals: {
    source_domain_owner: "required",
    projection_owner: "candidate_evidence_pending_exact_digest",
    coordinator: "required",
  },
  boundary: {
    binding_release: false,
    immutable_tag: "absent",
    product_adoption: "not_authorized",
    runtime_mutation: "none",
  },
};
const rendered = `${JSON.stringify(manifest, null, 2)}\n`;

if (mode === "--write") {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, { encoding: "utf8", mode: 0o644 });
  process.stdout.write(`candidate manifest written: ${contentDigest}\n`);
} else if (readFileSync(outputPath, "utf8") !== rendered) {
  process.stderr.write("source-neutral v2 candidate manifest is stale\n");
  process.exit(1);
} else {
  process.stdout.write(`candidate manifest verified: ${contentDigest}\n`);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
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
  if (typeof value !== "object") {
    throw new Error(`unsupported JSON type: ${typeof value}`);
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize(value[key])}`
  ).join(",")}}`;
}
