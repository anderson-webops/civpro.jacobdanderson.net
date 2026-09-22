import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchBoundedResponse } from "./bounded-http.js";
import { hasValue, mergedEnv } from "./load-env.js";
import { ensurePrivateDirectory, writePrivateJson } from "./private-json.js";
import { SECURE_PACER_DIRECT_CONFIG } from "./pacer-direct-config.js";

const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|passcode|otp|token|secret|nextgencso|next-gen-cso|x-next-gen-cso|loginid|clientcode|csoid|firmid/i;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9+/=_-]{48,}\b/g;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const result = await runPacerDirectImport({
    argv,
    env: options.env || mergedEnv(),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    now: options.now || (() => new Date())
  });
  printPacerImportSummary(result);
  return result;
}

export async function runPacerDirectImport({
  argv = [],
  env = mergedEnv(),
  fetchImpl = globalThis.fetch,
  now = () => new Date()
} = {}) {
  const args = parsePacerImportArgs(argv);
  const execute = args.execute;
  const environment = normalizeEnvironment(
    args.environment || env[SECURE_PACER_DIRECT_CONFIG.environmentEnvKey] || SECURE_PACER_DIRECT_CONFIG.defaultEnvironment
  );
  const allowlist = loadAllowlist(args.allowlistPath || SECURE_PACER_DIRECT_CONFIG.allowlistPath);
  const entries = getReviewedAllowlistEntries(allowlist);
  const cacheDir = getPacerCacheDir(env);
  const generatedAt = now().toISOString();

  if (!execute) {
    const manifest = buildImportManifest({
      mode: "dry-run",
      environment,
      allowlistPath: allowlist.path,
      entries,
      generatedAt,
      cachedArtifacts: [],
      networkRequestsMade: 0
    });
    const manifestPath = writeImportManifest(cacheDir, manifest, generatedAt);
    return { ...manifest, manifestPath };
  }

  validateRuntime({ env, environment, entries, execute });
  if (typeof fetchImpl !== "function") {
    throw new Error("Direct PACER import requires a fetch implementation.");
  }

  const authentication = await authenticateWithPacer({ env, environment, fetchImpl });
  const cachedArtifacts = [];
  let currentToken = authentication.token;

  try {
    for (const entry of entries) {
      const fetchedAt = now().toISOString();
      const result = await fetchPclCaseSearch({
        entry,
        token: currentToken,
        environment,
        fetchImpl
      });
      if (result.refreshedToken) {
        currentToken = result.refreshedToken;
      }

      const artifact = buildCachedPacerArtifact({
        entry,
        environment,
        retrievedAt: fetchedAt,
        result
      });
      const artifactPath = writeCachedPacerArtifact(cacheDir, entry.id, artifact, fetchedAt);
      cachedArtifacts.push({
        entryId: entry.id,
        kind: entry.kind,
        httpStatus: result.httpStatus,
        artifactPath
      });
    }
  } finally {
    await logoutFromPacer({ token: currentToken, environment, fetchImpl });
  }

  const manifest = buildImportManifest({
    mode: "execute",
    environment,
    allowlistPath: allowlist.path,
    entries,
    generatedAt,
    cachedArtifacts,
    networkRequestsMade: entries.length
  });
  const manifestPath = writeImportManifest(cacheDir, manifest, generatedAt);
  return { ...manifest, manifestPath };
}

export function parsePacerImportArgs(argv) {
  const args = {
    execute: false,
    allowlistPath: null,
    environment: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--dry-run") {
      args.execute = false;
    } else if (arg === "--allowlist") {
      args.allowlistPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--allowlist=")) {
      args.allowlistPath = arg.slice("--allowlist=".length);
    } else if (arg === "--environment") {
      args.environment = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--environment=")) {
      args.environment = arg.slice("--environment=".length);
    } else {
      throw new Error(`Unknown PACER import argument: ${arg}`);
    }
  }

  if (args.allowlistPath === undefined || args.environment === undefined) {
    throw new Error("PACER import arguments that require values must include values.");
  }

  return args;
}

