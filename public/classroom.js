export const APP_VERSION = "0.4.0";
export const CONTENT_VERSION = "2026-08-27.1";
export const SOURCE_REVISION = "2026-08-27";
export const SESSION_SCHEMA_VERSION = 2;
export const REPLAY_KIND = "civpro-classroom-replay";
export const PLAYTEST_STATS_SCHEMA_VERSION = 1;
export const MAX_STORED_ROUNDS = 200;

const VALID_PHASES = new Set(["claim", "defendant", "attack", "response", "discovery", "summary", "trial"]);

export function normalizeSeed(value, fallback = "civpro-classroom") {
  const normalized = String(value ?? "").trim().slice(0, 80);
  return normalized || fallback;
}

export function seedToState(seed) {
  const text = normalizeSeed(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextSeededRandom(holder) {
  holder.rngState = ((holder.rngState >>> 0) + 0x6d2b79f5) >>> 0;
  let value = holder.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function seededShuffle(items, holder) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextSeededRandom(holder) * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function createRoundMetrics({ round, scenarioPackId, seed, startedAt = Date.now() }) {
  return {
    round,
    scenarioPackId,
    seed,
    startedAt,
    caseId: null,
    caseTitle: null,
    defendantId: null,
    defendantName: null,
    cardsDrawn: {},
    cardsPlayed: {},
    attacksPlayed: 0,
    attacksSucceeded: 0,
    budgetFailures: { plaintiff: 0, defense: 0 },
    wrongMotions: [],
    doctrinesTriggered: [],
    sourceHooks: [],
    learningCycles: []
  };
}

export function incrementMetric(record, key, amount = 1) {
  if (!key) return;
  record[key] = (record[key] || 0) + amount;
}

export function addUniqueMetric(items, value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized && !items.some((item) => String(item).trim().toLowerCase() === normalized)) items.push(value);
}

export function buildRoundAssessment({ metrics, activeCase, outcome, endedAt = Date.now() }) {
  if (!metrics || !outcome) throw new TypeError("Round metrics and outcome are required.");
  const missingProofItems = (activeCase?.evidence || [])
    .filter((item) => !item.complete)
    .map((item) => ({ id: item.id, title: item.title }));
  const durationMs = Math.max(0, endedAt - metrics.startedAt);
  const learningCycles = plainClone(metrics.learningCycles || []);
  const missedDoctrines = learningCycles
    .filter((cycle) => cycle.predictionCorrect === false)
    .map((cycle) => cycle.attackTitle);
  const reviewTopics = [...new Set([
    ...missedDoctrines,
    ...metrics.wrongMotions.map((item) => item.title),
    ...missingProofItems.map((item) => item.title)
  ])];
  return {
    schemaVersion: 1,
    round: metrics.round,
    scenarioPackId: metrics.scenarioPackId,
    seed: metrics.seed,
    startedAt: new Date(metrics.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs,
    caseId: metrics.caseId || activeCase?.id || null,
    caseTitle: metrics.caseTitle || activeCase?.title || "Unfiled claim",
    defendantId: metrics.defendantId,
    defendantName: metrics.defendantName,
    outcome,
    doctrinesTriggered: [...metrics.doctrinesTriggered],
    wrongMotions: plainClone(metrics.wrongMotions),
    missingProofItems,
    sourceHooks: [...metrics.sourceHooks],
    governingAuthorityIds: [...metrics.sourceHooks],
    learningCycles,
    missedDoctrines,
    reviewTopics,
    attacksPlayed: metrics.attacksPlayed,
    attacksSucceeded: metrics.attacksSucceeded,
    budgetFailures: { ...metrics.budgetFailures },
    cardsDrawn: { ...metrics.cardsDrawn },
    cardsPlayed: { ...metrics.cardsPlayed }
  };
}

export function createSessionSnapshot(state, savedAt = Date.now()) {
  const snapshotState = {
    players: state.players,
    round: state.round,
    plaintiff: state.plaintiff,
    defense: state.defense,
    phase: state.phase,
    decks: state.decks,
    hands: state.hands,
    discards: state.discards,
    resources: state.resources,
    activeCase: state.activeCase,
    selectedDefendantId: state.selectedDefendant?.id || null,
    docket: state.docket,
    pendingAttack: state.pendingAttack,
    attackCount: state.attackCount,
    maxAttacks: state.maxAttacks,
    sequence: state.sequence,
    eventSequence: state.eventSequence,
    settings: {
      ...state.settings,
      activeTopics: [...state.settings.activeTopics]
    },
    tutorial: state.tutorial,
    judge: state.judge,
    scenarioPackId: state.scenarioPackId,
    seed: state.seed,
    rngState: state.rngState,
    sessionStartedAt: state.sessionStartedAt,
    sessionComplete: state.sessionComplete,
    eventLog: state.eventLog,
    roundHistory: state.roundHistory,
    currentRoundMetrics: state.currentRoundMetrics,
    lastAssessment: state.lastAssessment,
    pendingRoundOutcome: state.pendingRoundOutcome,
    learningCycle: state.learningCycle
  };
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    sourceRevision: SOURCE_REVISION,
    savedAt: new Date(savedAt).toISOString(),
    state: plainClone(snapshotState)
  };
}

export function validateSessionSnapshot(snapshot, known = {}) {
  const failures = [];
  if (!snapshot || typeof snapshot !== "object") failures.push("Snapshot must be an object.");
  if (snapshot?.schemaVersion !== SESSION_SCHEMA_VERSION) failures.push(`Snapshot schemaVersion must be ${SESSION_SCHEMA_VERSION}.`);
  if (snapshot?.appVersion !== APP_VERSION) failures.push(`Snapshot appVersion must be ${APP_VERSION}.`);
  if (snapshot?.contentVersion !== CONTENT_VERSION) failures.push(`Snapshot contentVersion must be ${CONTENT_VERSION}.`);
  if (snapshot?.sourceRevision !== SOURCE_REVISION) failures.push(`Snapshot sourceRevision must be ${SOURCE_REVISION}.`);
  const savedState = snapshot?.state;
  if (!savedState || typeof savedState !== "object") failures.push("Snapshot state is missing.");

  if (savedState) {
    if (!VALID_PHASES.has(savedState.phase)) failures.push(`Unknown phase ${savedState.phase}.`);
    if (!Number.isInteger(savedState.round) || savedState.round < 1) failures.push("Round must be a positive integer.");
    if (!Number.isInteger(savedState.sequence) || savedState.sequence < 1) failures.push("Card sequence must be a positive integer.");
    if (!Number.isInteger(savedState.rngState) || savedState.rngState < 0) failures.push("rngState must be a nonnegative integer.");
    if (!Array.isArray(savedState.settings?.activeTopics) || !savedState.settings.activeTopics.length) {
      failures.push("Active topics are missing.");
    }
    if (!Array.isArray(savedState.eventLog) || savedState.eventLog.length > 5000) failures.push("Event log is missing or too large.");
    if (!Array.isArray(savedState.roundHistory) || savedState.roundHistory.length > MAX_STORED_ROUNDS) {
      failures.push("Round history is missing or too large.");
    }
    if (!Array.isArray(savedState.learningCycle?.history) || savedState.learningCycle.history.length > 1000) {
      failures.push("Learning-cycle history is missing or too large.");
    }
    validateKnownId(savedState.scenarioPackId, known.scenarioPackIds, "scenario pack", failures, true);
    validateKnownId(savedState.activeCase?.id, known.caseIds, "active case", failures, true);
    validateCardCollections(savedState, known, failures);
    validateSafeIdentifiers(savedState, failures);
  }

  const serialized = JSON.stringify(snapshot || {});
  if (serialized.length > 2_000_000) failures.push("Snapshot exceeds the 2 MB classroom import limit.");
  if (containsMarkup(snapshot)) failures.push("Snapshot contains markup and cannot be imported safely.");

  if (failures.length) throw new Error(`Session snapshot validation failed:\n- ${failures.join("\n- ")}`);
  return true;
}

export function restoreSessionState(snapshot, known = {}) {
  validateSessionSnapshot(snapshot, known);
  const restored = plainClone(snapshot.state);
  restored.settings.activeTopics = new Set(restored.settings.activeTopics);
  restored.selectedDefendant = restored.activeCase?.defendants.find((item) => item.id === restored.selectedDefendantId) || null;
  delete restored.selectedDefendantId;
  restored.timer = null;
  restored.deadline = null;
  restored.secondsLeft = null;
  return restored;
}

export function createReplayEnvelope(state, scenarioPack, exportedAt = Date.now()) {
  const snapshot = createSessionSnapshot(state, exportedAt);
  return {
    kind: REPLAY_KIND,
    schemaVersion: SESSION_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    sourceRevision: SOURCE_REVISION,
    exportedAt: new Date(exportedAt).toISOString(),
    reproducibility: {
      scenarioPackId: state.scenarioPackId,
      scenarioTitle: scenarioPack?.title || "Custom topic deck",
      seed: state.seed,
      round: state.round,
      phase: state.phase,
      instructions: `Import this file in Civ Pro: Trial Ready ${APP_VERSION} to restore the exact saved state. Use the event log and learning cycles to review or repeat the choices from the same seed.`
    },
    snapshot,
    eventLog: plainClone(state.eventLog),
    roundAssessments: plainClone(state.roundHistory)
  };
}

export function parseReplayEnvelope(value, known = {}) {
  const envelope = typeof value === "string" ? JSON.parse(value) : value;
  if (envelope?.kind !== REPLAY_KIND || envelope?.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new Error(`This is not a Civ Pro ${APP_VERSION} classroom replay file.`);
  }
  validateSessionSnapshot(envelope.snapshot, known);
  return envelope;
}

export function createEmptyPlaytestStats() {
  return {
    schemaVersion: PLAYTEST_STATS_SCHEMA_VERSION,
    updatedAt: null,
    rounds: []
  };
}

export function appendRoundStats(stats, assessment, updatedAt = Date.now()) {
  const next = stats?.schemaVersion === PLAYTEST_STATS_SCHEMA_VERSION
    ? plainClone(stats)
    : createEmptyPlaytestStats();
  next.rounds.push(plainClone(assessment));
  next.rounds = next.rounds.slice(-MAX_STORED_ROUNDS);
  next.updatedAt = new Date(updatedAt).toISOString();
  return next;
}

export function aggregatePlaytestStats(stats, cardLabels = {}) {
  const rounds = Array.isArray(stats?.rounds) ? stats.rounds : [];
  const totals = {
    durationMs: 0,
    attacksPlayed: 0,
    attacksSucceeded: 0,
    budgetFailures: { plaintiff: 0, defense: 0 }
  };
  const cases = {};
  const cards = {};

  for (const round of rounds) {
    totals.durationMs += Number(round.durationMs) || 0;
    totals.attacksPlayed += Number(round.attacksPlayed) || 0;
    totals.attacksSucceeded += Number(round.attacksSucceeded) || 0;
    totals.budgetFailures.plaintiff += Number(round.budgetFailures?.plaintiff) || 0;
    totals.budgetFailures.defense += Number(round.budgetFailures?.defense) || 0;

    if (round.caseId) {
      const caseStats = cases[round.caseId] || {
        id: round.caseId,
        title: round.caseTitle || round.caseId,
        rounds: 0,
        trialReady: 0,
        dismissed: 0
      };
      caseStats.rounds += 1;
      if (round.outcome?.type === "trial-ready") caseStats.trialReady += 1;
      if (round.outcome?.type === "dismissed") caseStats.dismissed += 1;
      cases[round.caseId] = caseStats;
    }

    for (const [cardId, count] of Object.entries(round.cardsDrawn || {})) {
      const card = cards[cardId] || { id: cardId, title: cardLabels[cardId] || cardId, drawn: 0, played: 0 };
      card.drawn += Number(count) || 0;
      cards[cardId] = card;
    }
    for (const [cardId, count] of Object.entries(round.cardsPlayed || {})) {
      const card = cards[cardId] || { id: cardId, title: cardLabels[cardId] || cardId, drawn: 0, played: 0 };
      card.played += Number(count) || 0;
      cards[cardId] = card;
    }
  }

  const casePerformance = Object.values(cases)
    .map((item) => ({ ...item, trialReadyRate: item.rounds ? item.trialReady / item.rounds : 0 }))
    .sort((a, b) => a.trialReadyRate - b.trialReadyRate || b.rounds - a.rounds);
  const neverTrialReady = casePerformance.filter((item) => item.trialReady === 0);
  const deadCards = Object.values(cards)
    .filter((item) => item.drawn > 0 && item.played === 0)
    .sort((a, b) => b.drawn - a.drawn || a.title.localeCompare(b.title));

  return {
    roundCount: rounds.length,
    averageRoundMinutes: rounds.length ? totals.durationMs / rounds.length / 60000 : 0,
    attacksPlayed: totals.attacksPlayed,
    attacksSucceeded: totals.attacksSucceeded,
    attackSuccessRate: totals.attacksPlayed ? totals.attacksSucceeded / totals.attacksPlayed : 0,
    budgetFailures: totals.budgetFailures,
    commonBudgetFailure: totals.budgetFailures.plaintiff === totals.budgetFailures.defense
      ? "tie"
      : totals.budgetFailures.plaintiff > totals.budgetFailures.defense ? "plaintiff" : "defense",
    casePerformance,
    neverTrialReady,
    deadCards
  };
}

export function plainClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function validateCardCollections(savedState, known, failures) {
  const groups = [
    [savedState.decks?.claims, known.caseIds, "claim deck"],
    [savedState.hands?.claims, known.caseIds, "claim hand"],
    [savedState.decks?.attacks, known.attackCardIds, "attack deck"],
    [savedState.hands?.attacks, known.attackCardIds, "attack hand"],
    [savedState.discards?.attacks, known.attackCardIds, "attack discards"],
    [savedState.decks?.motions, known.motionCardIds, "motion deck"],
    [savedState.hands?.motions, known.motionCardIds, "motion hand"],
    [savedState.discards?.motions, known.motionCardIds, "motion discards"]
  ];
  for (const [items, knownIds, label] of groups) {
    if (!Array.isArray(items)) {
      failures.push(`${label} must be an array.`);
      continue;
    }
    for (const item of items) validateKnownId(item?.id, knownIds, label, failures);
  }
  validateKnownId(savedState.pendingAttack?.attack?.id, known.attackCardIds, "pending attack", failures, true);
}

function validateKnownId(value, knownIds, label, failures, optional = false) {
  if (optional && !value) return;
  if (typeof value !== "string" || !value) {
    failures.push(`${label} id is missing.`);
    return;
  }
  if (knownIds && !knownIds.has(value)) failures.push(`${label} ${value} is not recognized.`);
}

function validateSafeIdentifiers(savedState, failures) {
  const identifiers = [];
  for (const collection of [
    savedState.hands?.claims,
    savedState.hands?.attacks,
    savedState.hands?.motions,
    savedState.discards?.attacks,
    savedState.discards?.motions
  ]) {
    for (const item of collection || []) {
      if (item.instanceId != null) identifiers.push(String(item.instanceId));
    }
  }
  for (const identifier of identifiers) {
    if (!/^[a-z0-9-]+-\d+$/.test(identifier)) failures.push(`Unsafe card instance id ${identifier}.`);
  }
  for (const defendant of savedState.activeCase?.defendants || []) {
    if (!/^[a-z0-9-]+$/.test(defendant.id || "")) failures.push(`Unsafe defendant id ${defendant.id || "<missing>"}.`);
  }
}

function containsMarkup(value) {
  if (typeof value === "string") return /[<>]/.test(value);
  if (Array.isArray(value)) return value.some(containsMarkup);
  if (value && typeof value === "object") return Object.values(value).some(containsMarkup);
  return false;
}
