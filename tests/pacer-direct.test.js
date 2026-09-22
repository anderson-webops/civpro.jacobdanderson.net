import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SECURE_PACER_DIRECT_CONFIG } from "../scripts/pacer-direct-config.js";
import {
  buildAuthRequest,
  buildImportManifest,
  buildPclCaseSearchRequest,
  getPacerCacheDir,
  getReviewedAllowlistEntries,
  loadAllowlist,
  normalizeEnvironment,
  runPacerDirectImport,
  sanitizeForCache,
  validateRuntime
} from "../scripts/pacer-direct-import.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const fakeEnv = {
  PACER_USERNAME: "fake-pacer-user-secret",
  PACER_PASSWORD: "fake-pacer-password-secret",
  PACER_CLIENT_CODE: "fake-client-code-secret",
  PACER_OTP_CODE: "123456",
  PACER_REDACT_FLAG: "1",
  LEGAL_PRIVATE_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "civ-pro-pacer-cache-"))
};

expect(SECURE_PACER_DIRECT_CONFIG.enabledByDefault === false, "Direct PACER config should be disabled by default.");
expect(SECURE_PACER_DIRECT_CONFIG.frontendSafe === false, "Direct PACER config should be marked unsafe for frontend use.");
expect(SECURE_PACER_DIRECT_CONFIG.defaultEnvironment === "qa", "Direct PACER imports should default to QA.");
expect(SECURE_PACER_DIRECT_CONFIG.allowlistPath.startsWith("ops/legal-sources/"), "PACER allowlist should live outside the public static tree.");
expect(getPacerCacheDir({}).endsWith("ops/legal-sources/cache/pacer-direct"), "PACER cache should default outside the public static tree.");
expect(normalizeEnvironment("QA") === "qa", "PACER environment normalization should accept QA casing.");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "civ-pro-pacer-allowlist-"));
const allowlistPath = path.join(tmpDir, "allowlist.json");
fs.writeFileSync(allowlistPath, `${JSON.stringify({
  schemaVersion: 1,
  entries: [
    {
      id: "disabled-example",
      enabled: false,
      reviewed: false,
      kind: "pcl-case-search",
      criteria: { caseNumberFull: "1:2002bk20340" }
    },
    {
      id: "reviewed-example",
      enabled: true,
      reviewed: true,
      kind: "pcl-case-search",
      description: "Reviewed test case",
      criteria: {
        caseNumberFull: "1:2002bk20340",
        courtId: "ilnb"
      },
      intendedUse: "metadata-only"
    }
  ]
}, null, 2)}\n`);

const allowlist = loadAllowlist(allowlistPath);
const entries = getReviewedAllowlistEntries(allowlist);
expect(entries.length === 1, "Only enabled and reviewed PACER entries should be eligible.");
expect(entries[0].id === "reviewed-example", "Eligible PACER entry should preserve the reviewed id.");
expect(entries[0].criteria.caseNumberFull === "1:2002bk20340", "PACER entry should keep exact caseNumberFull criteria.");

fs.writeFileSync(path.join(tmpDir, "unreviewed.json"), `${JSON.stringify({
  schemaVersion: 1,
  entries: [
    {
      id: "enabled-unreviewed",
      enabled: true,
      reviewed: false,
      kind: "pcl-case-search",
      criteria: { caseNumberFull: "1:2002bk20340" }
    }
  ]
})}\n`);
try {
  getReviewedAllowlistEntries(loadAllowlist(path.join(tmpDir, "unreviewed.json")));
  expect(false, "Enabled unreviewed PACER entries should block import.");
} catch (error) {
  expect(String(error.message).includes("not reviewed"), "Enabled unreviewed entry error should mention review.");
}

fs.writeFileSync(path.join(tmpDir, "broad.json"), `${JSON.stringify({
  schemaVersion: 1,
  entries: [
    {
      id: "broad-search",
      enabled: true,
      reviewed: true,
      kind: "pcl-case-search",
      criteria: { caseTitle: "Smith" }
    }
  ]
})}\n`);
try {
  getReviewedAllowlistEntries(loadAllowlist(path.join(tmpDir, "broad.json")));
  expect(false, "Broad PACER searches without caseNumberFull should be rejected.");
} catch (error) {
  expect(String(error.message).includes("unsupported search field") || String(error.message).includes("caseNumberFull"), "Broad search rejection should explain the criteria problem.");
}

try {
  validateRuntime({
    env: fakeEnv,
    environment: "qa",
    entries,
    execute: true
  });
  expect(false, "PACER execution should require PACER_DIRECT_ENABLED.");
} catch (error) {
  expect(String(error.message).includes("PACER_DIRECT_ENABLED=true"), "Execution guard should require PACER_DIRECT_ENABLED=true.");
}

try {
  validateRuntime({
    env: { ...fakeEnv, PACER_DIRECT_ENABLED: "true" },
    environment: "production",
    entries,
    execute: true
  });
  expect(false, "Production PACER execution should require the production guard.");
} catch (error) {
  expect(String(error.message).includes("PACER_DIRECT_ALLOW_PRODUCTION=true"), "Production guard should require PACER_DIRECT_ALLOW_PRODUCTION=true.");
}

