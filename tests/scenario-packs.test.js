import fs from "node:fs";
import {
  buildScenarioModule,
  expandScenarioPacks,
  readScenarioCatalog,
  validateScenarioCatalog
} from "../scripts/build-scenario-packs.js";
import {
  DEFAULT_SCENARIO_PACK_ID,
  SCENARIO_CATALOG,
  SCENARIO_PACKS
} from "../public/scenario-packs.generated.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

try {
  validateScenarioCatalog(SCENARIO_CATALOG);
} catch (error) {
  failures.push(error.message);
}

const sourceCatalog = readScenarioCatalog("data/scenario-packs.json");
const expanded = expandScenarioPacks(sourceCatalog);
expect(SCENARIO_PACKS.length === 15, "Five tracks across three durations should produce 15 scenario packs.");
expect(JSON.stringify(expanded) === JSON.stringify(SCENARIO_PACKS), "Generated scenario packs should match the validated JSON source.");
expect(
  fs.readFileSync("public/scenario-packs.generated.js", "utf8") === buildScenarioModule(sourceCatalog),
  "Generated scenario module should be current."
);
expect(SCENARIO_PACKS.some((pack) => pack.id === DEFAULT_SCENARIO_PACK_ID), "Default scenario pack should exist.");

const requiredTracks = [
  "jurisdiction-removal",
  "rule-12",
  "discovery-rule56",
  "joinder-supplemental",
  "preview-modules"
];
for (const trackId of requiredTracks) {
  const packs = SCENARIO_PACKS.filter((pack) => pack.trackId === trackId);
  expect(packs.length === 3, `${trackId} should have three duration packs.`);
  expect(
    JSON.stringify(packs.map((pack) => pack.durationMinutes).sort((a, b) => a - b)) === JSON.stringify([30, 50, 75]),
    `${trackId} should cover 30, 50, and 75 minutes.`
  );
}

for (const pack of SCENARIO_PACKS) {
  const scheduleTotal = Object.values(pack.schedule).reduce((sum, minutes) => sum + minutes, 0);
  expect(scheduleTotal === pack.durationMinutes, `${pack.id} schedule should fill the class period.`);
  expect(pack.caseIds.length >= pack.rounds, `${pack.id} should offer at least one distinct case per planned round.`);
  expect(pack.learningObjectives.length >= 3, `${pack.id} needs at least three learning objectives.`);
  expect(pack.checkpoints.length >= 3, `${pack.id} needs at least three instructor checkpoints.`);
  expect(pack.attackCardIds.length > 0, `${pack.id} needs an attack subset.`);
  expect(pack.motionCardIds.length > 0, `${pack.id} needs a motion/discovery subset.`);
  expect(Boolean(pack.recommendedSeed), `${pack.id} needs a reproducible recommended seed.`);
}

if (failures.length) {
  console.error("Scenario pack tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Scenario pack tests passed.");
