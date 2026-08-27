import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ATTACK_CARDS, CASES, MOTION_CARDS, TOPIC_MODULES } from "../public/data.js";

const inputPath = path.resolve("data/scenario-packs.json");
const outputPath = path.resolve("public/scenario-packs.generated.js");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export function main() {
  const catalog = readScenarioCatalog(inputPath);
  writeScenarioModule(catalog, outputPath);
  console.log(`Scenario packs written to ${path.relative(process.cwd(), outputPath)}`);
}

export function readScenarioCatalog(filePath) {
  const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));
  validateScenarioCatalog(catalog);
  return catalog;
}

export function validateScenarioCatalog(catalog) {
  const failures = [];
  const knownTopics = new Set(TOPIC_MODULES.map((item) => item.id));
  const knownCases = new Map(CASES.map((item) => [item.id, item]));
  const knownAttacks = new Map(ATTACK_CARDS.map((item) => [item.id, item]));
  const knownMotions = new Map(MOTION_CARDS.map((item) => [item.id, item]));

  if (catalog.schemaVersion !== 1) failures.push("schemaVersion must be 1.");
  if (catalog.version !== "0.3.0") failures.push("version must be 0.3.0.");
  if (!Array.isArray(catalog.durations)) failures.push("durations must be an array.");
  if (!Array.isArray(catalog.tracks)) failures.push("tracks must be an array.");

  const durations = catalog.durations || [];
  const tracks = catalog.tracks || [];
  ensureUnique(durations.map((item) => item.minutes), "duration minutes", failures);
  ensureUnique(tracks.map((item) => item.id), "track ids", failures);

  const requiredDurations = [30, 50, 75];
  if (JSON.stringify(durations.map((item) => item.minutes).sort((a, b) => a - b)) !== JSON.stringify(requiredDurations)) {
    failures.push("durations must define exactly 30, 50, and 75 minute packs.");
  }

  for (const duration of durations) {
    const label = `${duration.minutes || "<missing>"}-minute duration`;
    for (const key of ["minutes", "rounds", "caseCount", "claimHandSize", "maxAttacks"]) {
      if (!Number.isInteger(duration[key]) || duration[key] < 1) failures.push(`${label} needs positive integer ${key}.`);
    }
    if (!Number.isInteger(duration.budgets?.plaintiff) || !Number.isInteger(duration.budgets?.defense)) {
      failures.push(`${label} needs integer plaintiff and defense budgets.`);
    }
    if (!Number.isInteger(duration.timers?.attackSeconds) || !Number.isInteger(duration.timers?.responseSeconds)) {
      failures.push(`${label} needs integer attack and response timers.`);
    }
    const scheduleTotal = Object.values(duration.schedule || {}).reduce((sum, value) => sum + value, 0);
    if (scheduleTotal !== duration.minutes) failures.push(`${label} schedule must total ${duration.minutes} minutes.`);
  }

  const requiredTracks = new Set([
    "jurisdiction-removal",
    "rule-12",
    "discovery-rule56",
    "joinder-supplemental",
    "preview-modules"
  ]);
  if (tracks.length !== requiredTracks.size || tracks.some((track) => !requiredTracks.has(track.id))) {
    failures.push("tracks must define the five required Version 0.3 curriculum tracks.");
  }

  for (const track of tracks) {
    const label = `track ${track.id || "<missing>"}`;
    for (const key of ["title", "summary"]) {
      if (!track[key]) failures.push(`${label} missing ${key}.`);
    }
    for (const key of ["topics", "caseIds", "attackCardIds", "motionCardIds", "learningObjectives", "checkpoints", "assessmentFocus"]) {
      if (!Array.isArray(track[key]) || !track[key].length) failures.push(`${label} needs nonempty ${key}.`);
      else ensureUnique(track[key], `${label} ${key}`, failures);
    }
    for (const topic of track.topics || []) {
      if (!knownTopics.has(topic)) failures.push(`${label} references unknown topic ${topic}.`);
    }
    for (const caseId of track.caseIds || []) {
      if (!knownCases.has(caseId)) failures.push(`${label} references unknown case ${caseId}.`);
    }
    for (const attackId of track.attackCardIds || []) {
      if (!knownAttacks.has(attackId)) failures.push(`${label} references unknown attack ${attackId}.`);
    }
    for (const motionId of track.motionCardIds || []) {
      if (!knownMotions.has(motionId)) failures.push(`${label} references unknown motion ${motionId}.`);
    }

    const responsiveAttackIds = new Set(
      (track.motionCardIds || [])
        .map((id) => knownMotions.get(id))
        .filter(Boolean)
        .flatMap((card) => card.answers || [])
    );
    for (const attackId of track.attackCardIds || []) {
      if (!responsiveAttackIds.has(attackId)) failures.push(`${label} has no responsive motion for ${attackId}.`);
    }

    const discoveryTools = new Set(
      (track.motionCardIds || [])
        .map((id) => knownMotions.get(id))
        .filter((card) => card?.kind === "discovery-tool")
        .map((card) => card.tool)
    );
    const resistanceAnswers = new Set(
      (track.motionCardIds || [])
        .map((id) => knownMotions.get(id))
        .filter((card) => card?.kind === "discovery")
        .flatMap((card) => card.answers || [])
    );
    for (const caseId of track.caseIds || []) {
      const selectedCase = knownCases.get(caseId);
      if (!selectedCase) continue;
      for (const evidence of selectedCase.evidence) {
        if (!discoveryTools.has(evidence.tool)) failures.push(`${label}/${caseId} lacks discovery tool ${evidence.tool}.`);
        if (evidence.resistance && !resistanceAnswers.has(evidence.resistance)) {
          failures.push(`${label}/${caseId} lacks an answer to ${evidence.resistance}.`);
        }
      }
    }

    const largestCaseCount = Math.max(0, ...durations.map((item) => item.caseCount));
    if ((track.caseIds || []).length < largestCaseCount) failures.push(`${label} needs at least ${largestCaseCount} cases.`);
  }

  const packs = expandScenarioPacks(catalog);
  ensureUnique(packs.map((item) => item.id), "scenario pack ids", failures);
  if (packs.length !== 15) failures.push("catalog must expand to 15 scenario packs.");
  if (!packs.some((pack) => pack.id === catalog.defaultPackId)) failures.push("defaultPackId must name an expanded pack.");

  if (failures.length) {
    throw new Error(`Scenario pack validation failed:\n- ${failures.join("\n- ")}`);
  }
}

