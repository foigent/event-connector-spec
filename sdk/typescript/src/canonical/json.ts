import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export type JsonScalar = null | boolean | string | number | bigint;
export type JsonValue = JsonScalar | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER;
export const DEFAULT_LIMITS: Limits = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxDepth: 64,
});

export interface Limits {
  readonly maxBytes: number;
  readonly maxDepth: number;
}

export class StrictJsonError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StrictJsonError";
  }
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StrictJsonError("invalid_utf8", "JSON bytes are not valid UTF-8");
  }
}

export function encodeUtf8(value: string): Uint8Array {
  assertUnicodeScalars(value);
  return new TextEncoder().encode(value);
}

export function parseStrictJsonBytes(
  bytes: Uint8Array,
  limits: Limits = DEFAULT_LIMITS,
): JsonValue {
  validateLimits(bytes.byteLength, limits);
  return new StrictJsonParser(decodeUtf8(bytes), limits.maxDepth).parse();
}

export function parseStrictJson(
  text: string,
  limits: Limits = DEFAULT_LIMITS,
): JsonValue {
  const bytes = encodeUtf8(text);
  validateLimits(bytes.byteLength, limits);
  return new StrictJsonParser(text, limits.maxDepth).parse();
}

class StrictJsonParser {
  private offset = 0;
  private depth = 0;

  constructor(
    private readonly text: string,
    private readonly maxDepth: number,
  ) {}

  parse(): JsonValue {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.offset !== this.text.length) {
      throw this.error("invalid_json", "JSON contains trailing content");
    }
    return value;
  }

  private parseValue(): JsonValue {
    const character = this.text[this.offset];
    switch (character) {
      case "{":
        return this.parseObject();
      case "[":
        return this.parseArray();
      case '"':
        return this.parseString();
      case "t":
        return this.parseLiteral("true", true);
      case "f":
        return this.parseLiteral("false", false);
      case "n":
        return this.parseLiteral("null", null);
      default:
        if (character === "-" || isDigit(character)) {
          return this.parseNumber();
        }
        throw this.error("invalid_json", "JSON contains an invalid value");
    }
  }

  private parseObject(): JsonObject {
    this.enterContainer();
    try {
      return this.parseObjectBody();
    } finally {
      this.depth--;
    }
  }

  private parseObjectBody(): JsonObject {
    this.offset++;
    this.skipWhitespace();
    const result: JsonObject = Object.create(null) as JsonObject;
    const keys = new Set<string>();
    if (this.text[this.offset] === "}") {
      this.offset++;
      return result;
    }
    while (true) {
      if (this.text[this.offset] !== '"') {
        throw this.error("invalid_json", "JSON object key must be a string");
      }
      const key = this.parseString();
      if (keys.has(key)) {
        throw this.error(
          "duplicate_json_key",
          `JSON object contains duplicate key ${JSON.stringify(key)}`,
        );
      }
      keys.add(key);
      this.skipWhitespace();
      this.expect(":");
      this.skipWhitespace();
      Object.defineProperty(result, key, {
        value: this.parseValue(),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.skipWhitespace();
      const delimiter = this.text[this.offset];
      if (delimiter === "}") {
        this.offset++;
        return result;
      }
      this.expect(",");
      this.skipWhitespace();
    }
  }

  private parseArray(): JsonValue[] {
    this.enterContainer();
    try {
      return this.parseArrayBody();
    } finally {
      this.depth--;
    }
  }

  private parseArrayBody(): JsonValue[] {
    this.offset++;
    this.skipWhitespace();
    const result: JsonValue[] = [];
    if (this.text[this.offset] === "]") {
      this.offset++;
      return result;
    }
    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      const delimiter = this.text[this.offset];
      if (delimiter === "]") {
        this.offset++;
        return result;
      }
      this.expect(",");
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.offset;
    this.offset++;
    let escaped = false;
    while (this.offset < this.text.length) {
      const character = this.text[this.offset]!;
      this.offset++;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        const token = this.text.slice(start, this.offset);
        let value: unknown;
        try {
          value = JSON.parse(token);
        } catch {
          throw this.error("invalid_json", "JSON string token is invalid");
        }
        if (typeof value !== "string") {
          throw this.error("invalid_json", "JSON string token is invalid");
        }
        assertUnicodeScalars(value);
        return value;
      }
    }
    throw this.error("invalid_json", "JSON string is unterminated");
  }

  private parseNumber(): number | bigint {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
      this.text.slice(this.offset),
    );
    if (!match) {
      throw this.error("invalid_json", "JSON number is invalid");
    }
    const token = match[0];
    this.offset += token.length;
    if (token.includes(".") || token.includes("e") || token.includes("E")) {
      throw this.error(
        "unsafe_json_number",
        "Frozen canonical profile accepts JSON integers only",
      );
    }
    let value: bigint;
    try {
      value = BigInt(token);
    } catch {
      throw this.error("invalid_json", "JSON integer is invalid");
    }
    if (value >= MIN_SAFE_INTEGER && value <= MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return value;
  }

  private parseLiteral<T extends JsonScalar>(token: string, value: T): T {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) {
      throw this.error("invalid_json", `Expected JSON literal ${token}`);
    }
    this.offset += token.length;
    return value;
  }

  private expect(character: string): void {
    if (this.text[this.offset] !== character) {
      throw this.error("invalid_json", `Expected ${character}`);
    }
    this.offset++;
  }

  private skipWhitespace(): void {
    while (isJsonWhitespace(this.text[this.offset])) {
      this.offset++;
    }
  }

  private error(code: string, message: string): StrictJsonError {
    return new StrictJsonError(code, `${message} at byte offset ${this.offset}`);
  }

  private enterContainer(): void {
    this.depth++;
    if (this.depth > this.maxDepth) {
      this.depth--;
      throw this.error(
        "json_depth_exceeded",
        `JSON nesting depth exceeds ${this.maxDepth}`,
      );
    }
  }
}

