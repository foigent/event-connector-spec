import { buildReport, marshalReport } from "./report.ts";

const rootIndex = Deno.args.indexOf("--protocol-root");
const reportIndex = Deno.args.indexOf("--report");
if (
  rootIndex < 0 || reportIndex < 0 ||
  rootIndex + 1 >= Deno.args.length || reportIndex + 1 >= Deno.args.length
) {
  console.error(
    "usage: runner.ts --protocol-root <path> --report <path>",
  );
  Deno.exit(2);
}

try {
  const report = await buildReport(
    Deno.args[rootIndex + 1]!,
    (path) => Deno.readFile(path),
  );
  await Deno.writeFile(
    Deno.args[reportIndex + 1]!,
    marshalReport(report),
    { mode: 0o600 },
  );
  console.log(`Foigent TypeScript SDK candidate: pass (${report.cases.length} cases)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exit(3);
}
