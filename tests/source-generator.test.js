import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LIVE_PROBES,
  SOURCE_PROVIDERS
} from "../scripts/legal-source-config.js";
import { hasValue, loadEnv, mergedEnv } from "../scripts/load-env.js";
import {
  buildManifest,
  buildProbeStatus,
  buildRequest,
  inferResultCount,
  redactHeaders,
  redactUrl
} from "../scripts/sync-legal-sources.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const blankEnv = { LEGAL_SOURCE_CACHE_DIR: "data/legal-sources" };
const manifest = await buildManifest({ env: blankEnv, live: false });
const keyBackedProviders = SOURCE_PROVIDERS.filter((provider) => provider.envKeys.length > 0);
const noKeyProviders = SOURCE_PROVIDERS.filter((provider) => provider.envKeys.length === 0);

expect(manifest.live === false, "Default source manifest should be non-live.");
expect(manifest.schemaVersion === 2, "The source manifest should use the traceable Version 2 schema.");
expect(manifest.sourceCards.length === manifest.doctrineSources.length, "Ruling source cards should include governing doctrine sources only.");
expect(manifest.referenceCards.length === manifest.providers.length + 1, "Reference cards should separate providers plus the future-amendment lane.");
expect(manifest.referenceCards.every((card) => ["provider-metadata", "future-amendment"].includes(card.authorityType)), "Reference cards should be explicitly typed as non-ruling material.");
expect(manifest.sourceReview.reviewedThrough === "2026-08-27", "The manifest should record the source review date.");
expect(noKeyProviders.every((provider) => manifest.providers.find((item) => item.id === provider.id)?.configured), "No-key providers should be configured.");
expect(keyBackedProviders.every((provider) => !manifest.providers.find((item) => item.id === provider.id)?.configured), "Key-backed providers should be unconfigured with blank env.");
expect(manifest.liveProbes.every((probe) => probe.status === "cataloged"), "Non-live probes should be cataloged without network calls.");

const govinfoProbe = LIVE_PROBES.find((probe) => probe.provider === "govinfo");
const skippedProbe = await buildProbeStatus(govinfoProbe, blankEnv, true);
expect(skippedProbe.status === "skipped", "Live key-backed probe should skip when API key is blank.");
expect(skippedProbe.missingEnv.includes("GOVINFO_API_KEY"), "Skipped govinfo probe should report missing key.");

const fakeEnv = {
  GOVINFO_API_KEY: "fake-govinfo-key",
  COURTLISTENER_API_TOKEN: "fake-courtlistener-token",
  CONGRESS_API_KEY: "fake-congress-key",
  OPENSTATES_API_KEY: "fake-openstates-key",
  PACER_USERNAME: "fake-pacer-user",
  PACER_PASSWORD: "fake-pacer-password",
  LEGAL_SOURCE_CACHE_DIR: "data/legal-sources"
};
const configuredManifest = await buildManifest({ env: fakeEnv, live: false });
expect(configuredManifest.providers.every((provider) => provider.configured), "All providers should configure when fake keys are supplied.");

const pacerProbe = LIVE_PROBES.find((probe) => probe.provider === "pacer");
const restrictedPacerProbe = await buildProbeStatus(pacerProbe, fakeEnv, true);
expect(restrictedPacerProbe.status === "restricted", "PACER probe should not perform restricted access by default.");
const includedPacerProbe = await buildProbeStatus(pacerProbe, fakeEnv, true, { includeRestricted: true });
expect(includedPacerProbe.status === "configured", "PACER restricted probe should confirm credentials when explicitly included.");
expect(includedPacerProbe.request.method === "MANUAL", "PACER restricted probe should remain a manual no-network check.");

const courtListenerProbe = LIVE_PROBES.find((probe) => probe.provider === "courtlistener");
const request = buildRequest(courtListenerProbe, fakeEnv);
expect(request.headers.Authorization === "Token fake-courtlistener-token", "CourtListener request should interpolate token for runtime fetch.");
expect(redactHeaders(request.headers).Authorization === "<redacted>", "Authorization header should redact before manifest output.");

const govinfoRequest = buildRequest(govinfoProbe, fakeEnv);
expect(govinfoRequest.url.includes("fake-govinfo-key"), "govinfo runtime request should include the supplied key.");
expect(!redactUrl(govinfoRequest.url).includes("fake-govinfo-key"), "govinfo manifest request URL should redact the supplied key.");

expect(inferResultCount({ count: 12 }) === 12, "inferResultCount should read count.");
expect(inferResultCount({ results: [{}, {}] }) === 2, "inferResultCount should read results array.");
expect(inferResultCount({ titles: [{}] }) === 1, "inferResultCount should read eCFR titles array.");
expect(inferResultCount({ unexpected: true }) === null, "inferResultCount should return null for unknown payload shape.");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "civ-pro-env-"));
const envFile = path.join(tmpDir, ".env.test");
fs.writeFileSync(envFile, "PLAIN=value\nBLANK=\nQUOTED=\"two words\"\nSINGLE='one word'\n# ignored\nBAD LINE\n");
const loaded = loadEnv(envFile);
expect(loaded.PLAIN === "value", "loadEnv should parse plain values.");
expect(loaded.BLANK === "", "loadEnv should preserve explicit blank values.");
expect(loaded.QUOTED === "two words", "loadEnv should strip double quotes.");
expect(loaded.SINGLE === "one word", "loadEnv should strip single quotes.");
expect(hasValue(loaded, "PLAIN"), "hasValue should accept nonblank values.");
expect(!hasValue(loaded, "BLANK"), "hasValue should reject blank values.");

process.env.CIV_PRO_TEST_ENV_KEEP = "from-process";
fs.writeFileSync(envFile, "CIV_PRO_TEST_ENV_KEEP=\nCIV_PRO_TEST_ENV_OVERRIDE=from-file\n");
const merged = mergedEnv(envFile);
expect(merged.CIV_PRO_TEST_ENV_KEEP === "from-process", "mergedEnv should not overwrite process env with blank .env values.");
expect(merged.CIV_PRO_TEST_ENV_OVERRIDE === "from-file", "mergedEnv should include nonblank .env values.");
delete process.env.CIV_PRO_TEST_ENV_KEEP;

if (failures.length) {
  console.error("Source generator tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Source generator tests passed.");