export function expandScenarioPacks(catalog) {
  return (catalog.tracks || []).flatMap((track) => (catalog.durations || []).map((duration) => ({
    id: `${track.id}-${duration.minutes}`,
    version: catalog.version,
    trackId: track.id,
    title: `${track.title}: ${duration.minutes}-Minute Class`,
    shortTitle: track.title,
    summary: track.summary,
    durationMinutes: duration.minutes,
    rounds: duration.rounds,
    claimHandSize: duration.claimHandSize,
    maxAttacks: duration.maxAttacks,
    budgets: duration.budgets,
    timers: duration.timers,
    schedule: duration.schedule,
    topics: track.topics,
    caseIds: track.caseIds.slice(0, duration.caseCount),
    attackCardIds: track.attackCardIds,
    motionCardIds: track.motionCardIds,
    learningObjectives: track.learningObjectives,
    checkpoints: track.checkpoints,
    assessmentFocus: track.assessmentFocus,
    recommendedSeed: `${track.id}-${duration.minutes}-v1`
  })));
}

export function buildScenarioModule(catalog) {
  const packs = expandScenarioPacks(catalog);
  return `// Generated by scripts/build-scenario-packs.js from validated classroom curriculum JSON.\nexport const SCENARIO_CATALOG = ${JSON.stringify(catalog, null, 2)};\n\nexport const SCENARIO_PACKS = ${JSON.stringify(packs, null, 2)};\nexport const DEFAULT_SCENARIO_PACK_ID = SCENARIO_CATALOG.defaultPackId;\n`;
}

export function writeScenarioModule(catalog, filePath) {
  fs.writeFileSync(filePath, buildScenarioModule(catalog));
}

function ensureUnique(values, label, failures) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) failures.push(`Duplicate ${label}: ${value}.`);
    seen.add(value);
  }
}
