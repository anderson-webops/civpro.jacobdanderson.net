import { ATTACK_CARDS, CASES, MOTION_CARDS } from "../public/data.js";
import { SCENARIO_PACKS } from "../public/scenario-packs.generated.js";
import {
  addUniqueMetric,
  aggregatePlaytestStats,
  appendRoundStats,
  buildRoundAssessment,
  createEmptyPlaytestStats,
  createReplayEnvelope,
  createRoundMetrics,
  createSessionSnapshot,
  incrementMetric,
  parseReplayEnvelope,
  restoreSessionState,
  seededShuffle,
  seedToState,
  validateSessionSnapshot
} from "../public/classroom.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const firstSeed = { rngState: seedToState("section-a") };
const secondSeed = { rngState: seedToState("section-a") };
const otherSeed = { rngState: seedToState("section-b") };
const cards = ["a", "b", "c", "d", "e", "f", "g", "h"];
const firstShuffle = seededShuffle(cards, firstSeed);
const secondShuffle = seededShuffle(cards, secondSeed);
const otherShuffle = seededShuffle(cards, otherSeed);
expect(JSON.stringify(firstShuffle) === JSON.stringify(secondShuffle), "The same seed should produce the same shuffle.");
expect(JSON.stringify(firstShuffle) !== JSON.stringify(otherShuffle), "Different seeds should produce different shuffles.");
expect(firstSeed.rngState === secondSeed.rngState, "Equivalent shuffle runs should preserve equivalent RNG state.");

const activeCase = clone(CASES.find((item) => item.id === "tire-failure"));
activeCase.evidence[0].complete = true;
const metrics = createRoundMetrics({ round: 1, scenarioPackId: SCENARIO_PACKS[0].id, seed: "section-a", startedAt: 1_000 });
metrics.caseId = activeCase.id;
metrics.caseTitle = activeCase.title;
metrics.defendantId = activeCase.defendants[0].id;
metrics.defendantName = activeCase.defendants[0].name;
metrics.attacksPlayed = 2;
metrics.attacksSucceeded = 1;
metrics.budgetFailures.plaintiff = 2;
metrics.wrongMotions.push({ cardId: "show-smj", title: "Show Federal Jurisdiction", reason: "Did not answer personal jurisdiction." });
addUniqueMetric(metrics.doctrinesTriggered, "Personal jurisdiction");
addUniqueMetric(metrics.doctrinesTriggered, "PERSONAL JURISDICTION");
addUniqueMetric(metrics.sourceHooks, "frcp-12");
metrics.learningCycles.push({
  attackTitle: "Personal jurisdiction",
  predictionCorrect: false,
  initial: { prediction: "attack-fails", reasoning: "The forum contact appears sufficient at first glance." },
  ruling: { label: "Attack succeeds", body: "The selected defendant lacks the required forum connection.", authorityIds: ["frcp-12"] },
  revision: "The selected defendant must be analyzed separately from the other defendants.",
  alteredFactPrompt: "Assume a forum-directed contact.",
  alteredPrediction: { prediction: "attack-fails", reasoning: "The added contact changes the due-process analysis." }
});
incrementMetric(metrics.cardsDrawn, "pj", 2);
incrementMetric(metrics.cardsPlayed, "pj", 1);
incrementMetric(metrics.cardsDrawn, "venue", 3);

const assessment = buildRoundAssessment({
  metrics,
  activeCase,
  outcome: { type: "dismissed", label: "Dismissed", reason: "Personal jurisdiction" },
  endedAt: 121_000
});
expect(assessment.durationMs === 120_000, "Assessment should preserve deterministic round duration.");
expect(assessment.missingProofItems.length === 2, "Assessment should list incomplete proof items.");
expect(assessment.wrongMotions.length === 1, "Assessment should list wrong motions.");
expect(assessment.doctrinesTriggered.includes("Personal jurisdiction"), "Assessment should list triggered doctrines.");
expect(assessment.doctrinesTriggered.length === 1, "Assessment doctrine labels should deduplicate without regard to case.");
expect(assessment.sourceHooks.includes("frcp-12"), "Assessment should preserve source IDs.");
expect(assessment.missedDoctrines.includes("Personal jurisdiction"), "Assessment should identify a missed doctrine from the committed prediction.");
expect(assessment.learningCycles[0].revision.includes("selected defendant"), "Assessment should preserve the completed revision trail.");

