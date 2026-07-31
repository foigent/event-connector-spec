import { resolve } from "node:path";
import { ArtifactFailure, createSourceNeutralReport } from "../src/source_neutral.ts";

const root = resolve(import.meta.dirname!, "..", "..", "..", "..");
const bundle = resolve(root, "vectors/source-neutral-vector-bundle.v2.json");

Deno.test("source-neutral bundle passes all exact cases", async () => {
  const run = await createSourceNeutralReport(bundle);
  assertEquals(run.status, "pass");
  assertEquals(run.caseCount, 39);
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
