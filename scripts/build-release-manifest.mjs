#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = resolve(root, "releases/v1.0.0/release-manifest.json");
const mode = process.argv[2] ?? "--check";
const approvalPaths = [
  {
    role: "source_domain_owner",
    path: "reviews/releases/v1.0.0/source-owner-approval.md",
  },
  {
    role: "projection_owner",
    path: "reviews/releases/v1.0.0/projection-owner-approval.md",
  },
  {
    role: "coordinator",
    path: "reviews/releases/v1.0.0/coordinator-approval.md",
  },
];

const componentPaths = {
  protocol_spec: "spec/protocol-v1.md",
  shared_ci_action: "action.yml",
  authority_ci_workflow: ".github/workflows/ci.yml",
  conformance_kit_runner: "scripts/run-conformance-kit.sh",
  release_builder: "scripts/build-release-manifest.mjs",
  implementation_manifest_builder:
    "scripts/build-implementation-manifests.mjs",
  candidate_verifier: "scripts/verify-candidate.mjs",
  conformance_comparator: "scripts/compare-conformance.mjs",
  product_pin_verifier: "scripts/verify-product-pin.mjs",
  release_manifest_schema: "schemas/release-manifest.v1.schema.json",
  protocol_pin_schema: "schemas/protocol-pin.v1.schema.json",
  event_envelope_schema: "schemas/event-envelope.v1.schema.json",
  capture_gap_schema: "schemas/capture-gap.v1.schema.json",
  domain_catalog: "catalog/domain-catalog.v1.json",
  model_request_completed_schema:
    "schemas/model-request-completed.v1.schema.json",
  connector_manifest_schema: "schemas/connector-manifest.v1.schema.json",
  connector_lifecycle_schema: "schemas/connector-lifecycle.v1.schema.json",
  event_batch_schema: "schemas/event-batch.v1.schema.json",
  checkpoint_schema: "schemas/connector-checkpoint.v1.schema.json",
  operation_receipt_schema: "schemas/operational-receipt.v1.schema.json",
  error_schema: "schemas/connector-error.v1.schema.json",
  conformance_report_schema: "schemas/conformance-report.v1.schema.json",
  reference_connector_manifest:
    "manifests/foigent.unirouter.completed-execution-1.0.0.json",
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
  canonical_vector_bundle: "vectors/canonical-vector-bundle.v1.json",
  golden_fixture_bundle: "fixtures/golden-fixture-bundle.v1.json",
  reference_compatibility_vector_bundle:
    "mappings/xinsight/completed-execution-compatibility-seed-v1.json",
  compatibility_matrix:
    "compatibility/foigent-unirouter-completed-execution-1.0.0-to-xinsight-m0.1.json",
  conformance_contract: "conformance/conformance-contract.v1.json",
  go_implementation_manifest:
    "implementations/go/implementation-manifest.v1.json",
  typescript_implementation_manifest:
    "implementations/typescript/implementation-manifest.v1.json",
  schema_audit_source_manifest:
    "tools/schema-audit/source-manifest.v1.json",
  go_conformance_report: "conformance/reports/go-v1.json",
  typescript_conformance_report:
    "conformance/reports/typescript-v1.json",
};

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
  const members = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
  return `{${members.join(",")}}`;
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
const contentHashInput = {
  release_manifest_version: "foigent.protocol-release-manifest.v1",
  protocol_version: "1.0.0",
  authority: {
    repository: "https://github.com/foigent/event-connector-spec",
    repository_id: 1313391565,
    tag: "v1.0.0",
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

const approvals = approvalPaths.map(({ role, path }) => ({
  role,
  status: "confirmed",
  reviewed_content_digest: contentDigest,
  evidence: {
    path,
    sha256: sha256(readFileSync(resolve(root, path))),
  },
}));
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
} else if (mode === "--check") {
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== rendered) {
    process.stderr.write("release manifest is stale\n");
    process.exit(1);
  }
  process.stdout.write(
    `release manifest verified: ${manifest.release_digest}\n`,
  );
} else {
  process.stderr.write(
    "usage: build-release-manifest.mjs --content-digest|--write|--check\n",
  );
  process.exit(2);
}
