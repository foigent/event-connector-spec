import { buildIdentityInput, Identity } from "../canonical/core.ts";
import {
  canonicalBytes,
  parseStrictJsonBytes,
  sha256,
  toBase64,
  toHex,
} from "../canonical/json.ts";

export interface ReportCase {
  readonly case_id: string;
  readonly result_base64: string;
  readonly result_sha256: string;
}

export interface Report {
  readonly report_version: "foigent.event-connector-sdk-testkit.v1";
  readonly cases: readonly ReportCase[];
}

interface CanonicalCase {
  readonly case_id: string;
  readonly input_path: string;
  readonly canonical_bytes: number;
  readonly envelope_hash: string;
}

interface IdentityCase {
  readonly case_id: string;
  readonly producer_product: string;
  readonly producer_instance: string;
  readonly tenant_ref: string | null;
  readonly org_ref: string;
  readonly project_ref: string;
  readonly event_type: string;
  readonly event_id: string;
  readonly identity_input_hex: string;
  readonly idempotency_key: string;
}

interface VectorBundle {
  readonly canonical_envelopes: readonly CanonicalCase[];
  readonly idempotency: readonly IdentityCase[];
}

export type ReadFile = (absolutePath: string) => Promise<Uint8Array>;

export async function buildReport(
  protocolRoot: string,
  readFile: ReadFile,
): Promise<Report> {
  const cases: ReportCase[] = [];
  for (
    const relative of [
      "vectors/canonical-vector-bundle.v1.json",
      "vectors/litellm-connector-vector-bundle.v1.json",
    ]
  ) {
    const bundle = JSON.parse(
      new TextDecoder().decode(await readFile(join(protocolRoot, relative))),
    ) as VectorBundle;
    for (const testCase of bundle.canonical_envelopes) {
      const input = await readFile(join(protocolRoot, testCase.input_path));
      const output = canonicalBytes(parseStrictJsonBytes(input));
      const digest = sha256(output);
      if (
        output.byteLength !== testCase.canonical_bytes ||
        digest !== testCase.envelope_hash
      ) {
        throw new Error(
          `${testCase.case_id}: immutable canonical expectation mismatch`,
        );
      }
      cases.push({
        case_id: `canonical_envelopes/${testCase.case_id}`,
        result_base64: toBase64(output),
        result_sha256: digest,
      });
    }
    for (const testCase of bundle.idempotency) {
      const identity: Identity = {
        producerProduct: testCase.producer_product,
        producerInstance: testCase.producer_instance,
        tenantRef: testCase.tenant_ref,
        orgRef: testCase.org_ref,
        projectRef: testCase.project_ref,
        eventType: testCase.event_type,
        eventId: testCase.event_id,
      };
      const output = buildIdentityInput(identity);
      const digest = sha256(output);
      if (
        toHex(output) !== testCase.identity_input_hex ||
        digest !== testCase.idempotency_key
      ) {
        throw new Error(
          `${testCase.case_id}: immutable identity expectation mismatch`,
        );
      }
      cases.push({
        case_id: `idempotency/${testCase.case_id}`,
        result_base64: toBase64(output),
        result_sha256: digest,
      });
    }
  }
  return {
    report_version: "foigent.event-connector-sdk-testkit.v1",
    cases,
  };
}

export function marshalReport(report: Report): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(report)}\n`);
}

function join(root: string, relative: string): string {
  return `${root.replace(/\/+$/, "")}/${relative}`;
}