export function loadAllowlist(filePath = SECURE_PACER_DIRECT_CONFIG.allowlistPath) {
  const absolutePath = path.resolve(filePath);
  const allowlist = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (allowlist.schemaVersion !== 1) {
    throw new Error("PACER allowlist schemaVersion must be 1.");
  }
  if (!Array.isArray(allowlist.entries)) {
    throw new Error("PACER allowlist entries must be an array.");
  }
  return { ...allowlist, path: absolutePath };
}

export function getReviewedAllowlistEntries(allowlist) {
  const blockingEntries = allowlist.entries.filter((entry) => entry.enabled === true && entry.reviewed !== true);
  if (blockingEntries.length) {
    throw new Error(`PACER allowlist has enabled entries that are not reviewed: ${blockingEntries.map((entry) => entry.id || "<missing-id>").join(", ")}`);
  }

  return allowlist.entries
    .filter((entry) => entry.enabled === true && entry.reviewed === true)
    .map(normalizeAllowlistEntry);
}

export function normalizeAllowlistEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("PACER allowlist entry must be an object.");
  }
  if (!entry.id || !/^[A-Za-z0-9._-]+$/.test(entry.id)) {
    throw new Error("PACER allowlist entry id must use only letters, numbers, dots, underscores, or hyphens.");
  }
  if (!SECURE_PACER_DIRECT_CONFIG.allowedKinds.includes(entry.kind)) {
    throw new Error(`PACER allowlist entry ${entry.id} uses unsupported kind: ${entry.kind}`);
  }

  const criteria = sanitizeCaseSearchCriteria(entry.criteria || {}, entry.id);
  if (!hasNonBlank(criteria.caseNumberFull)) {
    throw new Error(`PACER allowlist entry ${entry.id} must include a specific caseNumberFull.`);
  }

  return {
    id: entry.id,
    kind: entry.kind,
    description: entry.description || "",
    intendedUse: entry.intendedUse || "metadata-only",
    criteria,
    reviewed: true
  };
}

export function sanitizeCaseSearchCriteria(criteria, entryId = "<unknown>") {
  if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) {
    throw new Error(`PACER allowlist entry ${entryId} criteria must be an object.`);
  }

  const output = {};
  for (const [key, value] of Object.entries(criteria)) {
    if (!SECURE_PACER_DIRECT_CONFIG.allowedCriteriaKeys.includes(key)) {
      throw new Error(`PACER allowlist entry ${entryId} has unsupported search field: ${key}`);
    }
    const compacted = compactCriteriaValue(value);
    if (hasNonBlank(compacted)) {
      output[key] = compacted;
    }
  }
  return output;
}

export function validateRuntime({ env, environment, entries, execute }) {
  if (!execute) return;

  const failures = [];
  if (env[SECURE_PACER_DIRECT_CONFIG.enableEnvKey] !== "true") {
    failures.push(`${SECURE_PACER_DIRECT_CONFIG.enableEnvKey}=true is required for direct PACER execution.`);
  }
  if (environment === "production" && env[SECURE_PACER_DIRECT_CONFIG.productionEnvKey] !== "true") {
    failures.push(`${SECURE_PACER_DIRECT_CONFIG.productionEnvKey}=true is required for production PACER execution.`);
  }
  if (!entries.length) {
    failures.push("At least one enabled and reviewed PACER allowlist entry is required.");
  }
  if (entries.length > SECURE_PACER_DIRECT_CONFIG.maxAllowlistEntriesPerRun) {
    failures.push(`PACER import is capped at ${SECURE_PACER_DIRECT_CONFIG.maxAllowlistEntriesPerRun} allowlist entries per run.`);
  }
  for (const key of SECURE_PACER_DIRECT_CONFIG.requiredCredentialKeys) {
    if (!hasValue(env, key)) {
      failures.push(`${key} is required for direct PACER execution.`);
    }
  }

  if (failures.length) {
    throw new Error(failures.join(" "));
  }
}

export function buildAuthRequest(env, environment) {
  const endpoint = endpointsFor(environment).authUrl;
  const body = {
    loginId: env.PACER_USERNAME,
    password: env.PACER_PASSWORD
  };
  if (hasValue(env, "PACER_CLIENT_CODE")) {
    body.clientCode = env.PACER_CLIENT_CODE;
  }
  if (hasValue(env, "PACER_OTP_CODE")) {
    body.otpCode = env.PACER_OTP_CODE;
  }
  if (hasValue(env, "PACER_REDACT_FLAG")) {
    body.redactFlag = env.PACER_REDACT_FLAG;
  }

  return {
    method: "POST",
    url: endpoint,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body
  };
}