const selectedCase = clone(CASES.find((item) => item.id === "software-contract"));
selectedCase.currentCourt = selectedCase.court;
selectedCase.currentForum = selectedCase.forumState;
const selectedDefendant = selectedCase.defendants[0];
const attack = clone(ATTACK_CARDS[0]);
attack.instanceId = "pj-10";
const motion = clone(MOTION_CARDS[0]);
motion.instanceId = "show-contacts-11";
const sampleState = {
  players: [{ name: "Player 1", score: 0, dismissed: 0 }, { name: "Player 2", score: 0, dismissed: 0 }],
  round: 1,
  plaintiff: 0,
  defense: 1,
  phase: "attack",
  decks: { claims: [clone(CASES[0])], attacks: [clone(ATTACK_CARDS[1])], motions: [clone(MOTION_CARDS[1])] },
  hands: { claims: [], attacks: [attack], motions: [motion] },
  discards: { attacks: [], motions: [] },
  resources: { plaintiff: 5, defense: 4 },
  activeCase: selectedCase,
  selectedDefendant,
  docket: [],
  pendingAttack: null,
  attackCount: 0,
  maxAttacks: 2,
  sequence: 12,
  eventSequence: 1,
  settings: { activeTopics: new Set(["jurisdiction", "service", "discovery"]), noTimer: true, examMode: false, showExplanations: true },
  tutorial: { enabled: false, step: 0 },
  judge: { tone: "neutral", title: "Saved", body: "Saved state", authorityIds: ["frcp-12"], proposition: "Classroom test", revealed: true },
  scenarioPackId: SCENARIO_PACKS[0].id,
  seed: "section-a",
  rngState: firstSeed.rngState,
  sessionStartedAt: 1_000,
  sessionComplete: false,
  eventLog: [],
  roundHistory: [],
  currentRoundMetrics: metrics,
  lastAssessment: null,
  pendingRoundOutcome: null,
  learningCycle: { current: null, history: [] }
};
const known = {
  scenarioPackIds: new Set(SCENARIO_PACKS.map((item) => item.id)),
  caseIds: new Set(CASES.map((item) => item.id)),
  attackCardIds: new Set(ATTACK_CARDS.map((item) => item.id)),
  motionCardIds: new Set(MOTION_CARDS.map((item) => item.id))
};
const snapshot = createSessionSnapshot(sampleState, 200_000);
expect(validateSessionSnapshot(snapshot, known), "Valid session snapshot should pass validation.");
const restored = restoreSessionState(snapshot, known);
expect(restored.settings.activeTopics instanceof Set, "Restored active topics should be a Set.");
expect(restored.selectedDefendant?.id === selectedDefendant.id, "Restored defendant should be re-linked to the active case.");
expect(restored.rngState === sampleState.rngState, "Restored state should preserve deterministic RNG position.");
expect(snapshot.appVersion === "0.4.0" && snapshot.contentVersion === "2026-08-27.1", "Snapshot should identify the app and content versions.");

const replay = createReplayEnvelope(sampleState, SCENARIO_PACKS[0], 200_000);
const parsedReplay = parseReplayEnvelope(JSON.stringify(replay), known);
expect(parsedReplay.reproducibility.seed === "section-a", "Replay should preserve the original seed.");
expect(parsedReplay.snapshot.state.phase === "attack", "Replay should preserve the exact phase.");

let stats = createEmptyPlaytestStats();
stats = appendRoundStats(stats, assessment, 200_000);
const secondAssessment = {
  ...assessment,
  caseId: "software-contract",
  caseTitle: "Broken SaaS Rollout",
  outcome: { type: "trial-ready", label: "Trial ready", reason: "Complete record" },
  durationMs: 240_000,
  attacksPlayed: 1,
  attacksSucceeded: 1,
  budgetFailures: { plaintiff: 0, defense: 1 },
  cardsDrawn: { service: 2 },
  cardsPlayed: { service: 1 }
};
stats = appendRoundStats(stats, secondAssessment, 201_000);
const summary = aggregatePlaytestStats(stats, { pj: "Rule 12(b)(2)", venue: "Rule 12(b)(3)" });
expect(summary.roundCount === 2, "Stats should count stored rounds.");
expect(summary.averageRoundMinutes === 3, "Stats should calculate average round length.");
expect(summary.attacksPlayed === 3 && summary.attacksSucceeded === 2, "Stats should aggregate attack outcomes.");
expect(summary.neverTrialReady.some((item) => item.id === "tire-failure"), "Stats should identify cases that never reach trial.");
expect(summary.deadCards.some((item) => item.id === "venue" && item.drawn === 3), "Stats should identify drawn but unplayed cards.");

const tampered = clone(snapshot);
tampered.state.judge.body = "<img src=x>";
try {
  validateSessionSnapshot(tampered, known);
  failures.push("Snapshot validation should reject imported markup.");
} catch (error) {
  expect(error.message.includes("markup"), "Markup rejection should explain the validation failure.");
}

if (failures.length) {
  console.error("Classroom engine tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Classroom engine tests passed.");
