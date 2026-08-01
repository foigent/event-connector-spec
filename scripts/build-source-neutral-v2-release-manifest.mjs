#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = resolve(root, "releases/v2.0.2/release-manifest.json");
const mode = process.argv[2] ?? "--check";
const approvalPaths = [
  {
    role: "source_domain_owner",
    status: "SOURCE_OWNER_FINAL_RELEASE_CONFIRM",
    path: "reviews/releases/v2.0.2/source-owner-approval.md",
  },
  {
    role: "projection_owner",
    status: "PROJECTION_OWNER_FINAL_RELEASE_APPROVAL",
    path: "reviews/releases/v2.0.2/projection-owner-approval.md",
  },
  {
    role: "coordinator",
    status: "COORDINATOR_FINAL_RELEASE_CONFIRM",
    path: "reviews/releases/v2.0.2/coordinator-approval.md",
  },
];

const componentPaths = {
  authority_readme: "README.md",
  governance: "GOVERNANCE.md",
  release_decision:
    "docs/decisions/0005-composite-action-snapshot-portability-candidate.md",
  predecessor_release_manifest: "releases/v2.0.1/release-manifest.json",
  candidate_manifest_archive:
    "docs/candidates/v2.0.2-rc.1/candidate-manifest.json",
  candidate_source_owner_review:
    "reviews/candidates/v2.0.2-rc.1/source-owner-review.md",
  candidate_projection_owner_review:
    "reviews/candidates/v2.0.2-rc.1/projection-owner-review.md",
  candidate_coordinator_review:
    "reviews/candidates/v2.0.2-rc.1/coordinator-review.md",
  protocol_spec: "spec/protocol-v2.md",
  protocol_v1_compatibility_base: "spec/protocol-v1.md",
  shared_ci_action: "actions/source-neutral-v2/action.yml",
  authority_ci_workflow: ".github/workflows/source-neutral-v2.yml",
  legacy_conformance_kit: "scripts/run-conformance-kit.sh",
  predecessor_conformance_kit:
    "scripts/run-v1.1.2-predecessor-kit.sh",
  immediate_predecessor_conformance_kit:
    "scripts/run-v2.0.1-predecessor-kit.sh",
  v2_0_0_predecessor_conformance_kit:
    "scripts/run-v2.0.0-predecessor-kit.sh",
  v1_compatibility_kit: "scripts/run-v1-compatibility-kit.sh",
  conformance_kit_runner:
    "scripts/run-source-neutral-v2-consumer-kit.sh",
  authority_release_kit_runner:
    "scripts/run-source-neutral-v2-release-kit.sh",
  current_release_kit_runner:
    "scripts/run-source-neutral-v2-current-release-kit.sh",
  current_v1_compatibility_kit:
    "scripts/run-v1-compatibility-current-kit.sh",
  action_snapshot_kit:
    "scripts/run-source-neutral-v2-action-snapshot-kit.sh",
  legacy_release_builder: "scripts/build-release-manifest.mjs",
  release_builder: "scripts/build-source-neutral-v2-release-manifest.mjs",
  candidate_manifest_builder:
    "scripts/build-source-neutral-v2.0.2-candidate-manifest.mjs",
  legacy_implementation_manifest_builder:
    "scripts/build-implementation-manifests.mjs",
  legacy_candidate_verifier: "scripts/verify-candidate.mjs",
  legacy_conformance_comparator: "scripts/compare-conformance.mjs",
  litellm_artifact_builder: "scripts/build-litellm-artifacts.mjs",
  litellm_upstream_evidence_verifier:
    "scripts/verify-litellm-upstream-evidence.mjs",
  litellm_conformance_comparator:
    "scripts/compare-litellm-conformance.mjs",
  source_neutral_artifact_builder:
    "scripts/build-source-neutral-v2-artifacts.mjs",
  source_neutral_implementation_manifest_builder:
    "scripts/build-source-neutral-v2-implementation-manifests.mjs",
  source_neutral_conformance_comparator:
    "scripts/compare-source-neutral-conformance.mjs",
  source_neutral_release_validator:
    "scripts/validate_source_neutral_v2_0_2_candidate.py",
  v2_0_1_release_validator:
    "scripts/validate_source_neutral_v2_release.py",
  source_neutral_release_tests:
    "tests/test_source_neutral_v2_0_2_candidate.py",
  v2_0_1_release_tests:
    "tests/test_source_neutral_v2_release.py",
  action_portability_tests:
    "tests/test_source_neutral_v2_action_portability.py",
  candidate_archive_tests:
    "tests/test_source_neutral_v2_candidate.py",
  product_pin_verifier: "scripts/verify-product-pin-v2.mjs",
  release_manifest_v1_schema:
    "schemas/release-manifest.v1.schema.json",
  release_manifest_schema: "schemas/release-manifest.v2.schema.json",
  protocol_pin_v1_schema: "schemas/protocol-pin.v1.schema.json",
  protocol_pin_schema: "schemas/protocol-pin.v2.schema.json",
  event_envelope_schema: "schemas/event-envelope.v1.schema.json",
  capture_gap_schema: "schemas/capture-gap.v1.schema.json",
  conformance_report_schema: "schemas/conformance-report.v1.schema.json",
  domain_catalog: "catalog/domain-catalog.v2.json",
  connector_manifest_schema: "schemas/connector-manifest.v2.schema.json",
  connector_lifecycle_schema:
    "schemas/connector-lifecycle.v2.schema.json",
  connector_checkpoint_schema:
    "schemas/connector-checkpoint.v2.schema.json",
  event_batch_schema: "schemas/event-batch.v2.schema.json",
  connector_error_schema: "schemas/connector-error.v2.schema.json",
  operational_receipt_schema:
    "schemas/operational-receipt.v2.schema.json",
  openinference_source_schema: "schemas/openinference-span.v1.schema.json",
  openinference_payload_schema:
    "schemas/observability-openinference-span-completed.v1.schema.json",
  reference_connector_manifest:
    "manifests/foigent.unirouter.completed-execution-1.0.0.json",
  litellm_connector_manifest:
    "manifests/foigent.litellm.spend-logs-1.0.0.json",
  openinference_connector_manifest:
    "manifests/foigent.openinference.otlp-spans-1.0.0.json",
  source_projection_contract:
    "mappings/unirouter/source-snapshot-to-model-request-completed.v1.json",
  source_lifecycle_mapping:
    "mappings/unirouter/source-lifecycle-to-shared-axes.v1.json",
  source_identity_mapping:
    "mappings/unirouter/connector-identity-to-source-local.v1.json",
  reference_projection_contract:
    "mappings/xinsight/model-request-completed-to-m0-m0.1-v1.json",
  consumer_lifecycle_mapping:
    "mappings/xinsight/connector-lifecycle-to-current-xinsight-v1.json",
  consumer_identity_mapping:
    "mappings/xinsight/portable-connector-identity-to-current-xinsight-v1.json",
  litellm_source_projection_contract:
    "mappings/litellm/spend-log-to-model-request-completed.v2.json",
  litellm_upstream_source_mapping:
    "mappings/litellm/spend-logs-v2-to-sanitized-source.v1.json",
  litellm_reference_projection_contract:
    "mappings/xinsight/model-request-completed-v2-to-m0-m0.1-litellm-v1.json",
  openinference_otlp_source_mapping:
    "mappings/openinference/otlp-json-to-sanitized-span.v1.json",
  openinference_event_mapping:
    "mappings/openinference/sanitized-span-to-event-envelope.v1.json",
  xinsight_openinference_projection:
    "mappings/xinsight/openinference-span-to-m0-m0.1-v2.json",
  v1_to_v2_compatibility_matrix:
    "compatibility/v1-to-v2-source-neutral-matrix.json",
  reference_compatibility_matrix:
    "compatibility/foigent-unirouter-completed-execution-1.0.0-to-xinsight-m0.1.json",
  litellm_compatibility_matrix:
    "compatibility/foigent-litellm-spend-logs-1.0.0-to-xinsight-m0.1.json",
  openinference_compatibility_matrix:
    "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json",
  reference_compatibility_vector_bundle:
    "mappings/xinsight/completed-execution-compatibility-seed-v1.json",
  openinference_raw_fixture:
    "fixtures/source/openinference/reference-otlp-export.v1.json",
  openinference_source_fixture:
    "fixtures/source/openinference/reference-sanitized-span.v1.json",
  openinference_envelope_hash_input:
    "fixtures/shared/openinference-span-envelope.hash-input.json",
  openinference_missing_optional_raw_fixture:
    "fixtures/source/openinference/missing-optional-otlp-export.v1.json",
  openinference_missing_optional_source_fixture:
    "fixtures/source/openinference/missing-optional-sanitized-span.v1.json",
  openinference_missing_optional_envelope_hash_input:
    "fixtures/shared/openinference-missing-optional-envelope.hash-input.json",
  openinference_ordered_batch_raw_fixture:
    "fixtures/source/openinference/ordered-batch-otlp-export.v1.json",
  openinference_ordered_separate_source_fixture:
    "fixtures/source/openinference/ordered-separate-sanitized-span.v1.json",
  openinference_ordered_separate_envelope_hash_input:
    "fixtures/shared/openinference-ordered-separate-envelope.hash-input.json",
  openinference_ordered_parent_source_fixture:
    "fixtures/source/openinference/ordered-parent-sanitized-span.v1.json",
  openinference_ordered_parent_envelope_hash_input:
    "fixtures/shared/openinference-ordered-parent-envelope.hash-input.json",
  openinference_ordered_child_source_fixture:
    "fixtures/source/openinference/ordered-child-sanitized-span.v1.json",
  openinference_ordered_child_envelope_hash_input:
    "fixtures/shared/openinference-ordered-child-envelope.hash-input.json",
  openinference_unknown_status_negative_fixture:
    "fixtures/source/openinference/unknown-status-otlp-export.invalid.json",
  openinference_end_before_start_negative_fixture:
    "fixtures/source/openinference/end-before-start-otlp-export.invalid.json",
  openinference_malformed_trace_negative_fixture:
    "fixtures/source/openinference/malformed-trace-id-otlp-export.invalid.json",
  openinference_span_limit_negative_fixture:
    "fixtures/source/openinference/too-many-spans-otlp-export.invalid.json",
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
  schema_audit_main: "tools/schema-audit-v2/main.go",
  schema_audit_overlay: "tools/schema-audit-v2/overlay.json",
  schema_audit_runner: "tools/schema-audit-v2/run.sh",
};

