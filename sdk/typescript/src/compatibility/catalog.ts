import {
  asArray,
  asObject,
  assertExactKeys,
  asString,
  parseStrictJsonBytes,
  sha256,
  StrictJsonError,
} from "../canonical/json.ts";

export const COMPATIBILITY_CATALOG_SHA256 =
  "sha256:57c02943a7b1b569f4431890cabc5877dae0f84a88c7427fa8f2986956174226";
export const PROTOCOL_VERSION = "1.1.2";
export const AUTHORITY_COMMIT = "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16";
export const PROTOCOL_RELEASE_SHA256 =
  "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1";

const CATALOG_VERSION = "foigent.event-connector-sdk-compatibility.v1";
const SHA = /^sha256:[0-9a-f]{64}$/;
const loadedCatalogs = new WeakSet<object>();

export interface CompatibilityPin {
  readonly consumer: string;
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly sourceRevision: string;
  readonly protocolVersion: string;
  readonly protocolReleaseDigest: string;
  readonly manifestSchemaSha256: string;
  readonly referenceManifestSha256: string;
  readonly projectionContractSha256: string;
}

export interface CompatibilityCatalog {
  readonly pins: readonly CompatibilityPin[];
}

export function loadCompatibilityCatalog(
  bytes: Uint8Array,
): CompatibilityCatalog {
  if (sha256(bytes) !== COMPATIBILITY_CATALOG_SHA256) {
    throw new StrictJsonError(
      "compatibility_catalog_digest_mismatch",
      "Compatibility catalog digest does not match the SDK pin",
    );
  }
  const root = asObject(
    parseStrictJsonBytes(bytes),
    "Compatibility catalog",
  );
  assertExactKeys(
    root,
    [
      "matrix_version",
      "sdk_candidate",
      "supported",
      "unknown_combination",
    ],
    [],
    "Compatibility catalog",
  );
  exact(root, "matrix_version", CATALOG_VERSION, "Compatibility catalog");
  exact(root, "unknown_combination", "fail_closed", "Compatibility catalog");

  const candidate = asObject(
    root.sdk_candidate,
    "Compatibility catalog.sdk_candidate",
  );
  assertExactKeys(
    candidate,
    ["protocol_version", "authority_commit", "release_digest"],
    [],
    "Compatibility catalog.sdk_candidate",
  );
  exact(candidate, "protocol_version", PROTOCOL_VERSION, "sdk_candidate");
  exact(candidate, "authority_commit", AUTHORITY_COMMIT, "sdk_candidate");
  exact(
    candidate,
    "release_digest",
    PROTOCOL_RELEASE_SHA256,
    "sdk_candidate",
  );

  const supported = asArray(
    root.supported,
    "Compatibility catalog.supported",
  );
  if (supported.length === 0) {
    throw new StrictJsonError(
      "invalid_compatibility_catalog",
      "Compatibility catalog must contain at least one tuple",
    );
  }
  const pins = supported.map((value, index) =>
    parsePin(
      asObject(value, `Compatibility catalog.supported[${index}]`),
      index,
    )
  );
  const identities = new Set(pins.map((pin) => JSON.stringify(pin)));
  if (identities.size !== pins.length) {
    throw new StrictJsonError(
      "invalid_compatibility_catalog",
      "Compatibility catalog contains a duplicate tuple",
    );
  }
  const catalog = Object.freeze({
    pins: Object.freeze(pins),
  });
  loadedCatalogs.add(catalog);
  return catalog;
}

export function validateCompatibilityPin(
  catalog: CompatibilityCatalog,
  candidate: CompatibilityPin,
): void {
  if (
    typeof catalog !== "object" || catalog === null ||
    !loadedCatalogs.has(catalog)
  ) {
    throw new StrictJsonError(
      "untrusted_compatibility_catalog",
      "Compatibility catalog must come from the exact-digest loader",
    );
  }
  if (!catalog.pins.some((supported) => samePin(supported, candidate))) {
    throw new StrictJsonError(
      "unsupported_compatibility",
      `Unsupported compatibility tuple ${candidate.consumer}/${candidate.connectorId}/${candidate.protocolVersion}`,
    );
  }
}

export function validateReleasedSourceRevision(revision: string): void {
  if (revision !== "1") {
    throw new StrictJsonError(
      "unsupported_source_revision",
      `Unsupported released Source revision ${JSON.stringify(revision)}`,
    );
  }
}

function parsePin(
  root: ReturnType<typeof asObject>,
  index: number,
): CompatibilityPin {
  const path = `Compatibility catalog.supported[${index}]`;
  const keys = [
    "consumer",
    "connector_id",
    "connector_version",
    "source_revision",
    "protocol_version",
    "protocol_release_digest",
    "manifest_schema_sha256",
    "reference_manifest_sha256",
    "projection_contract_sha256",
  ] as const;
  assertExactKeys(root, keys, [], path);
  const values = Object.fromEntries(
    keys.map((key) => [key, nonempty(root, key, path)]),
  ) as Record<(typeof keys)[number], string>;
  for (
    const key of [
      "protocol_release_digest",
      "manifest_schema_sha256",
      "reference_manifest_sha256",
      "projection_contract_sha256",
    ] as const
  ) {
    if (!SHA.test(values[key])) {
      throw new StrictJsonError(
        "invalid_compatibility_catalog",
        `${path}.${key} must be a lowercase SHA-256 reference`,
      );
    }
  }
  return Object.freeze({
    consumer: values.consumer,
    connectorId: values.connector_id,
    connectorVersion: values.connector_version,
    sourceRevision: values.source_revision,
    protocolVersion: values.protocol_version,
    protocolReleaseDigest: values.protocol_release_digest,
    manifestSchemaSha256: values.manifest_schema_sha256,
    referenceManifestSha256: values.reference_manifest_sha256,
    projectionContractSha256: values.projection_contract_sha256,
  });
}

function nonempty(
  root: ReturnType<typeof asObject>,
  key: string,
  path: string,
): string {
  const value = asString(root[key], `${path}.${key}`);
  if (value.length === 0) {
    throw new StrictJsonError(
      "invalid_compatibility_catalog",
      `${path}.${key} must not be empty`,
    );
  }
  return value;
}

function exact(
  root: ReturnType<typeof asObject>,
  key: string,
  expected: string,
  path: string,
): void {
  if (asString(root[key], `${path}.${key}`) !== expected) {
    throw new StrictJsonError(
      "invalid_compatibility_catalog",
      `${path}.${key} does not match the pinned authority`,
    );
  }
}

function samePin(
  left: CompatibilityPin,
  right: CompatibilityPin,
): boolean {
  return left.consumer === right.consumer &&
    left.connectorId === right.connectorId &&
    left.connectorVersion === right.connectorVersion &&
    left.sourceRevision === right.sourceRevision &&
    left.protocolVersion === right.protocolVersion &&
    left.protocolReleaseDigest === right.protocolReleaseDigest &&
    left.manifestSchemaSha256 === right.manifestSchemaSha256 &&
    left.referenceManifestSha256 === right.referenceManifestSha256 &&
    left.projectionContractSha256 === right.projectionContractSha256;
}
