import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyApprovedSourceFile, resolveApprovedSourcePath } from "./approved-public-source.js";
import { PUBLIC_ARTIFACT_PATHS } from "./public-artifact-contract.js";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = buildStaticArtifact();
  console.log(`Built ${count} approved files in dist/client.`);
}

export function buildStaticArtifact({
  sourceRoot = path.resolve("public"),
  outputRoot = path.resolve("dist/client"),
  approvedPaths = PUBLIC_ARTIFACT_PATHS
} = {}) {
  const approvedSources = approvedPaths.map((relativePath) => {
    resolveApprovedSourcePath(sourceRoot, relativePath);
    return relativePath;
  });

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  try {
    for (const relativePath of approvedSources) {
      const outputPath = path.join(outputRoot, relativePath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      copyApprovedSourceFile(sourceRoot, relativePath, outputPath);
    }
  } catch (error) {
    fs.rmSync(outputRoot, { recursive: true, force: true });
    throw error;
  }
  return approvedSources.length;
}