export function canonicalize(value: JsonValue): string {
  if (value === null || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    assertUnicodeScalars(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new StrictJsonError(
        "unsafe_json_number",
        `Unsafe or non-integral JSON number ${value}`,
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") {
    if (value < MIN_SAFE_INTEGER || value > MAX_SAFE_INTEGER) {
      throw new StrictJsonError(
        "unsafe_json_number",
        `Unsafe JSON integer ${value}`,
      );
    }
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  const members = Object.keys(value)
    .sort()
    .map((key) => {
      assertUnicodeScalars(key);
      return `${JSON.stringify(key)}:${canonicalize(value[key]!)}`;
    });
  return `{${members.join(",")}}`;
}

export function canonicalBytes(value: JsonValue): Uint8Array {
  return encodeUtf8(canonicalize(value));
}

export function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function fromHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(value)) {
    throw new Error("hex input must contain lowercase complete bytes");
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

export function assertUnicodeScalars(value: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isFinite(next) || next < 0xdc00 || next > 0xdfff) {
        throw new StrictJsonError(
          "invalid_unicode",
          "String contains an unpaired high surrogate",
        );
      }
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new StrictJsonError(
        "invalid_unicode",
        "String contains an unpaired low surrogate",
      );
    }
  }
}

export function asObject(
  value: JsonValue | undefined,
  name: string,
): JsonObject {
  if (
    value === null || Array.isArray(value) || typeof value !== "object"
  ) {
    throw new StrictJsonError("invalid_artifact", `${name} must be an object`);
  }
  return value;
}

export function asArray(value: JsonValue | undefined, name: string): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new StrictJsonError("invalid_artifact", `${name} must be an array`);
  }
  return value;
}

export function asString(value: JsonValue | undefined, name: string): string {
  if (typeof value !== "string") {
    throw new StrictJsonError("invalid_artifact", `${name} must be a string`);
  }
  return value;
}

export function asBoolean(value: JsonValue | undefined, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new StrictJsonError("invalid_artifact", `${name} must be a boolean`);
  }
  return value;
}

export function asSafeInteger(
  value: JsonValue | undefined,
  name: string,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new StrictJsonError(
      "invalid_artifact",
      `${name} must be a safe JSON integer`,
    );
  }
  return value;
}

export function asInteger(value: JsonValue | undefined, name: string): bigint {
  if (
    typeof value !== "number" && typeof value !== "bigint"
  ) {
    throw new StrictJsonError("invalid_artifact", `${name} must be an integer`);
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new StrictJsonError("invalid_artifact", `${name} must be an integer`);
  }
  return BigInt(value);
}

export function assertExactKeys(
  object: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
  name = "object",
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in object)) {
      throw new StrictJsonError(
        "invalid_artifact",
        `${name}.${key} is required`,
      );
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new StrictJsonError(
        "invalid_artifact",
        `${name} contains unknown field ${key}`,
      );
    }
  }
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "0" && character <= "9";
}

function isJsonWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" ||
    character === "\r";
}

function validateLimits(byteLength: number, limits: Limits): void {
  if (
    !Number.isSafeInteger(limits.maxBytes) || limits.maxBytes <= 0 ||
    !Number.isSafeInteger(limits.maxDepth) || limits.maxDepth <= 0
  ) {
    throw new StrictJsonError(
      "invalid_json_limits",
      "JSON limits must be positive safe integers",
    );
  }
  if (byteLength > limits.maxBytes) {
    throw new StrictJsonError(
      "json_bytes_exceeded",
      `JSON input exceeds ${limits.maxBytes} bytes`,
    );
  }
}
