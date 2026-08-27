import fs from "node:fs";
import path from "node:path";
import { FORBIDDEN_PUBLIC_SEGMENTS, PUBLIC_ARTIFACT_PATHS } from "../scripts/public-artifact-contract.js";

const failures = [];
const root = path.resolve("dist/client");
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(fs.existsSync(path.join(root, "index.html")), "The portable artifact should contain index.html.");
expect(fs.existsSync(path.join(root, "guides/index.html")), "The portable artifact should contain the searchable guide library.");
expect(fs.existsSync(path.join(root, "_headers")), "The portable artifact should contain static security headers.");
expect(!fs.existsSync(path.join(root, "rule-tests.js")), "Browser-facing rule tests should not ship.");

for (const sensitivePath of [".env", ".env.example", "ops", "scripts", "tests", "data", ".git", ".github"]) {
  expect(!fs.existsSync(path.join(root, sensitivePath)), `${sensitivePath} must not be publicly deployable.`);
}

expect(PUBLIC_ARTIFACT_PATHS.every((item) => !FORBIDDEN_PUBLIC_SEGMENTS.includes(item)), "The allowlist should not contain a forbidden path.");

if (failures.length) {
  console.error("Client artifact tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Client artifact tests passed.");
}
