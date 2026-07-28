#!/usr/bin/env -S deno run --quiet --allow-read --allow-write

import { dirname, resolve } from "node:path";
import {
  createLiteLLMConformanceReport,
  LiteLLMArtifactFailure,
} from "./litellm_conformance.ts";

if (import.meta.main) {
  await main();
}

async function main(): Promise<void> {
  const values = Deno.args;
  if (
    values.length !== 4 || values[0] !== "--bundle" ||
    values[2] !== "--report" || !values[1] || !values[3]
  ) {
    console.error("exactly --bundle <bundle> --report <report> is required");
    Deno.exit(2);
  }
  const bundle = resolve(values[1]);
  const report = resolve(values[3]);
  if (bundle === report) {
    console.error("bundle and report paths must differ");
    Deno.exit(2);
  }
  try {
    const run = await createLiteLLMConformanceReport(bundle);
    await Deno.mkdir(dirname(report), { recursive: true });
    await Deno.writeFile(report, run.reportBytes);
    console.log(
      `typescript LiteLLM conformance: ${
        run.failures.length === 0 ? "pass" : "fail"
      } (${(run.report.cases as JsonValue[]).length} cases)`,
    );
    if (run.failures.length > 0) Deno.exit(3);
  } catch (error) {
    if (error instanceof LiteLLMArtifactFailure) {
      console.error(`invalid LiteLLM artifact: ${error.message}`);
      Deno.exit(2);
    }
    console.error("LiteLLM conformance runner internal failure");
    Deno.exit(4);
  }
}

type JsonValue =
  | null
  | boolean
  | string
  | number
  | bigint
  | JsonValue[]
  | { [key: string]: JsonValue };
