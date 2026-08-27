import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DOCTRINE_SOURCES,
  LIVE_PROBES,
  REQUIRED_ENV_KEYS,
  SOURCE_REVIEW,
  SOURCE_PROVIDERS
} from "./legal-source-config.js";
import { hasValue, mergedEnv } from "./load-env.js";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export async function main(argv = process.argv.slice(2), runtimeEnv = null) {
  const args = new Set(argv);
  const live = args.has("--live");
  const localOutput = args.has("--local-output");
  const includeRestricted = args.has("--include-restricted");
  const env = runtimeEnv || (args.has("--ignore-env") ? publicCatalogEnv() : mergedEnv());
  const outputDir = path.resolve(env.LEGAL_SOURCE_CACHE_DIR || "data/legal-sources");
  const manifestPath = localOutput
    ? path.join(outputDir, "live-source-manifest.local.json")
    : path.join(outputDir, "source-manifest.json");
  const generatedModulePath = localOutput ? null : path.resolve("public/legal-sources.generated.js");
  const manifest = await buildManifest({ env, live, includeRestricted });

  writeOutputs(manifest, { outputDir, manifestPath, generatedModulePath });
  printSummary(manifest, { manifestPath, generatedModulePath });
}

function publicCatalogEnv() {
  return {
    LEGAL_SOURCE_CACHE_DIR: process.env.LEGAL_SOURCE_CACHE_DIR || "data/legal-sources"
  };
}

export async function buildManifest({ env, live, includeRestricted = false }) {
  const providerStatuses = new Map();
  for (const provider of SOURCE_PROVIDERS) {
    providerStatuses.set(provider.id, provider.envKeys.every((key) => hasValue(env, key)));
  }

  const probes = [];
  for (const probe of LIVE_PROBES) {
    probes.push(await buildProbeStatus(probe, env, live, { includeRestricted }));
  }

  for (const probe of probes) {
    if (probe.configured) {
      providerStatuses.set(probe.provider, true);
    }
  }

  const providers = SOURCE_PROVIDERS.map((provider) => {
    const configured = providerStatuses.get(provider.id) || false;
    return {
      ...provider,
      configured,
      missingEnv: configured ? [] : provider.envKeys.filter((key) => !hasValue(env, key))
    };
  });

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    live,
    includeRestricted,
    outputMode: live ? "live-probe" : "catalog",
    requiredEnv: REQUIRED_ENV_KEYS,
    sourceReview: SOURCE_REVIEW,
    providers,
    doctrineSources: DOCTRINE_SOURCES,
    liveProbes: probes,
    sourceCards: buildSourceCards(),
    referenceCards: buildReferenceCards(providers)
  };
}

export async function buildProbeStatus(probe, env, live, options = {}) {
  const { includeRestricted = false } = options;
  const missingEnv = probe.envKeys.filter((key) => !hasValue(env, key));
  const request = buildRequest(probe, env);

  const base = {
    id: probe.id,
    provider: probe.provider,
    label: probe.label,
    gameUse: probe.gameUse,
    liveEnabled: live,
    restricted: Boolean(probe.restricted),
    configured: missingEnv.length === 0,
    missingEnv,
    request: {
      method: probe.method,
      url: redactUrl(request.url),
      headers: redactHeaders(request.headers)
    }
  };

  if (!live) {
    return {
      ...base,
      status: "cataloged",
      note: "Run npm run sources:live to probe this source."
    };
  }

  if (missingEnv.length) {
    return {
      ...base,
      status: "skipped",
      note: `Missing ${missingEnv.join(", ")}.`
    };
  }

  if (probe.restricted && !includeRestricted) {
    return {
      ...base,
      status: "restricted",
      note: "Credentials are present, but direct restricted-source access is disabled by default."
    };
  }

  if (probe.method === "MANUAL") {
    return {
      ...base,
      status: "configured",
      note: "Credentials are present. No network request was made for this restricted account source."
    };
  }

  try {
    const response = await fetch(request.url, {
      method: probe.method,
      headers: request.headers
    });

    let resultCount = null;
    let sampleKeys = [];
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      resultCount = inferResultCount(json);
      sampleKeys = Object.keys(json).slice(0, 8);
    } else {
      await response.arrayBuffer();
    }

    return {
      ...base,
      status: response.ok ? "ok" : "error",
      httpStatus: response.status,
      resultCount,
      sampleKeys,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString()
    };
  }
}