const authRequest = buildAuthRequest(fakeEnv, "qa");
expect(authRequest.url.includes("qa-login.uscourts.gov"), "QA auth request should use the QA login host.");
expect(authRequest.body.loginId === fakeEnv.PACER_USERNAME, "Auth request should use PACER_USERNAME at runtime.");
expect(authRequest.body.password === fakeEnv.PACER_PASSWORD, "Auth request should use PACER_PASSWORD at runtime.");

const searchRequest = buildPclCaseSearchRequest(entries[0], "fake-token-secret", "qa");
expect(searchRequest.url.endsWith("/cases/find?page=0"), "PCL case search should use the immediate case-search endpoint.");
expect(searchRequest.headers["X-NEXT-GEN-CSO"] === "fake-token-secret", "PCL case search should attach the PACER token only in server-side request headers.");

const dirty = {
  loginId: fakeEnv.PACER_USERNAME,
  password: fakeEnv.PACER_PASSWORD,
  clientCode: fakeEnv.PACER_CLIENT_CODE,
  csoId: 12345,
  nextGenCSO: "a".repeat(128),
  nested: {
    "X-NEXT-GEN-CSO": "b".repeat(128),
    publicCaseNumber: "1:2002bk20340"
  }
};
const clean = sanitizeForCache(dirty);
const cleanText = JSON.stringify(clean);
expect(!cleanText.includes(fakeEnv.PACER_USERNAME), "Sanitized PACER cache should redact loginId values.");
expect(!cleanText.includes(fakeEnv.PACER_PASSWORD), "Sanitized PACER cache should redact password values.");
expect(!cleanText.includes(fakeEnv.PACER_CLIENT_CODE), "Sanitized PACER cache should redact clientCode values.");
expect(!cleanText.includes("a".repeat(64)), "Sanitized PACER cache should redact long auth tokens.");
expect(clean.nested.publicCaseNumber === "1:2002bk20340", "Sanitized PACER cache should retain public case identifiers.");

const dryRun = await runPacerDirectImport({
  argv: ["--dry-run", "--allowlist", allowlistPath],
  env: fakeEnv,
  now: () => new Date("2026-05-17T12:00:00.000Z")
});
expect(dryRun.mode === "dry-run", "PACER dry run should report dry-run mode.");
expect(dryRun.networkRequestsMade === 0, "PACER dry run should not make network requests.");
expect(fs.existsSync(dryRun.manifestPath), "PACER dry run should write an ignored local manifest.");
const dryRunText = fs.readFileSync(dryRun.manifestPath, "utf8");
expect(dryRunText.includes("PACER Case Locator direct API"), "PACER dry run should include provenance.");
expect(dryRunText.includes("2026-05-17T12:00:00.000Z"), "PACER dry run should include a retrieval/generated timestamp.");
expect(!dryRunText.includes(fakeEnv.PACER_USERNAME), "PACER dry run manifest should not contain the username.");
expect(!dryRunText.includes(fakeEnv.PACER_PASSWORD), "PACER dry run manifest should not contain the password.");
expect(!dryRunText.includes(fakeEnv.PACER_CLIENT_CODE), "PACER dry run manifest should not contain the client code.");
expect((fs.statSync(dryRun.manifestPath).mode & 0o777) === 0o600, "PACER dry run manifest should be owner-readable only.");
expect((fs.statSync(path.dirname(dryRun.manifestPath)).mode & 0o777) === 0o700, "PACER cache directory should be owner-accessible only.");

const manifest = buildImportManifest({
  mode: "execute",
  environment: "qa",
  allowlistPath,
  entries,
  generatedAt: "2026-05-17T12:00:00.000Z",
  cachedArtifacts: [{ entryId: "reviewed-example", kind: "pcl-case-search", httpStatus: 200, artifactPath: path.join(fakeEnv.LEGAL_PRIVATE_CACHE_DIR, "artifact.json") }],
  networkRequestsMade: 1
});
expect(manifest.safeguards.some((item) => item.includes("CourtListener/RECAP")), "PACER manifest should preserve CourtListener/RECAP as the default path.");
expect(manifest.safeguards.some((item) => item.includes("excluded from static frontend")), "PACER manifest should state frontend/public refresh exclusion.");

const executeCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "civ-pro-pacer-execute-cache-"));
const executedFetches = [];
const executeTimes = [
  new Date("2026-05-17T13:00:00.000Z"),
  new Date("2026-05-17T13:00:01.000Z")
];
const executeResult = await runPacerDirectImport({
  argv: ["--execute", "--allowlist", allowlistPath],
  env: {
    ...fakeEnv,
    PACER_DIRECT_ENABLED: "true",
    LEGAL_PRIVATE_CACHE_DIR: executeCacheDir
  },
  now: () => executeTimes.shift() || new Date("2026-05-17T13:00:02.000Z"),
  fetchImpl: async (url, options) => {
    executedFetches.push({ url, options });
    if (url.includes("cso-auth")) {
      return new Response(JSON.stringify({
        nextGenCSO: "t".repeat(128),
        loginResult: "0",
        errorDescription: "",
        loginId: fakeEnv.PACER_USERNAME
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.includes("/cases/find")) {
      return new Response(JSON.stringify({
        receipt: {
          loginId: fakeEnv.PACER_USERNAME,
          clientCode: fakeEnv.PACER_CLIENT_CODE,
          csoId: 12345,
          searchFee: ".10"
        },
        content: [
          {
            courtId: "ilnb",
            caseNumberFull: "1:2002bk20340",
            caseTitle: "Reviewed Test Case"
          }
        ]
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-NEXT-GEN-CSO": "u".repeat(128)
        }
      });
    }
    if (url.includes("cso-logout")) {
      return new Response(JSON.stringify({ loginResult: "0", errorDescription: "" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected PACER test URL: ${url}`);
  }
});
expect(executeResult.mode === "execute", "Mocked PACER execute run should report execute mode.");
expect(executeResult.networkRequestsMade === 1, "Mocked PACER execute run should count one case-search request.");
expect(executedFetches.length === 3, "Mocked PACER execute run should authenticate, search once, and logout.");
expect(executedFetches.every((entry) => entry.options.redirect === "error"), "PACER requests should reject redirects rather than forwarding credentials or tokens.");
expect(executedFetches[1].url.endsWith("/cases/find?page=0"), "Mocked PACER execute run should call only the case-search endpoint for the allowlist entry.");
expect(JSON.parse(executedFetches[1].options.body).caseNumberFull === "1:2002bk20340", "Mocked PACER execute run should search only the reviewed case number.");
expect(executeResult.cachedArtifacts.length === 1, "Mocked PACER execute run should cache one artifact.");
const artifactPath = path.join(process.cwd(), executeResult.cachedArtifacts[0].artifactPath);
expect(fs.existsSync(artifactPath), "Mocked PACER execute run should write the cached artifact.");
expect((fs.statSync(artifactPath).mode & 0o777) === 0o600, "PACER cached artifacts should be owner-readable only.");
expect((fs.statSync(path.dirname(artifactPath)).mode & 0o777) === 0o700, "PACER entry cache directories should be owner-accessible only.");
expect((fs.statSync(executeResult.manifestPath).mode & 0o777) === 0o600, "PACER execute manifest should be owner-readable only.");
expect(!fs.readdirSync(path.dirname(artifactPath)).some((name) => name.includes(".tmp-")), "PACER writes should not leave temporary files after success.");
const executeText = `${fs.readFileSync(executeResult.manifestPath, "utf8")}\n${fs.readFileSync(artifactPath, "utf8")}`;
expect(executeText.includes("operator-reviewed direct import"), "Mocked PACER artifact should include provenance.");
expect(executeText.includes("2026-05-17T13:00:01.000Z"), "Mocked PACER artifact should include retrieval timestamp.");
expect(!executeText.includes(fakeEnv.PACER_USERNAME), "Mocked PACER artifacts should not contain PACER username values.");
expect(!executeText.includes(fakeEnv.PACER_PASSWORD), "Mocked PACER artifacts should not contain PACER password values.");
expect(!executeText.includes(fakeEnv.PACER_CLIENT_CODE), "Mocked PACER artifacts should not contain PACER client code values.");
expect(!executeText.includes("t".repeat(64)), "Mocked PACER artifacts should not contain auth tokens.");
expect(!executeText.includes("u".repeat(64)), "Mocked PACER artifacts should not contain refreshed auth tokens.");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const scriptName of ["sources", "sources:live", "sources:live:restricted", "artifacts:candidates", "artifacts:all"]) {
  expect(!packageJson.scripts[scriptName].includes("pacer-direct-import"), `${scriptName} should not invoke direct PACER import.`);
}
expect(packageJson.scripts.serve.includes("--directory public"), "Local dev server should serve only the public static tree.");

const ingestionScript = fs.readFileSync("scripts/ingest-game-artifacts.js", "utf8");
expect(ingestionScript.includes("ops/legal-sources/provider-candidates.local.json"), "Provider candidate output should live outside the public static tree.");
expect(!ingestionScript.includes("data/ingestion/provider-candidates.local.json"), "Provider candidate output should not target the old static-tree path.");

for (const filePath of ["public/index.html", "public/app.js", "public/data.js", "public/legal-sources.generated.js", "public/game-artifacts.generated.js"]) {
  const text = fs.readFileSync(filePath, "utf8");
  expect(!text.includes("pacer-direct-import"), `${filePath} should not import direct PACER code.`);
  expect(!text.includes("pcl-public-api/rest"), `${filePath} should not contain PACER PCL direct endpoints.`);
  expect(!text.includes("services/cso-auth"), `${filePath} should not contain PACER auth endpoints.`);
  expect(!text.includes("X-NEXT-GEN-CSO"), `${filePath} should not contain PACER auth headers.`);
}

if (failures.length) {
  console.error("PACER direct import tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PACER direct import tests passed.");
