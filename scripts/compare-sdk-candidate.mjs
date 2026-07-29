import { readFile } from "node:fs/promises";

if (process.argv.length !== 8) {
  console.error(
    "usage: compare-sdk-candidate.mjs <go-sdk> <typescript-sdk> <go-reference> <typescript-reference> <go-litellm> <typescript-litellm>",
  );
  process.exit(2);
}

const paths = process.argv.slice(2);
const bytes = await Promise.all(paths.map((path) => readFile(path)));
if (!bytes[0].equals(bytes[1])) {
  throw new Error("Go and TypeScript SDK reports are not byte-identical");
}

const [
  goSDK,
  typescriptSDK,
  goReference,
  typescriptReference,
  goLiteLLM,
  typescriptLiteLLM,
] = bytes.map((value) => JSON.parse(value.toString("utf8")));

if (
  goSDK.report_version !== "foigent.event-connector-sdk-testkit.v1" ||
  typescriptSDK.report_version !== goSDK.report_version
) {
  throw new Error("unexpected SDK report version");
}
if (goSDK.cases.length !== 12) {
  throw new Error(`SDK report must contain exactly 12 shared byte cases`);
}

const reports = [
  ["go-reference", goReference],
  ["typescript-reference", typescriptReference],
  ["go-litellm", goLiteLLM],
  ["typescript-litellm", typescriptLiteLLM],
];
const indexes = new Map(
  reports.map(([name, report]) => [
    name,
    new Map(report.cases.map((testCase) => [testCase.case_id, testCase])),
  ]),
);

for (const sdkCase of goSDK.cases) {
  const names = sdkCase.case_id.includes("litellm")
    ? ["go-litellm", "typescript-litellm"]
    : ["go-reference", "typescript-reference"];
  for (const name of names) {
    const authority = indexes.get(name).get(sdkCase.case_id);
    if (authority === undefined) {
      throw new Error(`${name} is missing ${sdkCase.case_id}`);
    }
    if (
      authority.result_base64 !== sdkCase.result_base64 ||
      authority.result_sha256 !== sdkCase.result_sha256
    ) {
      throw new Error(`${name} byte drift for ${sdkCase.case_id}`);
    }
  }
}

console.log(
  "Foigent SDK/current-runner byte comparison: pass (12 SDK cases, 4 authority reports)",
);
