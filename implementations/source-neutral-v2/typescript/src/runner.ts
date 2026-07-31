#!/usr/bin/env -S deno run --quiet --allow-read --allow-write

import { dirname, resolve } from "node:path";
import { ArtifactFailure, createSourceNeutralReport } from "./source_neutral.ts";

interface Arguments {
  bundle: string;
  report: string;
}

if (import.meta.main) {
  await main();
}

async function main(): Promise<void> {
  let args: Arguments;
  try {
    args = parseArguments(Deno.args);
  } catch {
    boundedError("invalid invocation");
    Deno.exit(2);
  }
  if (resolve(args.bundle) === resolve(args.report)) {
    boundedError("bundle and report paths must differ");
    Deno.exit(2);
  }
  try {
    const run = await createSourceNeutralReport(args.bundle);
    await Deno.mkdir(dirname(resolve(args.report)), { recursive: true });
    await Deno.writeFile(resolve(args.report), run.reportBytes);
    console.log(
      `typescript source-neutral conformance: ${run.status} (${run.caseCount} cases)`,
    );
    if (run.status !== "pass") {
      Deno.exit(3);
    }
  } catch (error) {
    if (error instanceof ArtifactFailure) {
      boundedError(`invalid protocol artifact: ${error.message}`);
      Deno.exit(2);
    }
    boundedError("conformance runner internal failure");
    Deno.exit(4);
  }
}

function parseArguments(values: readonly string[]): Arguments {
  if (values.length !== 4) {
    throw new Error("expected four arguments");
  }
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (
      (flag !== "--bundle" && flag !== "--report") ||
      value === undefined || value.length === 0 || parsed.has(flag)
    ) {
      throw new Error("invalid arguments");
    }
    parsed.set(flag, value);
  }
  const bundle = parsed.get("--bundle");
  const report = parsed.get("--report");
  if (bundle === undefined || report === undefined) {
    throw new Error("missing argument");
  }
  return { bundle, report };
}

function boundedError(message: string): void {
  console.error(message.length <= 512 ? message : message.slice(0, 512));
}
