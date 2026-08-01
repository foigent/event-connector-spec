#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] ?? "--check";
const outputPath = resolve(
  root,
  "docs/candidates/v2.0.1-rc.1/candidate-manifest.json",
);
const componentPaths = {
  authority_readme: "README.md",
  governance: "GOVERNANCE.md",
  predecessor_release_manifest:
    "releases/v2.0.0/release-manifest.json",
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
  erratum_decision:
    "docs/decisions/0004-openinference-manifest-projection-digest-erratum-candidate.md",
  protocol_spec: "spec/protocol-v2.md",
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
  artifact_builder:
    "scripts/build-source-neutral-v2-artifacts.mjs",
  implementation_manifest_builder:
    "scripts/build-source-neutral-v2-implementation-manifests.mjs",
  candidate_manifest_builder:
    "scripts/build-source-neutral-v2-candidate-manifest.mjs",
  release_manifest_builder:
    "scripts/build-source-neutral-v2-release-manifest.mjs",
  product_pin_verifier:
    "scripts/verify-product-pin-v2.mjs",
  shared_ci_action: "actions/source-neutral-v2/action.yml",
  authority_ci_workflow: ".github/workflows/source-neutral-v2.yml",
  v2_0_0_predecessor_kit:
    "scripts/run-v2.0.0-predecessor-kit.sh",
  conformance_comparator:
    "scripts/compare-source-neutral-conformance.mjs",
  release_validator:
    "scripts/validate_source_neutral_v2_release.py",
  conformance_kit:
    "scripts/run-source-neutral-v2-release-kit.sh",
  schema_audit_main: "tools/schema-audit-v2/main.go",
  schema_audit_overlay: "tools/schema-audit-v2/overlay.json",
  schema_audit_runner: "tools/schema-audit-v2/run.sh",
  release_tests:
    "tests/test_source_neutral_v2_release.py",
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
  protocol_version: "2.0.1",
  protocol_status: "not_binding",
  authority: {
    repository: "https://github.com/foigent/event-connector-spec",
    repository_id: 1313391565,
  },
  predecessor: {
    protocol_version: "2.0.0",
    tag: "v2.0.0",
    tag_commit: "a8ab25ef8c8dd1c12d073ec0cf23c376f5741744",
    tree: "981e2516154610c172c6a1607795512ad9c69f30",
    content_digest:
      "sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69",
    release_digest:
      "sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9",
  },
  reviewed_candidate: {
    commit: "61e21ee6988814f2d4a785bcf1723f5ce9dc49b1",
    tree: "9c152180d9132fa279c75b8b6cc4cfaac895d411",
    content_digest:
      "sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba",
  },
  candidate_reviews: {
    source_domain_owner: {
      path: "reviews/candidates/v2.0.1-rc.1/source-owner-review.md",
      commit: "f95b4046589d307f984a22a8d04aeabe0e2470be",
      tree: "ad4da41fd2b24f7bfaa4a0750d19ced3360ab1be",
      sha256:
        "sha256:89e1e58dbfedeacc94e5073bf9ad295f23079bb132074e18a51b3cff4da9f5ff",
      status: "SOURCE_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING",
    },
    projection_owner: {
      path: "reviews/candidates/v2.0.1-rc.1/projection-owner-review.md",
      commit: "58734925b167d97f19a6166fd789e45db049c2ec",
      tree: "e48efd35086e715991d99a40b5e8199cbb2f8c24",
      sha256:
        "sha256:7392bc406bdf5d1252f2e6f45a221713068542b7cbe76e6795de06afab33e18a",
      status: "PROJECTION_OWNER_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING",
    },
    coordinator: {
      path: "reviews/candidates/v2.0.1-rc.1/coordinator-review.md",
      commit: "bb388d8bf94045373cca4a7f58ac70034e4cf90f",
      tree: "9da6dcc46b00876005d8cb5e25c0ce35e13b6672",
      sha256:
        "sha256:922e42ec8c4ed0d6db7f07f80355ff3208ec6fc49b5482cc707f9e1240864e01",
      status: "COORDINATOR_V2_0_1_ERRATUM_CANDIDATE_CONFIRM_NON_BINDING",
    },
  },
  compatibility: "PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM",
  components,
};
for (const [role, review] of Object.entries(hashInput.candidate_reviews)) {
  const bytes = readFileSync(resolve(root, review.path));
  if (sha256(bytes) !== review.sha256) {
    throw new Error(`${role} candidate review bytes changed`);
  }
  const text = bytes.toString("utf8");
  for (const required of [
    `Status: \`${review.status}\``,
    hashInput.reviewed_candidate.commit,
    hashInput.reviewed_candidate.tree,
    hashInput.reviewed_candidate.content_digest,
    hashInput.compatibility,
  ]) {
    if (!text.includes(required)) {
      throw new Error(`${role} candidate review is missing ${required}`);
    }
  }
}
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
    source_domain_owner: "candidate_confirmed_non_binding",
    projection_owner: "candidate_confirmed_non_binding",
    coordinator: "candidate_confirmed_non_binding",
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
  process.stderr.write("source-neutral v2.0.1 candidate manifest is stale\n");
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
