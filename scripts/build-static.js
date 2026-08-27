import fs from "node:fs";
import path from "node:path";
import { PUBLIC_ARTIFACT_PATHS } from "./public-artifact-contract.js";

const sourceRoot = path.resolve("public");
const outputRoot = path.resolve("dist/client");

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const relativePath of PUBLIC_ARTIFACT_PATHS) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const outputPath = path.join(outputRoot, relativePath);
  if (!fs.statSync(sourcePath).isFile()) throw new Error(`Approved public file is missing: ${relativePath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
}

console.log(`Built ${PUBLIC_ARTIFACT_PATHS.length} approved files in dist/client.`);
