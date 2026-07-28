#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = readJSON(
  "manifests/foigent.litellm.spend-logs-1.0.0.json",
);
const publicKey = readFileSync(
  resolve(root, "evidence/upstream/litellm-cosign.pub"),
);
const signatures = readJSON(
  "evidence/upstream/litellm-v1.93.0-cosign-verify.json",
);
const sourceEvidence = readJSON(
  "evidence/upstream/litellm-v1.93.0-source-contract.json",
);
const upstreamMapping = readJSON(
  "mappings/litellm/spend-logs-v2-to-sanitized-source.v1.json",
);

const expectedDigest = manifest.source_release.image.index_digest;
const expectedReference =
  `${manifest.source_release.image.repository}@${expectedDigest}`;

check(
  sha256(publicKey) === manifest.source_release.signature.public_key_sha256,
  "LiteLLM cosign public-key digest mismatch",
);
check(
  manifest.source_release.signature.verified_index_digest === expectedDigest,
  "LiteLLM verified image digest mismatch",
);
check(
  Array.isArray(signatures) && signatures.length === 2,
  "LiteLLM cosign evidence must contain exactly two verified statements",
);
const statementTypes = new Set();
for (const signature of signatures) {
  check(
    signature?.critical?.identity?.["docker-reference"] === expectedReference,
    "LiteLLM cosign identity mismatch",
  );
  check(
    signature?.critical?.image?.["docker-manifest-digest"] === expectedDigest,
    "LiteLLM cosign subject digest mismatch",
  );
  check(
    signature.optional !== null &&
      typeof signature.optional === "object" &&
      Object.keys(signature.optional).length === 0,
    "LiteLLM cosign evidence contains unexpected optional claims",
  );
  statementTypes.add(signature.critical.type);
}
check(
  statementTypes.size === 2 &&
    statementTypes.has("https://sigstore.dev/cosign/sign/v1") &&
    statementTypes.has("https://spdx.dev/Document"),
  "LiteLLM cosign statement types mismatch",
);

check(
  sourceEvidence.source.tag === manifest.source_release.version &&
    sourceEvidence.source.commit === manifest.source_release.git_commit,
  "LiteLLM Source evidence identity mismatch",
);
check(
  sourceEvidence.verified_contract.route ===
      `GET ${manifest.transport.route}` &&
    upstreamMapping.upstream.route === manifest.transport.route &&
    upstreamMapping.upstream.version === manifest.source_release.version,
  "LiteLLM Source route/version evidence mismatch",
);
check(
  sourceEvidence.verified_contract.page_size_maximum ===
    manifest.transport.max_items,
  "LiteLLM page-size evidence mismatch",
);
check(
  upstreamMapping.page_invariants.maximum_cumulative_response_bytes ===
    manifest.transport.max_bytes,
  "LiteLLM response-byte bound mismatch",
);

process.stdout.write(
  `LiteLLM upstream evidence verified: ${manifest.source_release.version} ${expectedDigest}\n`,
);
