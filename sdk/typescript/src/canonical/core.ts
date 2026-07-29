import { encodeUtf8, sha256, StrictJsonError } from "./json.ts";

export { sha256 } from "./json.ts";

export const IDEMPOTENCY_DOMAIN = "foigent.event-idempotency.v1";
export const MAX_INT64 = 9223372036854775807n;
const MAX_UINT32 = 4294967295;

export interface Identity {
  readonly producerProduct: string;
  readonly producerInstance: string;
  readonly tenantRef: string | null;
  readonly orgRef: string;
  readonly projectRef: string;
  readonly eventType: string;
  readonly eventId: string;
}

export interface TimestampResult {
  readonly normalized?: string;
  readonly errorCode?: "invalid_timestamp" | "timestamp_precision_loss";
}

export function sourceHash(exactSourceBytes: Uint8Array): string {
  return sha256(exactSourceBytes);
}

export function isNfc(value: string): boolean {
  return value.normalize("NFC") === value;
}

export function isCanonicalPositiveDecimal(value: string): boolean {
  return /^[1-9][0-9]{0,19}$/.test(value);
}

export function isValidInt64Decimal(value: string): boolean {
  return /^(0|[1-9][0-9]{0,18})$/.test(value) &&
    BigInt(value) <= MAX_INT64;
}

export function isValidMicroAmount(value: string): boolean {
  return /^(0|[1-9][0-9]{0,18})$/.test(value);
}

export function buildIdentityInput(input: Identity): Uint8Array {
  for (
    const [name, value] of [
      ["producer.instance", input.producerInstance],
      ["event_id", input.eventId],
    ] as const
  ) {
    if (value.length === 0) {
      throw new StrictJsonError(
        "empty_identity_component",
        `${name} must not be empty`,
      );
    }
    encodeUtf8(value);
  }
  for (
    const [name, value] of [
      ["producer.product", input.producerProduct],
      ["event_type", input.eventType],
    ] as const
  ) {
    if (value.length === 0 || !isNfc(value)) {
      throw new StrictJsonError(
        "invalid_protocol_identity",
        `${name} must be nonempty NFC`,
      );
    }
  }
  if (!isCanonicalPositiveDecimal(input.orgRef)) {
    throw new StrictJsonError(
      "invalid_protocol_identity",
      "scope.org_ref must be a canonical positive decimal",
    );
  }
  if (!isCanonicalPositiveDecimal(input.projectRef)) {
    throw new StrictJsonError(
      "invalid_protocol_identity",
      "scope.project_ref must be a canonical positive decimal",
    );
  }
  if (input.tenantRef !== null && input.tenantRef.length === 0) {
    throw new StrictJsonError(
      "present_empty_identity_component",
      "present scope.tenant_ref must not be empty",
    );
  }

  const chunks = [
    encodeUtf8(IDEMPOTENCY_DOMAIN),
    lpUtf8(input.producerProduct),
    lpUtf8(input.producerInstance),
    lpUtf8(input.tenantRef),
    lpUtf8(input.orgRef),
    lpUtf8(input.projectRef),
    lpUtf8(input.eventType),
    lpUtf8(input.eventId),
  ];
  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function idempotencyKey(input: Identity): string {
  return sha256(buildIdentityInput(input));
}

export function lpUtf8(value: string | null): Uint8Array {
  if (value === null) {
    return new Uint8Array(4);
  }
  const bytes = encodeUtf8(value);
  if (value.length === 0) {
    throw new StrictJsonError(
      "present_empty_identity_component",
      "present identity component must not be empty",
    );
  }
  if (bytes.length > MAX_UINT32) {
    throw new StrictJsonError(
      "identity_component_too_large",
      "identity component exceeds uint32 byte length",
    );
  }
  const result = new Uint8Array(4 + bytes.length);
  new DataView(result.buffer).setUint32(0, bytes.length, false);
  result.set(bytes, 4);
  return result;
}

export function normalizeMicrosecondTimestamp(input: string): TimestampResult {
  const match =
    /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$/
      .exec(input);
  if (!match) {
    return { errorCode: "invalid_timestamp" };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8]!;
  if (
    !validDateTime(year, month, day, hour, minute, second) ||
    !validZone(zone)
  ) {
    return { errorCode: "invalid_timestamp" };
  }
  if (/[^0]/.test(fraction.slice(6))) {
    return { errorCode: "timestamp_precision_loss" };
  }
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, 0);
  const offsetMinutes = zone === "Z" ? 0 : parseOffsetMinutes(zone);
  const instant = new Date(local.getTime() - offsetMinutes * 60_000);
  const iso = instant.toISOString();
  if (!/^[0-9]{4}-/.test(iso)) {
    return { errorCode: "invalid_timestamp" };
  }
  return {
    normalized: `${iso.slice(0, 19)}.${fraction.slice(0, 6).padEnd(6, "0")}Z`,
  };
}

function validDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (
    year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 ||
    second > 59
  ) {
    return false;
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

function validZone(zone: string): boolean {
  if (zone === "Z") {
    return true;
  }
  const hours = Number(zone.slice(1, 3));
  const minutes = Number(zone.slice(4, 6));
  return hours <= 23 && minutes <= 59;
}

function parseOffsetMinutes(zone: string): number {
  const direction = zone[0] === "-" ? -1 : 1;
  return direction *
    (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
}
