import fs from "node:fs";
import path from "node:path";
import { resolveApprovedSourcePath } from "../scripts/approved-public-source.js";
import { buildStaticArtifact } from "../scripts/build-static.js";
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

const runRoot = path.resolve(".ai-work/runs");
fs.mkdirSync(runRoot, { recursive: true });
const fixtureRoot = fs.mkdtempSync(path.join(runRoot, "client-artifact-source-"));
try {
  const sourceRoot = path.join(fixtureRoot, "public");
  const outputRoot = path.join(fixtureRoot, "dist/client");
  const outsideRoot = path.join(fixtureRoot, "outside");
  fs.mkdirSync(path.join(sourceRoot, "nested"), { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "nested/page.html"), "<p>approved</p>\n");
  fs.writeFileSync(path.join(sourceRoot, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(outsideRoot, "private.txt"), "private fixture\n");

  const count = buildStaticArtifact({
    sourceRoot,
    outputRoot,
    approvedPaths: ["nested/page.html", "image.png"]
  });
  expect(count === 2, "The fixture build should preserve the approved inventory.");
  expect(fs.readFileSync(path.join(outputRoot, "nested/page.html"), "utf8") === "<p>approved</p>\n", "Regular nested files should copy unchanged.");
  expect(fs.readFileSync(path.join(outputRoot, "image.png")).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "Regular binary files should copy unchanged.");

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.rmSync(path.join(sourceRoot, "image.png"));
  fs.symlinkSync(path.join(outsideRoot, "private.txt"), path.join(sourceRoot, "image.png"));
  expectSourceRejection(
    () => buildStaticArtifact({ sourceRoot, outputRoot, approvedPaths: ["nested/page.html", "image.png"] }),
    /symbolic links/,
    "The build should reject an allowlisted source-file symlink"
  );
  expect(!fs.existsSync(outputRoot), "A rejected source symlink should not leave a destination artifact.");

  fs.symlinkSync(outsideRoot, path.join(sourceRoot, "linked-parent"));
  expectSourceRejection(
    () => resolveApprovedSourcePath(sourceRoot, "linked-parent/private.txt"),
    /symbolic links/,
    "The source guard should reject a symlinked parent directory"
  );
  fs.symlinkSync(path.join(outsideRoot, "missing.txt"), path.join(sourceRoot, "broken.png"));
  expectSourceRejection(
    () => resolveApprovedSourcePath(sourceRoot, "broken.png"),
    /symbolic links/,
    "The source guard should reject a broken symlink"
  );
  expectSourceRejection(
    () => resolveApprovedSourcePath(sourceRoot, "../outside/private.txt"),
    /escapes the source root/,
    "The source guard should reject lexical traversal"
  );

  fs.linkSync(path.join(outsideRoot, "private.txt"), path.join(sourceRoot, "hard-linked.png"));
  expectSourceRejection(
    () => resolveApprovedSourcePath(sourceRoot, "hard-linked.png"),
    /multiple hard links/,
    "The source guard should reject multiply linked files"
  );

  const raceSourceRoot = path.join(fixtureRoot, "race-public");
  const raceOutputRoot = path.join(fixtureRoot, "race-dist/client");
  fs.mkdirSync(raceSourceRoot, { recursive: true });
  fs.writeFileSync(path.join(raceSourceRoot, "first.txt"), "first approved file\n");
  fs.writeFileSync(path.join(raceSourceRoot, "second.txt"), "second approved file\n");
  const racePaths = ["first.txt", "second.txt"];
  Object.defineProperty(racePaths, 1, {
    configurable: true,
    enumerable: true,
    get() {
      fs.rmSync(path.join(raceSourceRoot, "first.txt"));
      fs.symlinkSync(path.join(outsideRoot, "private.txt"), path.join(raceSourceRoot, "first.txt"));
      return "second.txt";
    }
  });
  expectSourceRejection(
    () => buildStaticArtifact({ sourceRoot: raceSourceRoot, outputRoot: raceOutputRoot, approvedPaths: racePaths }),
    /symbolic links/,
    "The build should revalidate a source replaced after preflight"
  );
  expect(!fs.existsSync(raceOutputRoot), "A validation-to-copy swap should leave no partial artifact.");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error("Client artifact tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Client artifact tests passed.");
}

function expectSourceRejection(action, pattern, message) {
  try {
    action();
    failures.push(`${message}.`);
  } catch (error) {
    expect(pattern.test(error.message), `${message} with a specific error; received: ${error.message}`);
  }
}
