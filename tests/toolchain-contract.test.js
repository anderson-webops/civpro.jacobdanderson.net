import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = path.join(root, ".ai-work", "runs");
fs.mkdirSync(scratch, { recursive: true });
const fixture = fs.mkdtempSync(path.join(scratch, "toolchain-contract-"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const nodePin = fs.readFileSync(path.join(root, ".node-version"));
const cases = [
  { name: "matching static project", expected: 0 },
  { name: "production dependency", change: (value) => { value.dependencies = { unexpected: "1.0.0" }; } },
  { name: "unqualified npm metadata", change: (value) => { value.packageManager = "npm@12.0.2"; } },
  { name: "old Node engine", change: (value) => { value.engines.node = "24.18.1"; } },
  { name: "old npm engine", change: (value) => { value.engines.npm = "12.0.2"; } },
  { name: "unexpected development graph", change: (value) => { value.devDependencies.unexpected = "1.0.0"; } },
  { name: "old Node pin", pin: "24.18.1\n" },
];

try {
  fs.cpSync(path.join(root, "build-toolchain"), path.join(fixture, "build-toolchain"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  for (const name of ["check-build-toolchain.mjs", "build-toolchain-state.mjs"]) {
    fs.copyFileSync(path.join(root, "scripts", name), path.join(fixture, "scripts", name));
  }
  for (const testCase of cases) {
    const current = structuredClone(manifest);
    testCase.change?.(current);
    fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify(current));
    fs.writeFileSync(path.join(fixture, ".node-version"), testCase.pin || nodePin);
    fs.writeFileSync(path.join(fixture, ".nvmrc"), nodePin);
    const result = spawnSync(process.execPath, [path.join(fixture, "scripts", "check-build-toolchain.mjs")], {
      cwd: fixture, encoding: "utf8", timeout: 15_000,
    });
    assert.equal(result.error, undefined, testCase.name);
    assert.equal(result.signal, null, testCase.name);
    if (testCase.expected === 0) assert.equal(result.status, 0, `${testCase.name}: ${result.stderr}`);
    else assert.notEqual(result.status, 0, testCase.name);
  }
  console.log(`${cases.length} static toolchain contract cases passed.`);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
