export const SECURE_PACER_DIRECT_CONFIG = Object.freeze({
  enabledByDefault: false,
  frontendSafe: false,
  enableEnvKey: "PACER_DIRECT_ENABLED",
  environmentEnvKey: "PACER_DIRECT_ENV",
  productionEnvKey: "PACER_DIRECT_ALLOW_PRODUCTION",
  requiredExecuteFlag: "--execute",
  allowlistPath: "ops/legal-sources/pacer-import-allowlist.json",
  cacheSubdir: "pacer-direct",
  defaultEnvironment: "qa",
  maxAllowlistEntriesPerRun: 5,
  requestTimeoutMs: 30_000,
  maxResponseBytes: 5_242_880,
  allowedEnvironments: Object.freeze(["qa", "production"]),
  allowedKinds: Object.freeze(["pcl-case-search"]),
  requiredCredentialKeys: Object.freeze(["PACER_USERNAME", "PACER_PASSWORD"]),
  allowedCriteriaKeys: Object.freeze([
    "caseNumberFull",
    "courtId",
    "caseType",
    "jurisdictionType"
  ]),
  endpoints: Object.freeze({
    qa: Object.freeze({
      authUrl: "https://qa-login.uscourts.gov/services/cso-auth",
      logoutUrl: "https://qa-login.uscourts.gov/services/cso-logout",
      pclBaseUrl: "https://qa-pcl.uscourts.gov/pcl-public-api/rest"
    }),
    production: Object.freeze({
      authUrl: "https://pacer.login.uscourts.gov/services/cso-auth",
      logoutUrl: "https://pacer.login.uscourts.gov/services/cso-logout",
      pclBaseUrl: "https://pcl.uscourts.gov/pcl-public-api/rest"
    })
  })
});
