#!/usr/bin/env -S deno run --quiet --allow-read --allow-write

import { dirname, resolve } from "node:path";
import { ArtifactFailure, createConformanceReport } from "./conformance.ts";

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
    writeBoundedError("invalid invocation");
    Deno.exit(2);
  }

  if (resolve(args.bundle) === resolve(args.report)) {
    writeBoundedError("bundle and report paths must differ");
    Deno.exit(2);
  }

  try {
    const run = await createConformanceReport(args.bundle);
    await Deno.mkdir(dirname(resolve(args.report)), { recursive: true });
    await Deno.writeFile(resolve(args.report), run.reportBytes);
    const status = run.failures.length === 0 ? "pass" : "fail";
    console.log(
      `typescript conformance: ${status} (${
        String(
          (run.report.cases as unknown[]).length,
        )
      } cases)`,
    );
    if (run.failures.length > 0) {
      Deno.exit(3);
    }
  } catch (error) {
    if (error instanceof ArtifactFailure) {
      writeBoundedError(`invalid protocol artifact: ${error.message}`);
      Deno.exit(2);
    }
    writeBoundedError("conformance runner internal failure");
    Deno.exit(4);
  }
}

function parseArguments(values: readonly string[]): Arguments {
  if (values.length !== 4) {
    throw new Error("expected exactly four arguments");
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
    throw new Error("missing arguments");
  }
  return { bundle, report };
}

function writeBoundedError(message: string): void {
  const bounded = message.length <= 512 ? message : message.slice(0, 512);
  console.error(bounded);
}
