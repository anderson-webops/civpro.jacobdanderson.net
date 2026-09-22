import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writePrivateJson } from "../scripts/private-json.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "civ-pro-private-json-"));
const privateDirectory = path.join(root, "private-output");
fs.mkdirSync(privateDirectory, { mode: 0o755 });
const filePath = path.join(privateDirectory, "artifact.json");
writePrivateJson(filePath, { ok: true });

expect(JSON.parse(fs.readFileSync(filePath, "utf8")).ok === true, "Private JSON should preserve ordinary data.");
expect((fs.statSync(privateDirectory).mode & 0o777) === 0o700, "Private JSON should correct its output directory to mode 0700.");
expect((fs.statSync(filePath).mode & 0o777) === 0o600, "Private JSON should write files with mode 0600.");
expect(!fs.readdirSync(privateDirectory).some((name) => name.includes(".tmp-")), "Private JSON should not leave temporary files after success.");

const realDirectory = path.join(root, "real-directory");
const linkedDirectory = path.join(root, "linked-directory");
fs.mkdirSync(realDirectory);
fs.symlinkSync(realDirectory, linkedDirectory);
try {
  writePrivateJson(path.join(linkedDirectory, "unexpected.json"), { unsafe: true });
  expect(false, "Private JSON should reject a symlinked output directory.");
} catch (error) {
  expect(String(error.message).includes("real directory"), "Symlink rejection should explain the private-directory requirement.");
}
expect(!fs.existsSync(path.join(realDirectory, "unexpected.json")), "Rejected symlinked output should not create a file in its target.");

fs.rmSync(root, { recursive: true, force: true });

if (failures.length) {
  console.error("Private JSON tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Private JSON tests passed.");
