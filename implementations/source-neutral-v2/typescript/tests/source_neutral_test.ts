import { resolve } from "node:path";
import { ArtifactFailure, createSourceNeutralReport } from "../src/source_neutral.ts";

const root = resolve(import.meta.dirname!, "..", "..", "..", "..");
const bundle = resolve(root, "vectors/source-neutral-vector-bundle.v2.json");

Deno.test("source-neutral bundle passes all exact cases", async () => {
  const run = await createSourceNeutralReport(bundle);
  assertEquals(run.status, "pass");
  assertEquals(run.caseCount, 47);
  const cases = run.report.cases;
  if (!Array.isArray(cases)) {
    throw new Error("report cases are absent");
  }
  const missing = cases.find((value) =>
    typeof value === "object" && value !== null &&
    !Array.isArray(value) &&
    value.case_id === "openinference_mapping/missing-optional-facts"
  );
  if (
    typeof missing !== "object" || missing === null ||
    Array.isArray(missing) || typeof missing.result_base64 !== "string"
  ) {
    throw new Error("missing-optional mapping result is absent");
  }
  const envelope = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(missing.result_base64),
        (character) => character.charCodeAt(0),
      ),
    ),
  );
  assertEquals(envelope.actor.type, "system");
  assertEquals(Object.keys(envelope.payload.usage).length, 0);
  assertEquals(envelope.payload.capture_gaps.length, 7);
  const ordered = cases.filter((value) =>
    typeof value === "object" && value !== null &&
    !Array.isArray(value) &&
    typeof value.case_id === "string" &&
    value.case_id.startsWith("openinference_mapping/ordered-")
  );
  assertEquals(ordered.length, 3);
});

Deno.test("bundle identity fails closed", async () => {
  const temporary = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(temporary, "{}");
    await assertRejects(
      () => createSourceNeutralReport(temporary),
      ArtifactFailure,
      "bundle digest mismatch",
    );
  } finally {
    await Deno.remove(temporary);
  }
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `assertEquals failed: actual=${String(actual)} expected=${String(expected)}`,
    );
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  expectedType: new (...args: never[]) => Error,
  expectedMessage: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof expectedType)) {
      throw new Error("assertRejects failed: unexpected error type");
    }
    if (!error.message.includes(expectedMessage)) {
      throw new Error("assertRejects failed: unexpected error message");
    }
    return;
  }
  throw new Error("assertRejects failed: operation resolved");
}
