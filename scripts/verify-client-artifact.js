import fs from "node:fs";
import path from "node:path";
import {
  ALLOWED_EXTERNAL_HOSTS,
  FORBIDDEN_PUBLIC_SEGMENTS,
  PUBLIC_ARTIFACT_PATHS
} from "./public-artifact-contract.js";

const root = path.resolve("dist/client");
const failures = [];
const expected = [...PUBLIC_ARTIFACT_PATHS].sort();
const actual = listFiles(root).sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  failures.push(`Artifact inventory differs from the allowlist. Expected ${expected.length} files; found ${actual.length}.`);
}

for (const relativePath of actual) {
  const absolutePath = path.join(root, relativePath);
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) failures.push(`${relativePath} must not be a symlink.`);
  if (relativePath.split("/").some((part) => part.startsWith("."))) failures.push(`${relativePath} is a hidden path.`);
  for (const segment of FORBIDDEN_PUBLIC_SEGMENTS) {
    if (relativePath === segment || relativePath.startsWith(segment) || relativePath.includes(`/${segment}`)) {
      failures.push(`${relativePath} matches forbidden public segment ${segment}.`);
    }
  }
  if (!/\.(?:css|html|js|png|svg)$/.test(relativePath) && relativePath !== "_headers") {
    failures.push(`${relativePath} has an unapproved public file type.`);
  }
  if (/\.(?:css|html|js|svg)$/.test(relativePath) || relativePath === "_headers") {
    inspectText(relativePath, fs.readFileSync(absolutePath, "utf8"), failures);
  }
}

if (failures.length) {
  throw new Error(`Client artifact verification failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Verified ${actual.length} allowlisted public files with no private paths, secrets, symlinks, or unapproved hosts.`);

function listFiles(directory, prefix = "") {
  if (!fs.existsSync(directory)) throw new Error("dist/client does not exist. Run npm run build first.");
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolutePath, relativePath));
    else files.push(relativePath);
  }
  return files;
}

function inspectText(relativePath, text, failures) {
  const sensitivePatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"'<>{}\s]{12,}["']/i,
    /\/Users\/[A-Za-z0-9._-]+\//,
    /(?:file|vscode):\/\//i
  ];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(text)) failures.push(`${relativePath} matches sensitive text pattern ${pattern}.`);
  }
  const urls = text.match(/https?:\/\/[^\s"'<>`)]+/g) || [];
  for (const rawUrl of urls) {
    try {
      const host = new URL(rawUrl.replace(/&amp;/g, "&")).hostname;
      if (!ALLOWED_EXTERNAL_HOSTS.has(host)) failures.push(`${relativePath} references unapproved external host ${host}.`);
    } catch {
      failures.push(`${relativePath} contains an invalid external URL.`);
    }
  }
}
