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
const outputName = "implementation-manifest.v2.json";
const implementations = ["go", "typescript"].map((implementation) => ({
  implementation,
  directory: resolve(
    root,
    "implementations",
    "source-neutral-v2",
    implementation,
  ),
}));

if (!["--write", "--check"].includes(mode)) {
  process.stderr.write(
    "usage: build-source-neutral-v2-implementation-manifests.mjs " +
      "--write|--check\n",
  );
  process.exit(2);
}

for (const entry of implementations) {
  const rendered = renderManifest(entry);
  const path = resolve(entry.directory, outputName);
  if (mode === "--write") {
    writeFileSync(path, rendered, { encoding: "utf8", mode: 0o644 });
  } else if (readFileSync(path, "utf8") !== rendered) {
    process.stderr.write(
      `${entry.implementation} source-neutral source manifest is stale\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(
  `source-neutral v2 implementation manifests ${mode.slice(2)}: pass\n`,
);

function renderManifest(entry) {
  const prefix = `${entry.directory}${sep}`;
  const files = Object.fromEntries(
    collectFiles(entry.directory)
      .map((path) => {
        if (!path.startsWith(prefix)) {
          throw new Error(`${path} escapes ${entry.directory}`);
        }
        return [
          relative(entry.directory, path).split(sep).join("/"),
          sha256(readFileSync(path)),
        ];
      })
      .sort(([left], [right]) => compareText(left, right)),
  );
  if (Object.keys(files).length === 0) {
    throw new Error(`${entry.implementation} source set is empty`);
  }
  return `${JSON.stringify(
    {
      manifest_version: "foigent.conformance-implementation-manifest.v1",
      protocol_version: "2.0.0",
      protocol_status: "binding",
      implementation: entry.implementation,
      files,
    },
    null,
    2,
  )}\n`;
}

function collectFiles(directory, output = []) {
  for (
    const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => compareText(left.name, right.name),
    )
  ) {
    const path = resolve(directory, entry.name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      throw new Error(`symbolic link is forbidden: ${path}`);
    }
    if (info.isDirectory()) {
      collectFiles(path, output);
      continue;
    }
    if (!info.isFile()) {
      throw new Error(`non-regular implementation entry: ${path}`);
    }
    if (entry.name !== outputName) {
      output.push(path);
    }
  }
  return output;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