export function buildPclCaseSearchRequest(entry, token, environment) {
  return {
    method: "POST",
    url: `${endpointsFor(environment).pclBaseUrl}/cases/find?page=0`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-NEXT-GEN-CSO": token
    },
    body: entry.criteria
  };
}

export async function authenticateWithPacer({ env, environment, fetchImpl }) {
  const request = buildAuthRequest(env, environment);
  const result = await postJson(fetchImpl, request, "PACER authentication");
  const token = extractNextGenCso(result.body);

  if (!result.ok) {
    throw new Error(`PACER authentication request failed with HTTP ${result.httpStatus}.`);
  }
  if (String(result.body?.loginResult ?? "0") !== "0") {
    throw new Error(`PACER authentication failed: ${compactLogText(result.body?.errorDescription || "unknown authentication error")}`);
  }
  if (!token) {
    throw new Error("PACER authentication did not return a nextGenCSO token.");
  }

  return {
    token,
    httpStatus: result.httpStatus,
    body: sanitizeForCache(result.body)
  };
}

export async function fetchPclCaseSearch({ entry, token, environment, fetchImpl }) {
  const request = buildPclCaseSearchRequest(entry, token, environment);
  const result = await postJson(fetchImpl, request, `PACER case search ${entry.id}`);
  if (!result.ok) {
    throw new Error(`PACER case search failed for ${entry.id} with HTTP ${result.httpStatus}.`);
  }

  return {
    endpoint: request.url,
    criteria: entry.criteria,
    httpStatus: result.httpStatus,
    headers: sanitizeForCache(result.headers),
    body: sanitizeForCache(result.body),
    refreshedToken: extractNextGenCso(result.headers)
  };
}

export async function logoutFromPacer({ token, environment, fetchImpl }) {
  if (!token || typeof fetchImpl !== "function") {
    return null;
  }

  try {
    const request = {
      method: "POST",
      url: endpointsFor(environment).logoutUrl,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: { nextGenCSO: token }
    };
    const result = await postJson(fetchImpl, request, "PACER logout");
    return {
      httpStatus: result.httpStatus,
      body: sanitizeForCache(result.body)
    };
  } catch {
    return null;
  }
}

export function buildCachedPacerArtifact({ entry, environment, retrievedAt, result }) {
  return {
    schemaVersion: 1,
    provider: "pacer",
    sourcePath: "pacer-direct",
    kind: entry.kind,
    allowlistEntryId: entry.id,
    intendedUse: entry.intendedUse,
    provenance: {
      provider: "PACER Case Locator direct API",
      environment,
      retrievalMode: "operator-reviewed direct import",
      retrievedAt,
      request: {
        method: "POST",
        endpoint: result.endpoint,
        criteria: entry.criteria
      }
    },
    response: {
      httpStatus: result.httpStatus,
      headers: result.headers,
      body: result.body
    }
  };
}

export function buildImportManifest({
  mode,
  environment,
  allowlistPath,
  entries,
  generatedAt,
  cachedArtifacts,
  networkRequestsMade
}) {
  return {
    schemaVersion: 1,
    provider: "pacer",
    sourcePath: "pacer-direct",
    mode,
    environment,
    generatedAt,
    networkRequestsMade,
    allowlist: {
      path: path.relative(process.cwd(), allowlistPath),
      reviewedEnabledEntries: entries.length,
      maxEntriesPerRun: SECURE_PACER_DIRECT_CONFIG.maxAllowlistEntriesPerRun
    },
    safeguards: [
      "CourtListener/RECAP remains the default source path.",
      "Direct PACER import requires an explicit operator command.",
      "Direct PACER import requires a reviewed allowlist entry.",
      "Direct PACER import is excluded from static frontend code and public source refresh commands.",
      "PACER credentials and tokens are redacted from cached artifacts."
    ],
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      description: entry.description,
      intendedUse: entry.intendedUse,
      criteria: entry.criteria,
      provenance: {
        provider: "PACER Case Locator direct API",
        environment,
        plannedEndpoint: `${endpointsFor(environment).pclBaseUrl}/cases/find?page=0`,
        reviewed: true,
        generatedAt
      }
    })),
    cachedArtifacts: cachedArtifacts.map((artifact) => ({
      ...artifact,
      artifactPath: path.relative(process.cwd(), artifact.artifactPath)
    }))
  };
}

