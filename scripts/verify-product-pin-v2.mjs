#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const actionRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith("--")) {
      pairs.push([value.slice(2), values[index + 1]]);
    }
    return pairs;
  }, []),
);
if (!args.pin || !args.product) {
  process.stderr.write(
    "usage: verify-product-pin-v2.mjs " +
      "--pin <path> --product <unirouter|xinsight>\n",
  );
  process.exit(2);
}

const pin = JSON.parse(readFileSync(resolve(args.pin), "utf8"));
const release = JSON.parse(
  readFileSync(
    resolve(
      actionRoot,
      `releases/v${pin.protocol_version}/release-manifest.json`,
    ),
    "utf8",
  ),
);

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

function check(condition, message) {
  if (!condition) {
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

function readReleaseFile(path, label) {
  const info = lstatSync(path);
  check(info.isFile() && !info.isSymbolicLink(), `${label} is not a regular file`);
  return readFileSync(path);
}

check(
  release.release_manifest_version ===
    "foigent.protocol-release-manifest.v2",
  "invalid v2 release manifest",
);
check(release.protocol_version === "2.0.2", "unexpected protocol version");
check(
  release.protocol_version === pin.protocol_version,
  "protocol version mismatch",
);
check(
  release.authority.repository ===
      "https://github.com/foigent/event-connector-spec" &&
    release.authority.repository_id === 1313391565 &&
    release.authority.tag === "v2.0.2",
  "unexpected release authority",
);
check(
  release.boundary.product_adoption === "not_authorized" &&
    release.boundary.runtime_mutation === "none",
  "release boundary changed",
);
for (const [name, component] of Object.entries(release.components)) {
  const componentPath = resolve(actionRoot, component.path);
  check(
    componentPath.startsWith(`${actionRoot}${sep}`),
    `${name} escapes action root`,
  );
  check(
    sha256(readReleaseFile(componentPath, name)) === component.sha256,
    `${name} release component digest mismatch`,
  );
}
const {
  release_digest: releaseDigest,
  content_digest: contentDigest,
  approvals,
  ...releaseContentHashInput
} = release;
check(
  contentDigest ===
    sha256(Buffer.from(canonicalize(releaseContentHashInput), "utf8")),
  "release content digest mismatch",
);
check(
  Array.isArray(approvals) &&
    approvals.map((entry) => entry.role).join("\n") ===
      ["source_domain_owner", "projection_owner", "coordinator"].join("\n"),
  "release approvals mismatch",
);
for (const approval of approvals) {
  check(approval.status === "confirmed", `${approval.role} is not confirmed`);
  check(
    approval.reviewed_content_digest === contentDigest,
    `${approval.role} reviewed content mismatch`,
  );
  const evidencePath = resolve(actionRoot, approval.evidence.path);
  check(
    evidencePath.startsWith(`${actionRoot}${sep}`),
    `${approval.role} evidence escapes action root`,
  );
  check(
    sha256(readReleaseFile(evidencePath, `${approval.role} evidence`)) ===
      approval.evidence.sha256,
    `${approval.role} evidence digest mismatch`,
  );
}
const releaseHashInput = {
  ...releaseContentHashInput,
  content_digest: contentDigest,
  approvals,
};
check(
  releaseDigest ===
    sha256(Buffer.from(canonicalize(releaseHashInput), "utf8")),
  "release manifest digest mismatch",
);

check(pin.pin_version === "foigent.protocol-pin.v2", "invalid pin_version");
check(pin.product === args.product, "product pin mismatch");
check(pin.release_digest === release.release_digest, "release digest mismatch");
check(
  pin.authority.repository === release.authority.repository &&
    pin.authority.repository_id === release.authority.repository_id &&
    pin.authority.tag === release.authority.tag,
  "authority mismatch",
);

const expectedByProduct = {
  unirouter: [
    "shared_ci_action",
    "protocol_spec",
    "predecessor_release_manifest",
    "event_envelope_schema",
    "capture_gap_schema",
    "connector_manifest_schema",
    "connector_lifecycle_schema",
    "connector_checkpoint_schema",
    "event_batch_schema",
    "connector_error_schema",
    "operational_receipt_schema",
    "reference_connector_manifest",
    "source_projection_contract",
    "source_lifecycle_mapping",
    "source_identity_mapping",
    "v1_to_v2_compatibility_matrix",
    "conformance_contract",
    "vector_bundle",
    "conformance_kit_runner",
  ],
  xinsight: [
    "shared_ci_action",
    "protocol_spec",
    "predecessor_release_manifest",
    "event_envelope_schema",
    "capture_gap_schema",
    "connector_manifest_schema",
    "connector_lifecycle_schema",
    "connector_checkpoint_schema",
    "event_batch_schema",
    "connector_error_schema",
    "operational_receipt_schema",
    "domain_catalog",
    "openinference_source_schema",
    "openinference_payload_schema",
    "openinference_connector_manifest",
    "openinference_otlp_source_mapping",
    "openinference_event_mapping",
    "xinsight_openinference_projection",
    "openinference_compatibility_matrix",
    "reference_projection_contract",
    "consumer_lifecycle_mapping",
    "consumer_identity_mapping",
    "reference_compatibility_vector_bundle",
    "v1_to_v2_compatibility_matrix",
    "conformance_contract",
    "vector_bundle",
    "conformance_kit_runner",
  ],
};
const expected = expectedByProduct[pin.product];
check(expected !== undefined, "unsupported product");
check(
  Object.keys(pin.components).sort().join("\n") ===
    [...expected].sort().join("\n"),
  "pinned component set mismatch",
);
for (const name of expected) {
  check(release.components[name] !== undefined, `${name} release component absent`);
  check(
    pin.components[name] === release.components[name].sha256,
    `${name} digest mismatch`,
  );
}

process.stdout.write(
  `product protocol pin verified: ${pin.product} ${pin.protocol_version} ${pin.release_digest}\n`,
);
