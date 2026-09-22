import { buildCandidateArtifact } from "../scripts/ingest-game-artifacts.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const requests = [];
const artifact = await buildCandidateArtifact({
  COURTLISTENER_API_TOKEN: "fake-courtlistener-token",
  GOVINFO_API_KEY: "fake-govinfo-key",
  CONGRESS_API_KEY: "fake-congress-key",
  OPENSTATES_API_KEY: "fake-openstates-key"
}, {
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    let body = {};
    if (url.includes("courtlistener")) body = { results: [] };
    if (url.includes("govinfo")) body = { packages: [] };
    if (url.includes("congress")) body = { bills: [] };
    if (url.includes("openstates")) body = { results: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
});

expect(requests.length === 6, "Provider ingestion should issue three CourtListener queries and one request for each other configured provider.");
expect(requests.every((entry) => entry.options.redirect === "error"), "Provider ingestion should reject redirects rather than forwarding credentials.");
expect(requests.every((entry) => entry.options.signal instanceof AbortSignal), "Provider ingestion should apply a request deadline.");
expect(artifact.providers.every((provider) => provider.status === "ok"), "Bounded successful provider requests should remain supported.");
const serialized = JSON.stringify(artifact);
for (const secret of ["fake-courtlistener-token", "fake-govinfo-key", "fake-congress-key", "fake-openstates-key"]) {
  expect(!serialized.includes(secret), "Provider candidate artifact should keep credentials out of its public request metadata.");
}

if (failures.length) {
  console.error("Provider ingestion tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Provider ingestion tests passed.");
