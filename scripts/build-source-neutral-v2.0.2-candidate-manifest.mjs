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
const mode = process.argv[2] ?? "--check";
const outputPath = resolve(
  root,
  "docs/candidates/v2.0.2-rc.1/candidate-manifest.json",
);

if (!["--write", "--check", "--content-digest"].includes(mode)) {
  process.stderr.write(
    "usage: build-source-neutral-v2.0.2-candidate-manifest.mjs " +
      "--write|--check|--content-digest\n",
  );
  process.exit(2);
}

const predecessorManifestPath =
  "releases/v2.0.1/release-manifest.json";
const predecessor = JSON.parse(
  readFileSync(resolve(root, predecessorManifestPath), "utf8"),
);
const predecessorComponentPaths = Object.fromEntries(
  Object.entries(predecessor.components).map(([name, component]) => [
    name,
    component.path,
  ]),
);
for (const name of [
  "candidate_manifest_archive",
  "candidate_source_owner_review",
  "candidate_projection_owner_review",
  "candidate_coordinator_review",
]) {
  delete predecessorComponentPaths[name];
}

const componentPaths = {
  ...predecessorComponentPaths,
  predecessor_candidate_manifest_archive:
    "docs/candidates/v2.0.1-rc.1/candidate-manifest.json",
  predecessor_candidate_source_owner_review:
    "reviews/candidates/v2.0.1-rc.1/source-owner-review.md",
  predecessor_candidate_projection_owner_review:
    "reviews/candidates/v2.0.1-rc.1/projection-owner-review.md",
  predecessor_candidate_coordinator_review:
    "reviews/candidates/v2.0.1-rc.1/coordinator-review.md",
  release_decision:
    "docs/decisions/0005-composite-action-snapshot-portability-candidate.md",
  predecessor_release_manifest: predecessorManifestPath,
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
  immediate_predecessor_conformance_kit:
    "scripts/run-v2.0.1-predecessor-kit.sh",
  v2_0_0_predecessor_conformance_kit:
    "scripts/run-v2.0.0-predecessor-kit.sh",
  candidate_manifest_builder:
    "scripts/build-source-neutral-v2.0.2-candidate-manifest.mjs",
  release_builder:
    "scripts/build-source-neutral-v2-release-manifest.mjs",
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
};

const paths = Object.values(componentPaths);
if (new Set(paths).size !== paths.length) {
  throw new Error("candidate component paths must be unique");
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
const hashInput = {
  candidate_manifest_version: "foigent.protocol-candidate-manifest.v1",
  protocol_version: "2.0.2",
  protocol_status: "not_binding",
  authority: {
    repository: "https://github.com/foigent/event-connector-spec",
    repository_id: 1313391565,
  },
  predecessor: {
    protocol_version: "2.0.1",
    tag: "v2.0.1",
    tag_object: "c24531c24955bc700133387dd7352a88e5ba82be",
    tag_commit: "0cbb6417858d12d6a99ff3b517bd59a122bc7e2c",
    tree: "f967929dd98c5f34cd42fce4aa21489b72b000e0",
    manifest_sha256:
      "sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60",
    content_digest:
      "sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e",
    release_digest:
      "sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777",
  },
  reviewed_candidate: {
    commit: "6f729d9a3cf819e5c538ba8bd3a16a85cdc42967",
    tree: "5fb49fb450257dd1c40e33f6f8358e6dd434a367",
    manifest_sha256:
      "sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02",
    content_digest:
      "sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7",
  },
  candidate_reviews: {
    source_domain_owner: {
      path: "reviews/candidates/v2.0.2-rc.1/source-owner-review.md",
      commit: "e1c2b5966c24dcac67662a768e8e19114f4a959c",
      tree: "f7e3383fcbdf6a6b149d3f8fd1a7b29e147b3773",
      sha256:
        "sha256:a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f",
      status: "SOURCE_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
    },
    projection_owner: {
      path: "reviews/candidates/v2.0.2-rc.1/projection-owner-review.md",
      commit: "140dc19f8455ba38949b2b81a356767ccb070792",
      tree: "1891bee63c60394ae39d24829f575ed67c4a18d7",
      sha256:
        "sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed",
      status: "PROJECTION_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
    },
    coordinator: {
      path: "reviews/candidates/v2.0.2-rc.1/coordinator-review.md",
      commit: "be63f837ae9e442a255da607ac9d35290be1a5eb",
      tree: "0d20561130c4d90936bcc08e4b1c6c45c78542ad",
      sha256:
        "sha256:5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429",
      status: "COORDINATOR_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
    },
  },
  compatibility: "PATCH_COMPATIBLE_CI_PORTABILITY_FIX",
  components,
};
for (const [role, review] of Object.entries(hashInput.candidate_reviews)) {
  const bytes = readRegular(review.path, `${role} candidate review`);
  if (sha256(bytes) !== review.sha256) {
    throw new Error(`${role} candidate review bytes changed`);
  }
  const text = bytes.toString("utf8");
  for (const required of [
    `Role: \`${role}\``,
    `Status: \`${review.status}\``,
    hashInput.reviewed_candidate.commit,
    hashInput.reviewed_candidate.tree,
    hashInput.reviewed_candidate.manifest_sha256,
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
  process.stderr.write("source-neutral v2.0.2 candidate manifest is stale\n");
  process.exit(1);
} else {
  process.stdout.write(`candidate manifest verified: ${contentDigest}\n`);
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
