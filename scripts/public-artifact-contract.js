export const PUBLIC_ARTIFACT_PATHS = [
  "_headers",
  "app.js",
  "apple-touch-icon.png",
  "classroom.js",
  "data.js",
  "favicon.svg",
  "game-artifacts.generated.js",
  "guides/catalog.js",
  "guides/guide.css",
  "guides/index.html",
  "guides/instructor-guide.html",
  "guides/lesson-plans.html",
  "guides/library.js",
  "guides/student-quickstart.html",
  "index.html",
  "learning-cycle.js",
  "legal-sources.generated.js",
  "rules.js",
  "safe-html.js",
  "scenario-packs.generated.js",
  "social-card.png",
  "styles.css"
];

export const FORBIDDEN_PUBLIC_SEGMENTS = [
  ".env",
  ".git",
  ".github",
  ".ai-work",
  "data/",
  "deploy/",
  "node_modules/",
  "ops/",
  "scripts/",
  "tests/",
  "rule-tests.js"
];

export const ALLOWED_EXTERNAL_HOSTS = new Set([
  "api.congress.gov",
  "api.govinfo.gov",
  "civpro.jacobdanderson.net",
  "docs.openstates.org",
  "pacer.uscourts.gov",
  "tile.loc.gov",
  "v3.openstates.org",
  "www.courtlistener.com",
  "www.ecfr.gov",
  "www.federalregister.gov",
  "www.law.cornell.edu",
  "www.uscourts.gov",
  "www.w3.org",
  "uscode.house.gov"
]);
