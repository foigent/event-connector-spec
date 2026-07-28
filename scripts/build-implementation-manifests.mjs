#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] ?? "--check";
const manifestName = "implementation-manifest.v1.json";
const artifacts = [
  {
    label: "go",
    directory: resolve(root, "implementations", "go"),
    outputName: manifestName,
    identity: {
      manifest_version:
        "foigent.conformance-implementation-manifest.v1",
      protocol_version: "1.1.2",
      implementation: "go",
    },
  },
  {
    label: "typescript",
    directory: resolve(root, "implementations", "typescript"),
    outputName: manifestName,
    identity: {
      manifest_version:
        "foigent.conformance-implementation-manifest.v1",
      protocol_version: "1.1.2",
      implementation: "typescript",
    },
  },
  {
    label: "schema-audit",
    directory: resolve(root, "tools", "schema-audit"),
    outputName: "source-manifest.v1.json",
    identity: {
      manifest_version: "foigent.tool-source-manifest.v1",
      protocol_version: "1.1.2",
      tool: "schema-audit",
    },
  },
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function collectFiles(directory, excludedName, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => compareText(left.name, right.name),
  )) {
    const path = resolve(directory, entry.name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      throw new Error(`symbolic link is forbidden: ${path}`);
    }
    if (info.isDirectory()) {
      collectFiles(path, excludedName, output);
      continue;
    }
    if (!info.isFile()) {
      throw new Error(`non-regular implementation entry: ${path}`);
    }
    if (entry.name !== excludedName) {
      output.push(path);
    }
  }
  return output;
}

function renderManifest(artifact) {
  const { directory, identity, label, outputName } = artifact;
  const prefix = `${directory}${sep}`;
  const files = Object.fromEntries(
    collectFiles(directory, outputName)
      .map((path) => {
        if (!path.startsWith(prefix)) {
          throw new Error(`${path} escapes ${directory}`);
        }
        return [
          relative(directory, path).split(sep).join("/"),
          sha256(readFileSync(path)),
        ];
      })
      .sort(([left], [right]) => compareText(left, right)),
  );
  if (Object.keys(files).length === 0) {
    throw new Error(`${label} source set is empty`);
  }
  return `${JSON.stringify(
    {
      ...identity,
      files,
    },
    null,
    2,
  )}\n`;
}

if (!["--write", "--check"].includes(mode)) {
  process.stderr.write(
    "usage: build-implementation-manifests.mjs --write|--check\n",
  );
  process.exit(2);
}

for (const artifact of artifacts) {
  const outputPath = resolve(artifact.directory, artifact.outputName);
  const rendered = renderManifest(artifact);
  if (mode === "--write") {
    writeFileSync(outputPath, rendered, { encoding: "utf8", mode: 0o644 });
  } else if (readFileSync(outputPath, "utf8") !== rendered) {
    process.stderr.write(
      `${artifact.label} source manifest is stale\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(`source manifests ${mode.slice(2)}: pass\n`);