export function writeCachedPacerArtifact(cacheDir, entryId, artifact, retrievedAt) {
  const entryDir = path.join(cacheDir, safeFileSegment(entryId));
  ensurePrivateDirectory(entryDir);
  const filePath = path.join(entryDir, `${safeTimestamp(retrievedAt)}.json`);
  writePrivateJson(filePath, sanitizeForCache(artifact));
  return filePath;
}

export function writeImportManifest(cacheDir, manifest, generatedAt) {
  ensurePrivateDirectory(cacheDir);
  const filePath = path.join(cacheDir, `pacer-direct-${manifest.mode}-${safeTimestamp(generatedAt)}.local.json`);
  writePrivateJson(filePath, sanitizeForCache(manifest));
  return filePath;
}

export function getPacerCacheDir(env) {
  const sourceCacheDir = path.resolve(env.LEGAL_PRIVATE_CACHE_DIR || "ops/legal-sources/cache");
  return path.join(sourceCacheDir, SECURE_PACER_DIRECT_CONFIG.cacheSubdir);
}

export function sanitizeForCache(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForCache(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitivePacerKey(key) ? "<redacted>" : sanitizeForCache(item)
      ])
    );
  }
  if (typeof value === "string") {
    return value.replace(LONG_TOKEN_PATTERN, "<redacted>");
  }
  return value;
}

export function isSensitivePacerKey(key) {
  return SENSITIVE_KEY_PATTERN.test(String(key).replace(/[_\s]/g, ""));
}

export function extractNextGenCso(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    if (/^nextgencso$/i.test(key.replace(/[_\s-]/g, "")) || /^xnextgencso$/i.test(key.replace(/[_\s-]/g, ""))) {
      return typeof item === "string" && item.trim() ? item.trim() : null;
    }
  }
  return null;
}

export function normalizeEnvironment(environment) {
  const normalized = String(environment || "").trim().toLowerCase();
  if (!SECURE_PACER_DIRECT_CONFIG.allowedEnvironments.includes(normalized)) {
    throw new Error(`Unsupported PACER environment: ${environment}`);
  }
  return normalized;
}

function endpointsFor(environment) {
  return SECURE_PACER_DIRECT_CONFIG.endpoints[normalizeEnvironment(environment)];
}

async function postJson(fetchImpl, request, label) {
  const { response, bodyText } = await fetchBoundedResponse(fetchImpl, request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
    redirect: "error"
  }, {
    label,
    timeoutMs: SECURE_PACER_DIRECT_CONFIG.requestTimeoutMs,
    maxResponseBytes: SECURE_PACER_DIRECT_CONFIG.maxResponseBytes
  });
  const body = readResponseBody(response, bodyText);
  return {
    ok: Boolean(response.ok),
    httpStatus: response.status,
    headers: headersToObject(response.headers),
    body
  };
}

function readResponseBody(response, bodyText) {
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(bodyText);
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return { text: compactLogText(bodyText, 4000) };
  }
}

function headersToObject(headers) {
  if (!headers) {
    return {};
  }
  if (typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return { ...headers };
}

function compactCriteriaValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter(hasNonBlank);
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return value;
}

function hasNonBlank(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function compactLogText(value, limit = 240) {
  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, "-");
}

function safeFileSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_");
}

export function printPacerImportSummary(result) {
  console.log(`PACER direct import ${result.mode} manifest written to ${path.relative(process.cwd(), result.manifestPath)}`);
  console.log(`Environment: ${result.environment}; reviewed entries: ${result.allowlist.reviewedEnabledEntries}; network requests: ${result.networkRequestsMade}`);
  for (const artifact of result.cachedArtifacts) {
    console.log(`${artifact.entryId}: HTTP ${artifact.httpStatus}; cached ${artifact.artifactPath}`);
  }
}