export function buildRequest(probe, env) {
  const url = new URL(probe.url);
  for (const [key, value] of Object.entries(probe.query || {})) {
    url.searchParams.set(key, interpolate(value, env));
  }

  const headers = {};
  for (const [key, value] of Object.entries(probe.headers || {})) {
    headers[key] = interpolate(value, env);
  }

  return {
    url: url.toString(),
    headers
  };
}

function interpolate(value, env) {
  return String(value).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key) => env[key] || "");
}

export function buildSourceCards() {
  return DOCTRINE_SOURCES.map((source) => ({
    id: source.id,
    label: source.citation,
    href: source.href,
    officialHref: source.officialHref,
    authorityType: source.authorityType,
    status: source.status,
    pinpoint: source.pinpoint,
    proposition: source.proposition,
    reviewedThrough: source.reviewedThrough,
    note: `${source.topic}: ${source.gameUse}`
  }));
}

export function buildReferenceCards(providers) {
  const providerCards = providers.map((provider) => ({
    id: `provider-${provider.id}`,
    label: provider.label,
    href: provider.href,
    authorityType: "provider-metadata",
    status: "reference-only",
    note: provider.envKeys.length
      ? `${provider.gameUse} ${provider.configured ? "Configured" : `Needs ${provider.missingEnv.join(", ")}.`}`
      : provider.gameUse
  }));
  return [
    ...providerCards,
    {
      id: "future-pending-frcp-amendments",
      label: "Pending FRCP amendments",
      href: SOURCE_REVIEW.pendingAmendmentsHref,
      authorityType: "future-amendment",
      status: "not-governing",
      note: SOURCE_REVIEW.pendingAmendmentsNote
    }
  ];
}

export function writeOutputs(manifest, { outputDir, manifestPath, generatedModulePath }) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (generatedModulePath) {
    fs.writeFileSync(generatedModulePath, buildGeneratedModule(manifest));
  }
}

export function buildGeneratedModule(manifest) {
  return `// Generated by scripts/sync-legal-sources.js. Do not put API keys in this file.
export const LEGAL_SOURCE_MANIFEST = ${JSON.stringify(manifest, null, 2)};

export const LEGAL_SOURCE_CARDS = LEGAL_SOURCE_MANIFEST.sourceCards;
export const LEGAL_REFERENCE_CARDS = LEGAL_SOURCE_MANIFEST.referenceCards;
`;
}

export function printSummary(manifest, { manifestPath, generatedModulePath }) {
  const configured = manifest.providers.filter((provider) => provider.configured).length;
  const total = manifest.providers.length;
  const probeSummary = manifest.liveProbes
    .map((probe) => `${probe.id}:${probe.status}`)
    .join(", ");

  console.log(`Legal source manifest written to ${path.relative(process.cwd(), manifestPath)}`);
  if (generatedModulePath) {
    console.log(`Generated browser module written to ${path.relative(process.cwd(), generatedModulePath)}`);
  } else {
    console.log("Generated browser module left unchanged for local live probe.");
  }
  console.log(`Providers configured: ${configured}/${total}`);
  console.log(`Probes: ${probeSummary}`);
}

export function inferResultCount(json) {
  if (typeof json.count === "number") {
    return json.count;
  }

  if (Array.isArray(json.results)) {
    return json.results.length;
  }

  if (Array.isArray(json.packages)) {
    return json.packages.length;
  }

  if (Array.isArray(json.bills)) {
    return json.bills.length;
  }

  if (Array.isArray(json.jurisdictions)) {
    return json.jurisdictions.length;
  }

  if (Array.isArray(json.titles)) {
    return json.titles.length;
  }

  return null;
}

export function redactUrl(value) {
  const url = new URL(value);
  for (const [key, token] of url.searchParams.entries()) {
    if (isSensitiveKey(key)) {
      url.searchParams.set(key, token ? "<redacted>" : "");
    }
  }
  return url.toString();
}

export function redactHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      isSensitiveKey(key) || value ? "<redacted>" : ""
    ])
  );
}

export function isSensitiveKey(key) {
  return /api[_-]?key|authorization|token|password|secret/i.test(key);
}