if (!["--content-digest", "--write", "--check"].includes(mode)) {
  process.stderr.write(
    "usage: build-source-neutral-v2-release-manifest.mjs " +
      "--content-digest|--write|--check\n",
  );
  process.exit(2);
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
  const members = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
  return `{${members.join(",")}}`;
}

function readRegular(relativePath, label) {
  const absolute = resolve(root, relativePath);
  if (!absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`${label} escapes repository root`);
  }
  const info = lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
  return readFileSync(absolute);
}

const paths = Object.values(componentPaths);
if (new Set(paths).size !== paths.length) {
  throw new Error("release component paths must be unique");
}
const components = Object.fromEntries(
  Object.entries(componentPaths).map(([name, path]) => [
    name,
    {
      path,
      sha256: sha256(readRegular(path, name)),
    },
  ]),
);
const contentHashInput = {
  release_manifest_version: "foigent.protocol-release-manifest.v2",
  protocol_version: "2.0.2",
  authority: {
    repository: "https://github.com/foigent/event-connector-spec",
    repository_id: 1313391565,
    tag: "v2.0.2",
  },
  predecessor: {
    protocol_version: "2.0.1",
    tag: "v2.0.1",
    tag_commit: "0cbb6417858d12d6a99ff3b517bd59a122bc7e2c",
    tree: "f967929dd98c5f34cd42fce4aa21489b72b000e0",
    content_digest:
      "sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e",
    release_digest:
      "sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777",
  },
  boundary: {
    product_adoption: "not_authorized",
    runtime_mutation: "none",
  },
  components,
};
const contentDigest = sha256(
  Buffer.from(canonicalize(contentHashInput), "utf8"),
);

