import { CASES, SOURCE_REFERENCES, SOURCES } from "../public/data.js";
import {
  REVIEWED_CASES,
  REVIEWED_DOCTRINE_CARDS,
  REVIEWED_GAME_ARTIFACTS,
  REVIEWED_SOURCE_CARDS
} from "../public/game-artifacts.generated.js";
import { validateReviewedArtifacts } from "../scripts/build-reviewed-artifacts.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

try {
  validateReviewedArtifacts(REVIEWED_GAME_ARTIFACTS);
} catch (error) {
  failures.push(error.message);
}

expect(REVIEWED_CASES.length >= 2, "Reviewed artifacts should contribute playable cases.");
expect(REVIEWED_DOCTRINE_CARDS.length >= 2, "Reviewed artifacts should include doctrine cards.");
expect(REVIEWED_SOURCE_CARDS.length >= 2, "Reviewed artifacts should include source cards.");

for (const c of REVIEWED_CASES) {
  expect(CASES.some((item) => item.id === c.id), `${c.id} should be compiled into the playable CASES deck.`);
  expect(c.reviewStatus === "reviewed", `${c.id} must remain reviewed.`);
  expect(Array.isArray(c.sourceRefs) && c.sourceRefs.length > 0, `${c.id} needs sourceRefs.`);
}

for (const source of REVIEWED_SOURCE_CARDS) {
  expect(SOURCE_REFERENCES.some((item) => item.label === source.label), `${source.label} should appear in the provider-reference list.`);
  expect(!SOURCES.some((item) => item.label === source.label), `${source.label} should not be presented as governing authority.`);
}

if (failures.length) {
  console.error("Reviewed artifact tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Reviewed artifact tests passed.");