if (mode === "--content-digest") {
  process.stdout.write(`${contentDigest}\n`);
  process.exit(0);
}

const approvals = approvalPaths.map(({ role, status, path }) => {
  const bytes = readRegular(path, `${role} approval`);
  const text = bytes.toString("utf8");
  for (const required of [
    `Role: \`${role}\``,
    `Status: \`${status}\``,
    `Reviewed content digest: \`${contentDigest}\``,
    "Semantic conflict: `NONE`",
    "Product migration: `NOT_AUTHORIZED`",
    "Runtime mutation: `NONE`",
  ]) {
    if (!text.includes(required)) {
      throw new Error(`${role} approval is missing ${required}`);
    }
  }
  return {
    role,
    status: "confirmed",
    reviewed_content_digest: contentDigest,
    evidence: {
      path,
      sha256: sha256(bytes),
    },
  };
});
const hashInput = {
  ...contentHashInput,
  content_digest: contentDigest,
  approvals,
};
const manifest = {
  ...hashInput,
  release_digest: sha256(Buffer.from(canonicalize(hashInput), "utf8")),
};
const rendered = `${JSON.stringify(manifest, null, 2)}\n`;

if (mode === "--write") {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, { encoding: "utf8", mode: 0o644 });
  process.stdout.write(
    `release manifest written: ${manifest.release_digest}\n`,
  );
} else {
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== rendered) {
    process.stderr.write("source-neutral v2 release manifest is stale\n");
    process.exit(1);
  }
  process.stdout.write(
    `release manifest verified: ${manifest.release_digest}\n`,
  );
}
