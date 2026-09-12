import {
  ATTACK_CARDS,
  CASES,
  LEGAL_SOURCE_REVIEW,
  MOTION_CARDS,
  PHASES,
  SOURCES,
  TOPIC_MODULES,
  TUTORIAL_STEPS
} from "./data.js";
import { DEFAULT_SCENARIO_PACK_ID, SCENARIO_PACKS } from "./scenario-packs.generated.js";
import { escapeHtml, safeExternalHref, safeId } from "./safe-html.js";
import {
  commitInitialPrediction,
  completeLearningCycle,
  createLearningCycle,
  learningReviewPending,
  predictionLabel,
  recordLearningRuling
} from "./learning-cycle.js";
import {
  APP_VERSION,
  CONTENT_VERSION,
  addUniqueMetric,
  aggregatePlaytestStats,
  appendRoundStats,
  buildRoundAssessment,
  createEmptyPlaytestStats,
  createReplayEnvelope,
  createRoundMetrics,
  createSessionSnapshot,
  incrementMetric,
  normalizeSeed,
  parseReplayEnvelope,
  restoreSessionState,
  sanitizePlaytestStats,
  seededShuffle,
  seedToState
} from "./classroom.js";
import {
  activeByTopic,
  allEvidenceCollected,
  clone,
  evaluateAttack,
  formatMoney,
  hasFederalSmj,
  missingEvidence,
  resistanceLabel,
  statusFacts,
  toolName,
  withInstance
} from "./rules.js";

const DEFAULT_TOPICS = new Set(TOPIC_MODULES.filter((item) => item.default).map((item) => item.id));
const SCENARIO_BY_ID = new Map(SCENARIO_PACKS.map((pack) => [pack.id, pack]));
const DEFAULT_SCENARIO_PACK = SCENARIO_BY_ID.get(DEFAULT_SCENARIO_PACK_ID);
const SESSION_STORAGE_KEY = "civpro.v0.4.saved-session";
const AUTOSAVE_STORAGE_KEY = "civpro.v0.4.autosave";
const PLAYTEST_STORAGE_KEY = "civpro.v0.4.playtest-stats";
const KNOWN_SESSION_IDS = {
  scenarioPackIds: new Set(SCENARIO_PACKS.map((item) => item.id)),
  caseIds: new Set(CASES.map((item) => item.id)),
  attackCardIds: new Set(ATTACK_CARDS.map((item) => item.id)),
  motionCardIds: new Set(MOTION_CARDS.map((item) => item.id))
};
const CARD_LABELS = Object.fromEntries(
  [...ATTACK_CARDS, ...MOTION_CARDS].map((card) => [card.id, card.subtitle ? `${card.title}: ${card.subtitle}` : card.title])
);
const AUTHORITY_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));
const DISCOVERY_AUTHORITY_IDS = {
  deposition: ["frcp-30"],
  rfp: ["frcp-34"],
  admission: ["frcp-36"],
  expert: ["frcp-26"]
};
const HAND_LIMITS = { attacks: 6, motions: 8 };
const state = {
  players: [
    { name: "Player 1", score: 0, dismissed: 0 },
    { name: "Player 2", score: 0, dismissed: 0 }
  ],
  round: 1,
  plaintiff: 0,
  defense: 1,
  phase: "claim",
  decks: { claims: [], attacks: [], motions: [] },
  hands: { claims: [], attacks: [], motions: [] },
  discards: { attacks: [], motions: [] },
  resources: { plaintiff: 5, defense: 4 },
  activeCase: null,
  selectedDefendant: null,
  docket: [],
  pendingAttack: null,
  attackCount: 0,
  maxAttacks: 2,
  timer: null,
  deadline: null,
  secondsLeft: null,
  sequence: 1,
  eventSequence: 1,
  scenarioPackId: DEFAULT_SCENARIO_PACK_ID,
  seed: DEFAULT_SCENARIO_PACK?.recommendedSeed || "civpro-classroom",
  rngState: seedToState(DEFAULT_SCENARIO_PACK?.recommendedSeed || "civpro-classroom"),
  sessionStartedAt: null,
  sessionComplete: false,
  eventLog: [],
  roundHistory: [],
  currentRoundMetrics: null,
  lastAssessment: null,
  pendingRoundOutcome: null,
  learningCycle: {
    current: null,
    history: []
  },
  playtestStats: createEmptyPlaytestStats(),
  sessionStatus: "Local save and replay controls are ready.",
  sessionStatusError: false,
  autosaveAvailable: null,
  autosaveReady: false,
  settings: {
    activeTopics: new Set(DEFAULT_SCENARIO_PACK?.topics || DEFAULT_TOPICS),
    studyMode: false,
    noTimer: false,
    examMode: false,
    showExplanations: true
  },
  tutorial: {
    enabled: false,
    step: 0
  },
  judge: {
    tone: "neutral",
    title: "File a claim to start",
    body: "Pick one case from the claim hand. Then choose the defendant you want to sue and defend the filing through threshold attacks, discovery, and summary judgment.",
    authorityIds: [],
    proposition: "This prototype abstracts the 1L pretrial sequence into competitive card play.",
    revealed: true
  }
};

const els = {};

function init() {
  bindElements();
  setupScenarioControls();
  bindEvents();
  loadPlaytestStats();
  state.autosaveAvailable = readAutosaveCandidate();
  renderSettings();
  newGame();
  state.autosaveReady = true;
  if (state.autosaveAvailable) {
    setSessionStatus(`A compatible autosave from ${new Date(state.autosaveAvailable.savedAt).toLocaleString()} is ready to resume.`);
  } else {
    persistAutosave();
  }
  renderAutosaveControls();
}

function bindElements() {
  [
    "player-one-label",
    "player-one-score",
    "player-two-label",
    "player-two-score",
    "timer-card",
    "timer-label",
    "timer-value",
    "new-game-button",
    "tutorial-button",
    "print-button",
    "study-mode",
    "phase-list",
    "round-value",
    "roles-value",
    "resource-panel",
    "tutorial-panel",
    "scenario-track",
    "scenario-duration",
    "seed-input",
    "apply-scenario-button",
    "scenario-summary",
    "save-session-button",
    "load-session-button",
    "resume-autosave-button",
    "discard-autosave-button",
    "export-replay-button",
    "import-replay-input",
    "session-status",
    "topic-toggles",
    "mode-toggles",
    "jurisdiction-preset",
    "discovery-preset",
    "claim-hand",
    "active-case",
    "draw-attack-button",
    "draw-motion-button",
    "exchange-attack-card",
    "exchange-attack-button",
    "exchange-motion-card",
    "exchange-motion-button",
    "clear-game-data-button",
    "attack-hand",
    "motion-hand",
    "discovery-list",
    "learning-cycle-output",
    "judge-output",
    "assessment-output",
    "stats-output",
    "clear-stats-button",
    "source-list",
    "print-deck"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els["new-game-button"].addEventListener("click", () => {
    state.tutorial.enabled = false;
    discardAutosave(false);
    newGame();
  });
  els["tutorial-button"].addEventListener("click", startTutorial);
  els["print-button"].addEventListener("click", printCards);
  els["draw-attack-button"].addEventListener("click", () => drawToHand("attacks", 1, HAND_LIMITS.attacks));
  els["draw-motion-button"].addEventListener("click", () => drawToHand("motions", 1, HAND_LIMITS.motions));
  els["exchange-attack-button"].addEventListener("click", () => exchangeCard("attacks", els["exchange-attack-card"].value));
  els["exchange-motion-button"].addEventListener("click", () => exchangeCard("motions", els["exchange-motion-card"].value));
  els["clear-game-data-button"].addEventListener("click", clearLocalGameData);
  els["study-mode"].addEventListener("change", () => {
    state.settings.studyMode = els["study-mode"].checked;
    if (state.settings.studyMode) {
      stopTimer();
      setJudge("neutral", "Study mode enabled", "Timers are paused. Talk through the rule before choosing a card.", "Classroom review mode.");
    } else {
      resumePhaseTimer();
    }
    render();
  });
  els["jurisdiction-preset"].addEventListener("click", () => applyScenarioPack("jurisdiction-removal-50"));
  els["discovery-preset"].addEventListener("click", () => applyScenarioPack("discovery-rule56-50"));
  els["scenario-track"].addEventListener("change", previewScenarioSelection);
  els["scenario-duration"].addEventListener("change", previewScenarioSelection);
  els["apply-scenario-button"].addEventListener("click", applyScenarioSelection);
  els["save-session-button"].addEventListener("click", saveSession);
  els["load-session-button"].addEventListener("click", loadSession);
  els["resume-autosave-button"].addEventListener("click", resumeAutosave);
  els["discard-autosave-button"].addEventListener("click", () => discardAutosave(true));
  els["export-replay-button"].addEventListener("click", exportReplay);
  els["import-replay-input"].addEventListener("change", importReplay);
  els["clear-stats-button"].addEventListener("click", clearPlaytestStats);
}

function newGame() {
  stopTimer();
  const pack = activeScenarioPack();
  state.seed = normalizeSeed(els["seed-input"].value, pack?.recommendedSeed || state.seed);
  state.rngState = seedToState(state.seed);
  state.sequence = 1;
  state.eventSequence = 1;
  state.sessionStartedAt = Date.now();
  state.sessionComplete = false;
  state.eventLog = [];
  state.roundHistory = [];
  state.currentRoundMetrics = null;
  state.lastAssessment = null;
  state.pendingRoundOutcome = null;
  state.learningCycle = { current: null, history: [] };
  state.players = [
    { name: "Player 1", score: 0, dismissed: 0 },
    { name: "Player 2", score: 0, dismissed: 0 }
  ];
  state.round = 1;
  state.plaintiff = 0;
  state.defense = 1;
  buildDecks();
  state.hands.attacks = [];
  state.hands.motions = [];
  state.discards.attacks = [];
  state.discards.motions = [];
  startRound(true);
  setSessionStatus(`${pack?.title || "Custom topic deck"} started with seed ${state.seed}.`);
}

function startTutorial() {
  state.settings.noTimer = true;
  state.settings.showExplanations = true;
  state.settings.examMode = false;
  state.settings.studyMode = true;
  state.settings.activeTopics = new Set(["jurisdiction", "service", "joinder", "discovery"]);
  state.scenarioPackId = null;
  state.seed = "tutorial-v1";
  state.tutorial.enabled = true;
  state.tutorial.step = 0;
  els["seed-input"].value = state.seed;
  syncScenarioControls();
  renderSettings();
  newGame();
  setJudge("neutral", "Tutorial started", "Follow the tutorial panel from filing through discovery and trial readiness.", "Tutorial mode uses the same rules with timers paused.");
  render();
}

function buildDecks() {
  state.decks.claims = buildDeck("claims");
  state.decks.attacks = buildDeck("attacks");
  state.decks.motions = buildDeck("motions");
}

function buildDeck(type) {
  const pack = activeScenarioPack();
  const definitions = type === "claims" ? CASES : type === "attacks" ? ATTACK_CARDS : MOTION_CARDS;
  const ids = type === "claims" ? pack?.caseIds : type === "attacks" ? pack?.attackCardIds : pack?.motionCardIds;
  const selected = ids
    ? ids.map((id) => definitions.find((item) => item.id === id)).filter(Boolean)
    : activeByTopic(definitions, state.settings.activeTopics);
  return shuffle(selected.map(clone));
}

function startRound(initialHand = false) {
  stopTimer();
  const pack = activeScenarioPack();
  state.phase = "claim";
  state.resources = { ...(pack?.budgets || { plaintiff: 5, defense: 4 }) };
  state.activeCase = null;
  state.selectedDefendant = null;
  state.docket = [];
  state.pendingAttack = null;
  state.pendingRoundOutcome = null;
  state.learningCycle.current = null;
  state.attackCount = 0;
  state.maxAttacks = pack?.maxAttacks || 2;
  state.currentRoundMetrics = createRoundMetrics({
    round: state.round,
    scenarioPackId: state.scenarioPackId,
    seed: state.seed
  });
  if (initialHand) {
    drawToHand("attacks", HAND_LIMITS.attacks, HAND_LIMITS.attacks, false);
    drawToHand("motions", HAND_LIMITS.motions, HAND_LIMITS.motions, false);
  }
  state.hands.claims = drawCards("claims", pack?.claimHandSize || 3);
  if (!initialHand) {
    drawToHand("attacks", 2, HAND_LIMITS.attacks, false);
    drawToHand("motions", 2, HAND_LIMITS.motions, false);
  }
  if (state.tutorial.enabled) seedTutorialHands();
  setJudge(
    "neutral",
    `${state.players[state.plaintiff].name} is plaintiff`,
    "File one claim. The defense then has a short threshold window to attack jurisdiction, service, venue, pleading, removal, joinder, supplemental jurisdiction, or preview modules.",
    "The game treats each round as a fresh civil action."
  );
  render();
}

function seedTutorialHands() {
  state.hands.claims = [withInstance(CASES.find((item) => item.id === "tire-failure"), state.sequence++)];
  state.hands.attacks = ATTACK_CARDS.filter((card) => ["pj", "remove", "summary-judgment"].includes(card.id)).map((card) => withInstance(card, state.sequence++));
  state.hands.motions = MOTION_CARDS.filter((card) =>
    ["notice-deposition", "request-production", "motion-compel", "expert-disclosure", "remand", "show-record"].includes(card.id)
  ).map((card) => withInstance(card, state.sequence++));
}

function drawCards(type, count) {
  if (!state.decks[type].length) replenishDeck(type);
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    if (!state.decks[type].length) break;
    const card = withInstance(state.decks[type].shift(), state.sequence++);
    cards.push(card);
    trackCardDraw(card);
  }
  return cards;
}

function replenishDeck(type) {
  if (type === "claims") {
    state.decks.claims = buildDeck("claims");
    return;
  }
  if (!state.discards[type]?.length) return;
  const definitions = type === "attacks" ? ATTACK_CARDS : MOTION_CARDS;
  const recycled = state.discards[type]
    .map((card) => definitions.find((item) => item.id === card.id))
    .filter(Boolean)
    .map(clone);
  state.discards[type] = [];
  state.decks[type] = shuffle(recycled);
}

function drawToHand(type, count, limit, shouldRender = true) {
  if (state.hands[type].length >= limit) return;
  const room = limit - state.hands[type].length;
  state.hands[type].push(...drawCards(type, Math.min(room, count)));
  if (shouldRender) render();
}

function exchangeAllowed(type) {
  if (isLearningActionBlocked()) return false;
  return type === "attacks"
    ? ["attack", "summary"].includes(state.phase)
    : ["response", "discovery"].includes(state.phase);
}

function exchangeCard(type, instanceId) {
  if (!exchangeAllowed(type)) return;
  const index = state.hands[type].findIndex((card) => card.instanceId === instanceId);
  if (index < 0) return;
  // Draw before discarding so an exchange cannot immediately return the same card.
  const replacement = drawCards(type, 1)[0];
  if (!replacement) {
    setSessionStatus("No different card is available to exchange yet.");
    return;
  }
  const [discarded] = state.hands[type].splice(index, 1, replacement);
  state.discards[type].push(discarded);
  state.currentRoundMetrics.cardExchanges ||= { attacks: 0, motions: 0 };
  state.currentRoundMetrics.cardExchanges[type] += 1;
  if (state.learningCycle.current?.stage === "response") {
    state.learningCycle.current.mechanicalCheck.responsiveCardIds = state.hands.motions
      .filter((card) => card.kind === "motion" && card.answers.includes(state.pendingAttack.attack.id))
      .map((card) => card.id);
    state.learningCycle.current.mechanicalCheck.message = state.learningCycle.current.mechanicalCheck.responsiveCardIds.length
      ? "Choose a responsive motion, or stand on the prediction without responding."
      : "No responsive motion is currently in hand. Exchange a card or stand on the prediction without responding.";
  }
  recordDocket("Card exchanged", `${discarded.title} exchanged for ${replacement.title}; no budget spent.`, {
    type: "card-exchanged", cardId: discarded.id, replacementId: replacement.id
  });
  setSessionStatus("Card exchanged. The hand size and litigation budget are unchanged.");
  render();
}

function fileClaim(instanceId) {
  if (state.phase !== "claim") return;
  const selected = state.hands.claims.find((item) => item.instanceId === normalizeInstanceId(instanceId));
  if (!selected) return;
  state.activeCase = clone(selected);
  state.selectedDefendant = null;
  state.phase = "defendant";
  state.docket = [];
  state.currentRoundMetrics.caseId = selected.id;
  state.currentRoundMetrics.caseTitle = selected.title;
  recordDocket(
    "Complaint drafted",
    `${selected.plaintiff.name} files a ${selected.type.toLowerCase()} claim in ${selected.forumState} ${selected.court} court.`,
    { type: "claim-filed", caseId: selected.id }
  );
  setJudge(
    "neutral",
    "Complaint on the table",
    "Choose the defendant. That choice controls personal jurisdiction, complete diversity, forum-defendant removal limits, joinder, and discovery targets.",
    "Civil procedure strategy starts with party selection and forum selection."
  );
  advanceTutorial("file-claim");
  render();
}

function chooseDefendant(defendantId) {
  if (state.phase !== "defendant" || !state.activeCase) return;
  const defendant = state.activeCase.defendants.find((item) => item.id === defendantId);
  if (!defendant) return;
  state.selectedDefendant = defendant;
  state.activeCase.currentCourt = state.activeCase.court;
  state.activeCase.currentForum = state.activeCase.forumState;
  state.activeCase.dismissed = false;
  state.activeCase.collectedEvidence = [];
  state.activeCase.joinedDefendantIds = [];
  state.phase = "attack";
  state.currentRoundMetrics.defendantId = defendant.id;
  state.currentRoundMetrics.defendantName = defendant.name;
  recordDocket("Defendant selected", `${defendant.name} is named. ${defendant.role}`, {
    type: "defendant-selected",
    defendantId: defendant.id
  });
  setJudge(
    "neutral",
    "Threshold window opened",
    `The defense may play up to ${state.maxAttacks} early attack${state.maxAttacks === 1 ? "" : "s"}. Waivable defenses become harder to use after the first threshold response.`,
    "Rule 12(g) and 12(h) make timing part of the game."
  );
  advanceTutorial("choose-defendant");
  startTimer("Defense attack window", activeScenarioPack()?.timers.attackSeconds || 25, () => passAttacks());
  render();
}

function playAttack(instanceId) {
  if (!state.activeCase || !state.selectedDefendant) return;
  const attack = state.hands.attacks.find((card) => card.instanceId === normalizeInstanceId(instanceId));
  if (!attack || !canPlayAttack(attack) || !spend("defense", attack.cost)) return;
  removeFromHand("attacks", instanceId);
  state.discards.attacks.push(attack);
  trackCardPlayed(attack);
  state.currentRoundMetrics.attacksPlayed += 1;
  stopTimer();
  const evaluation = evaluateAttack({
    attack,
    activeCase: state.activeCase,
    selectedDefendant: state.selectedDefendant,
    attackCount: state.attackCount,
    missingEvidence: missingEvidence(state.activeCase)
  });
  trackDoctrine(attack.subtitle, evaluation.authorityIds);
  state.pendingAttack = { attack, evaluation };
  state.learningCycle.current = createLearningCycle({
    round: state.round,
    attack,
    evaluation,
    activeCase: state.activeCase,
    selectedDefendant: state.selectedDefendant,
    responseOptions: state.hands.motions
      .filter((card) => card.kind === "motion" && card.answers.includes(attack.id))
      .map((card) => card.id)
  });
  state.phase = "response";
  recordDocket(`${attack.title} played`, attack.subtitle, {
    type: "attack-played",
    cardId: attack.id,
    doctrine: attack.subtitle,
    authorityIds: evaluation.authorityIds
  });
  setJudge("neutral", `${attack.subtitle} pending`, evaluation.prompt, evaluation.authorityIds, evaluation.proposition);
  render();
}

function canPlayAttack(attack) {
  if (isLearningActionBlocked()) return false;
  if (attack.timing === "summary") return state.phase === "summary";
  return state.phase === "attack";
}

function respondWithMotion(instanceId) {
  if (state.phase !== "response" || !state.pendingAttack || state.learningCycle.current?.stage !== "response") return;
  const motion = state.hands.motions.find((card) => card.instanceId === normalizeInstanceId(instanceId));
  if (!motion || motion.kind !== "motion" || !spend("plaintiff", motion.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(motion);
  trackCardPlayed(motion);
  resolveAttack(motion);
}

function resolveAttack(motion, responseReason = "timeout") {
  if (!state.pendingAttack) return;
  stopTimer();
  const { attack, evaluation } = state.pendingAttack;
  state.pendingAttack = null;
  const motionIsResponsive = Boolean(motion && motion.answers.includes(attack.id));
  const correctMotion = motionIsResponsive && evaluation.counterWorks;
  const attackSucceeded = Boolean(evaluation.hasMerit && !correctMotion);
  if (state.learningCycle.current?.stage === "response") {
    state.learningCycle.current = recordLearningRuling(state.learningCycle.current, {
      attackSucceeded,
      motionId: motion?.id || null,
      motionTitle: motion?.title || null,
      motionResponsive: motionIsResponsive,
      body: attackSucceeded ? evaluation.body : evaluation.cureDetail || evaluation.winDetail,
      authorityIds: evaluation.authorityIds,
      proposition: evaluation.proposition
    });
  }

  if (attack.id === "summary-judgment") {
    resolveSummaryJudgment(motion, motionIsResponsive);
    return;
  }

  if (motion) {
    recordDocket(`${motion.title} filed`, motion.text, {
      type: "motion-played",
      cardId: motion.id,
      attackId: attack.id,
      correct: motionIsResponsive
    });
  } else {
    recordDocket(responseReason === "declined" ? "Response declined" : "Response time expired",
      responseReason === "declined" ? "The plaintiff chose no response; the attack is evaluated on its merits." : "The motion window expired; the attack is evaluated on its merits.", {
      type: responseReason === "declined" ? "response-declined" : "response-missed",
      attackId: attack.id,
      correct: false
    });
  }

  if (motion && !motionIsResponsive) {
    trackWrongMotion(motion, `Did not answer ${attack.subtitle}.`, attack.id);
    applyUnansweredAttack(attack, {
      ...evaluation,
      body: `That motion does not answer ${attack.subtitle}. The attack is treated as unopposed.`
    });
    return;
  }

  if (evaluation.hasMerit && !correctMotion) {
    applyMeritoriousAttack(attack, evaluation, motion ? `${motion.title} was procedurally responsive, but the facts still support the attack.` : evaluation.body);
    return;
  }

  if (evaluation.hasMerit && correctMotion) {
    trackAttackResult(false);
    state.attackCount += 1;
    applyCure(attack.id);
    recordDocket("Issue cured", evaluation.cureDetail || evaluation.winDetail, {
      type: "attack-cured",
      attackId: attack.id,
      authorityIds: evaluation.authorityIds
    });
    setJudge("good", "Procedural save", evaluation.cureDetail || evaluation.winDetail, evaluation.authorityIds, evaluation.proposition);
    continueAfterThresholdAttack();
    return;
  }

  trackAttackResult(false);
  state.attackCount += 1;
  recordDocket("Attack denied", evaluation.winDetail, {
    type: "attack-denied",
    attackId: attack.id,
    authorityIds: evaluation.authorityIds
  });
  setJudge("good", "Motion granted", evaluation.winDetail, evaluation.authorityIds, evaluation.proposition);
  continueAfterThresholdAttack();
}

function applyUnansweredAttack(attack, evaluation) {
  if (evaluation.hasMerit) {
    applyMeritoriousAttack(attack, evaluation, evaluation.body);
    return;
  }
  trackAttackResult(false);
  state.attackCount += 1;
  recordDocket("Attack fails", evaluation.winDetail || "The facts do not support the procedural attack.", {
    type: "attack-denied",
    attackId: attack.id,
    authorityIds: evaluation.authorityIds
  });
  setJudge("neutral", "Attack fails", evaluation.winDetail || "The facts do not support the procedural attack.", evaluation.authorityIds, evaluation.proposition);
  continueAfterThresholdAttack();
}

function applyCure(attackId) {
  if (attackId === "failure-state-claim") state.activeCase.pleadingLevel = 2;
  if (attackId === "venue") state.activeCase.currentForum = state.activeCase.eventState;
  if (attackId === "service") state.activeCase.serviceProper = true;
  if (attackId === "erie") state.activeCase.stateLawConflict = false;
  if (attackId === "class-cert") state.activeCase.rule23Ready = true;
  if (attackId === "supplemental" && state.activeCase.supplementalClaim) {
    state.activeCase.supplementalClaim.secured = true;
  }
}

function applyMeritoriousAttack(attack, evaluation, body) {
  trackAttackResult(true);
  if (attack.id === "remove") {
    state.activeCase.currentCourt = "federal";
    state.attackCount += 1;
    recordDocket("Case removed", "The claim moves to federal court.", {
      type: "forum-changed",
      attackId: attack.id,
      authorityIds: evaluation.authorityIds
    });
    setJudge("bad", "Removed to federal court", body || evaluation.body, evaluation.authorityIds, evaluation.proposition);
    continueAfterThresholdAttack();
    return;
  }

  if (attack.id === "join") {
    const joinedDefendant = state.activeCase.defendants.find((item) =>
      item.forumDefendant
      && item.id !== state.selectedDefendant.id
      && item.sameTransaction
      && !(state.activeCase.joinedDefendantIds || []).includes(item.id)
    );
    state.activeCase.joinedDefendantIds = [...(state.activeCase.joinedDefendantIds || [])];
    if (joinedDefendant) state.activeCase.joinedDefendantIds.push(joinedDefendant.id);
    if (state.activeCase.currentCourt === "federal" && !hasFederalSmj(state.activeCase, state.selectedDefendant)) {
      state.activeCase.currentCourt = "state";
    }
    state.attackCount += 1;
    recordDocket("Local party joined", joinedDefendant
      ? `${joinedDefendant.name} is joined. Citizenship and removal must now be analyzed separately.`
      : "A qualifying local party is joined. Citizenship and removal must now be analyzed separately.", {
      type: "party-joined",
      attackId: attack.id,
      joinedDefendantId: joinedDefendant?.id || null,
      authorityIds: evaluation.authorityIds
    });
    setJudge("bad", "Joinder changes the forum math", body || evaluation.body, evaluation.authorityIds, evaluation.proposition);
    continueAfterThresholdAttack();
    return;
  }

  if (attack.id === "venue") {
    state.activeCase.currentForum = state.activeCase.eventState;
    state.attackCount += 1;
    recordDocket("Transferred", `Venue moves to ${state.activeCase.eventState}.`, {
      type: "forum-changed",
      attackId: attack.id,
      authorityIds: evaluation.authorityIds
    });
    setJudge("bad", "Venue attack succeeds", body || evaluation.body, evaluation.authorityIds, evaluation.proposition);
    continueAfterThresholdAttack();
    return;
  }

  dismissCase(attack.subtitle, body || evaluation.body, evaluation.authorityIds, evaluation.proposition);
}

function continueAfterThresholdAttack() {
  if (state.activeCase.dismissed) return;
  if (state.attackCount >= state.maxAttacks) {
    enterDiscovery();
    return;
  }
  state.phase = "attack";
  startTimer("Defense attack window", activeScenarioPack()?.timers.attackSeconds || 18, () => passAttacks());
  render();
}

function passAttacks() {
  if (state.phase !== "attack" || isLearningActionBlocked()) return;
  stopTimer();
  recordDocket("Threshold attacks closed", "The case moves into discovery.", { type: "phase-changed" });
  advanceTutorial("pass-attacks");
  enterDiscovery();
}

function enterDiscovery() {
  if (!state.activeCase || state.activeCase.dismissed) return;
  state.phase = "discovery";
  setJudge(
    "neutral",
    "Discovery opened",
    "Collect every listed proof item. If discovery closes with a missing element, the defense can use Rule 56 to press for summary judgment.",
    "FRCP 26, 30, 34, 36, and 37 are collapsed into discovery tool cards."
  );
  render();
}

function requestEvidence(evidenceId, instanceId) {
  if (state.phase !== "discovery" || !state.activeCase || isLearningActionBlocked()) return;
  const evidence = state.activeCase.evidence.find((item) => item.id === evidenceId);
  const tool = state.hands.motions.find((item) => item.instanceId === normalizeInstanceId(instanceId));
  if (!evidence || !tool || tool.kind !== "discovery-tool" || !spend("plaintiff", tool.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(tool);
  trackCardPlayed(tool);
  trackDoctrine(tool.title, DISCOVERY_AUTHORITY_IDS[tool.tool]);

  if (tool.tool !== evidence.tool) {
    const reason = `${tool.title} does not match ${evidence.title}; ${toolName(evidence.tool)} was required.`;
    trackWrongMotion(tool, reason, evidence.id);
    recordDocket("Wrong discovery tool", `${tool.title} does not match ${evidence.title}.`, {
      type: "wrong-discovery-tool",
      cardId: tool.id,
      evidenceId: evidence.id,
      correct: false
    });
    setJudge("bad", "Discovery miss", `${evidence.title} calls for ${toolName(evidence.tool)}.`);
    render();
    return;
  }

  recordDocket(tool.title, `${state.players[state.plaintiff].name} targets ${evidence.title}.`, {
    type: "discovery-request",
    cardId: tool.id,
    evidenceId: evidence.id,
    correct: true,
    authorityIds: DISCOVERY_AUTHORITY_IDS[tool.tool]
  });
  const resistance = evidence.resistance || "resistance";
  if (evidence.resistance) {
    evidence.pendingResistance = resistance;
    setJudge(
      "neutral",
      "Discovery objection raised",
      `The defense objects on ${resistanceLabel(resistance)} grounds. Use a discovery motion card to solve it.`,
      ["frcp-26", "frcp-37"],
      "Rules 26 and 37 frame proportional discovery, objections, and motions to compel."
    );
    advanceTutorial("request-resistant-docs");
    render();
    return;
  }

  collectEvidence(evidence);
  if (state.phase !== "trial") {
    setJudge("good", "Discovery obtained", `${evidence.title} is collected.`, DISCOVERY_AUTHORITY_IDS[evidence.tool], "The selected discovery device is used to build record evidence relevant to the claim.");
  }
  if (evidence.tool === "deposition") advanceTutorial("collect-deposition");
  if (evidence.tool === "expert") advanceTutorial("expert-proof");
  render();
}

function answerDiscoveryResistance(instanceId) {
  if (state.phase !== "discovery" || !state.activeCase || isLearningActionBlocked()) return;
  const evidence = state.activeCase.evidence.find((item) => item.pendingResistance);
  const motion = state.hands.motions.find((item) => item.instanceId === normalizeInstanceId(instanceId));
  if (!evidence || !motion || motion.kind !== "discovery" || !spend("plaintiff", motion.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(motion);
  trackCardPlayed(motion);
  trackDoctrine("Discovery objections", ["frcp-26", "frcp-37"]);
  const resistance = evidence.pendingResistance;
  const works = motion.answers.includes(resistance);
  recordDocket(motion.title, motion.text, {
    type: "discovery-motion",
    cardId: motion.id,
    evidenceId: evidence.id,
    correct: works,
    authorityIds: ["frcp-26", "frcp-37"]
  });

  if (!works) {
    trackWrongMotion(motion, `Did not solve the ${resistanceLabel(resistance)} objection.`, evidence.id);
    delete evidence.pendingResistance;
    evidence.failed = true;
    setJudge("bad", "Discovery denied", `${motion.title} does not solve a ${resistanceLabel(resistance)} objection.`, ["frcp-26", "frcp-37"], "Discovery disputes require a response suited to the objection and Rule 37 procedure.");
    render();
    return;
  }

  delete evidence.pendingResistance;
  collectEvidence(evidence);
  if (state.phase !== "trial") {
    setJudge("good", "Discovery motion granted", `${motion.title} answers the objection. ${evidence.title} is now in the record.`, ["frcp-26", "frcp-37"], "Rules 26 and 37 govern discovery scope, objections, and enforcement.");
  }
  advanceTutorial("motion-to-compel");
  render();
}

function collectEvidence(evidence) {
  evidence.complete = true;
  evidence.failed = false;
  if (!state.activeCase.collectedEvidence.includes(evidence.id)) {
    state.activeCase.collectedEvidence.push(evidence.id);
  }
  recordDocket("Evidence collected", evidence.title, {
    type: "evidence-collected",
    evidenceId: evidence.id,
    authorityIds: DISCOVERY_AUTHORITY_IDS[evidence.tool]
  });
  if (allEvidenceCollected(state.activeCase)) {
    awardTrialReady();
  }
}

function closeDiscovery() {
  if (state.phase !== "discovery" || isLearningActionBlocked()) return;
  state.phase = "summary";
  recordDocket("Discovery closed", `${missingEvidence(state.activeCase).length} proof item(s) remain incomplete.`, {
    type: "phase-changed",
    authorityIds: ["frcp-56"]
  });
  setJudge("neutral", "Discovery closed", "The defense may now play summary judgment. The plaintiff must show record evidence for every required proof item.", ["frcp-56"], "Rule 56 turns the discovery record into the next procedural fight.");
  render();
}

function resolveSummaryJudgment(motion, motionIsResponsive) {
  const missing = missingEvidence(state.activeCase);
  if (motion) {
    recordDocket(`${motion.title} filed`, motion.text, {
      type: "motion-played",
      cardId: motion.id,
      attackId: "summary-judgment",
      correct: motionIsResponsive
    });
    if (!motionIsResponsive) trackWrongMotion(motion, "Did not answer Rule 56 summary judgment.", "summary-judgment");
  }
  recordDocket(
    "Rule 56 motion",
    missing.length ? `Missing proof: ${missing.map((item) => item.title).join(", ")}.` : "Plaintiff has evidence on every listed item.",
    { type: "summary-judgment", authorityIds: ["frcp-56"], correct: missing.length === 0 }
  );

  if (!motion || !motionIsResponsive || missing.length) {
    if (missing.length) {
      trackAttackResult(true);
      dismissCase("Summary judgment", "The plaintiff lacks record evidence for every required element.", ["frcp-56"], "Rule 56 requires record support sufficient to show a genuine dispute of material fact.");
      return;
    }
  }

  trackAttackResult(false);
  awardTrialReady();
  setJudge("good", "Summary judgment denied", "The record contains every required proof item, so the claim is trial ready.", ["frcp-56"], "The game treats a complete proof checklist as record support sufficient to survive its Rule 56 abstraction.");
}

function awardTrialReady() {
  if (!state.activeCase || state.phase === "trial") return;
  const points = state.activeCase.federalQuestion || state.activeCase.amount > 100000 || state.activeCase.classAction ? 3 : 2;
  state.players[state.plaintiff].score += points;
  state.phase = "trial";
  recordDocket("Trial ready", `${state.players[state.plaintiff].name} scores ${points} points.`, {
    type: "round-outcome",
    outcome: "trial-ready"
  });
  finalizeRoundWhenReady({ type: "trial-ready", label: "Trial ready", reason: "Every required proof item is in the record." });
  setJudge("good", "Claim reaches trial", `The plaintiff survives threshold attacks and builds the record. Score ${points} points, then rotate roles.`, "The game treats trial readiness as the Civ Pro win condition.");
  stopTimer();
  render();
}

function dismissCase(title, body, authorityIds = [], proposition = "") {
  if (!state.activeCase || state.phase === "trial") return;
  state.activeCase.dismissed = true;
  state.players[state.defense].score += 1;
  state.players[state.plaintiff].dismissed += 1;
  state.phase = "trial";
  trackDoctrine(title, authorityIds);
  recordDocket("Claim dismissed", title, {
    type: "round-outcome",
    outcome: "dismissed",
    authorityIds
  });
  finalizeRoundWhenReady({ type: "dismissed", label: "Dismissed", reason: title });
  setJudge("bad", title, `${body} Defense scores 1 point.`, authorityIds, proposition);
  stopTimer();
  render();
}

function nextRound() {
  if (isLearningActionBlocked()) return;
  stopTimer();
  advanceTutorial("next-round");
  const roundLimit = activeScenarioPack()?.rounds;
  if (roundLimit && state.round >= roundLimit) {
    state.sessionComplete = true;
    setJudge(
      "good",
      "Classroom session complete",
      `${roundLimit} planned round${roundLimit === 1 ? "" : "s"} finished. Use the assessment and local balance signals for debrief, then export the replay if the class found a confusing result.`,
      "Version 0.4 source-linked classroom workflow."
    );
    setSessionStatus(`Session complete after ${roundLimit} planned round${roundLimit === 1 ? "" : "s"}.`);
    render();
    return;
  }
  state.round += 1;
  const oldPlaintiff = state.plaintiff;
  state.plaintiff = state.defense;
  state.defense = oldPlaintiff;
  startRound();
}

function canAfford(role, cost) {
  return state.resources[role] >= cost;
}

function spend(role, cost) {
  if (!canAfford(role, cost)) {
    if (state.currentRoundMetrics?.budgetFailures) state.currentRoundMetrics.budgetFailures[role] += 1;
    recordDocket("Budget exhausted", `${role} could not spend ${cost} budget.`, {
      type: "budget-failure",
      role,
      cost
    });
    setJudge("bad", "Budget exhausted", `${role === "plaintiff" ? "Plaintiff" : "Defense"} needs ${cost} litigation budget. Draw or wait for the next round.`, "Budget is a game abstraction, not a Civ Pro rule.");
    render();
    return false;
  }
  state.resources[role] -= cost;
  return true;
}

function removeFromHand(type, instanceId) {
  const index = state.hands[type].findIndex((card) => card.instanceId === normalizeInstanceId(instanceId));
  if (index === -1) return null;
  return state.hands[type].splice(index, 1)[0];
}

function normalizeInstanceId(instanceId) {
  return String(instanceId);
}

function recordDocket(title, detail, metadata = {}) {
  const entry = {
    id: state.eventSequence++,
    round: state.round,
    phase: state.phase,
    type: metadata.type || "docket-note",
    title,
    detail,
    ...metadata
  };
  state.docket.push(entry);
  state.eventLog.push(clone(entry));
  return entry;
}

function trackCardDraw(card) {
  if (!state.currentRoundMetrics) return;
  if (!KNOWN_SESSION_IDS.attackCardIds.has(card.id) && !KNOWN_SESSION_IDS.motionCardIds.has(card.id)) return;
  incrementMetric(state.currentRoundMetrics.cardsDrawn, card.id);
}

function trackCardPlayed(card) {
  if (!state.currentRoundMetrics || !card?.id) return;
  incrementMetric(state.currentRoundMetrics.cardsPlayed, card.id);
}

function trackAttackResult(succeeded) {
  if (succeeded && state.currentRoundMetrics) state.currentRoundMetrics.attacksSucceeded += 1;
}

function trackWrongMotion(card, reason, targetId) {
  if (!state.currentRoundMetrics || !card) return;
  state.currentRoundMetrics.wrongMotions.push({
    cardId: card.id,
    title: card.title,
    reason,
    targetId
  });
}

function trackDoctrine(doctrine, authorityIds = []) {
  if (!state.currentRoundMetrics) return;
  addUniqueMetric(state.currentRoundMetrics.doctrinesTriggered, doctrine);
  for (const authorityId of normalizeAuthorityIds(authorityIds)) {
    addUniqueMetric(state.currentRoundMetrics.sourceHooks, authorityId);
  }
}

function finalizeRound(outcome) {
  if (!state.currentRoundMetrics || state.lastAssessment?.round === state.round) return;
  const assessment = buildRoundAssessment({
    metrics: state.currentRoundMetrics,
    activeCase: state.activeCase,
    outcome
  });
  state.lastAssessment = assessment;
  state.roundHistory.push(assessment);
  state.playtestStats = appendRoundStats(state.playtestStats, assessment);
  persistPlaytestStats();
}

function finalizeRoundWhenReady(outcome) {
  state.pendingRoundOutcome = outcome;
  if (learningReviewPending(state.learningCycle.current)) return;
  finalizeRound(outcome);
  state.pendingRoundOutcome = null;
}

function startTimer(label, seconds, onExpire) {
  stopTimer();
  if (state.settings.studyMode || state.settings.noTimer || isLearningActionBlocked()) {
    state.secondsLeft = null;
    state.deadline = null;
    return;
  }
  state.secondsLeft = seconds;
  state.deadline = { label, onExpire };
  state.timer = window.setInterval(() => {
    state.secondsLeft -= 1;
    if (state.secondsLeft <= 0) {
      const expire = state.deadline?.onExpire;
      stopTimer();
      if (expire) expire();
      return;
    }
    renderTimer();
  }, 1000);
}

function isLearningActionBlocked() {
  return ["predict", "revise"].includes(state.learningCycle.current?.stage);
}

function stopTimer() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.deadline = null;
  state.secondsLeft = null;
}

function setJudge(tone, title, body, authorityIds = [], proposition = "") {
  if (typeof authorityIds === "string") {
    proposition = proposition || authorityIds;
    authorityIds = [];
  }
  state.judge = {
    tone,
    title,
    body,
    authorityIds: normalizeAuthorityIds(authorityIds),
    proposition,
    revealed: !state.settings.examMode || tone === "neutral"
  };
}

function normalizeAuthorityIds(authorityIds) {
  const values = Array.isArray(authorityIds) ? authorityIds : authorityIds ? [authorityIds] : [];
  return [...new Set(values.filter((id) => AUTHORITY_BY_ID.has(id)))];
}

function submitInitialPrediction(form) {
  try {
    const formData = new FormData(form);
    state.learningCycle.current = commitInitialPrediction(state.learningCycle.current, {
      prediction: formData.get("prediction"),
      reasoning: formData.get("reasoning")
    });
    recordDocket("Prediction committed", predictionLabel(state.learningCycle.current.initial.prediction), {
      type: "learning-prediction",
      attackId: state.learningCycle.current.attackId
    });
    setJudge(
      "neutral",
      "Prediction locked",
      state.learningCycle.current.mechanicalCheck.message,
      state.pendingAttack?.evaluation.authorityIds || [],
      state.pendingAttack?.evaluation.proposition || ""
    );
    startTimer("Motion response due", activeScenarioPack()?.timers.responseSeconds || 20, () => resolveAttack(null));
    setSessionStatus("Initial prediction preserved. Choose a response or stand on the prediction.");
    render();
  } catch (error) {
    setSessionStatus(error.message, true);
    showLearningError(error.message);
  }
}

function standOnPrediction() {
  if (state.phase !== "response" || state.learningCycle.current?.stage !== "response") return;
  resolveAttack(null, "declined");
}

function submitLearningRevision(form) {
  try {
    const formData = new FormData(form);
    const completed = completeLearningCycle(state.learningCycle.current, {
      revision: formData.get("revision"),
      alteredPrediction: formData.get("alteredPrediction"),
      alteredReasoning: formData.get("alteredReasoning")
    });
    state.learningCycle.current = completed;
    state.learningCycle.history.push(clone(completed));
    if (state.currentRoundMetrics) {
      state.currentRoundMetrics.learningCycles ||= [];
      state.currentRoundMetrics.learningCycles.push(clone(completed));
    }
    recordDocket("Ruling reflection completed", completed.predictionCorrect ? "Initial prediction matched the ruling." : "Initial prediction was revised after the ruling.", {
      type: "learning-revision",
      attackId: completed.attackId,
      predictionCorrect: completed.predictionCorrect,
      authorityIds: completed.ruling.authorityIds
    });
    if (state.pendingRoundOutcome) {
      const outcome = state.pendingRoundOutcome;
      state.pendingRoundOutcome = null;
      finalizeRound(outcome);
    }
    resumePhaseTimer();
    setSessionStatus("Revision and altered-fact prediction preserved in the session debrief.");
    render();
  } catch (error) {
    setSessionStatus(error.message, true);
    showLearningError(error.message);
  }
}

function resumePhaseTimer() {
  if (state.phase === "attack") {
    startTimer("Defense attack window", activeScenarioPack()?.timers.attackSeconds || 18, () => passAttacks());
  } else if (state.phase === "response" && state.learningCycle.current?.stage === "response") {
    startTimer("Motion response due", activeScenarioPack()?.timers.responseSeconds || 20, () => resolveAttack(null));
  }
}

function advanceTutorial(action) {
  if (!state.tutorial.enabled) return;
  const current = TUTORIAL_STEPS[state.tutorial.step];
  if (current?.action === action) {
    state.tutorial.step = Math.min(state.tutorial.step + 1, TUTORIAL_STEPS.length - 1);
  }
}

function activeScenarioPack() {
  return SCENARIO_BY_ID.get(state.scenarioPackId) || null;
}

function setupScenarioControls() {
  const tracks = [...new Map(SCENARIO_PACKS.map((pack) => [pack.trackId, pack.shortTitle])).entries()];
  const durations = [...new Set(SCENARIO_PACKS.map((pack) => pack.durationMinutes))].sort((a, b) => a - b);
  els["scenario-track"].innerHTML = tracks
    .map(([id, title]) => `<option value="${safeId(id)}">${escapeHtml(title)}</option>`)
    .join("");
  els["scenario-duration"].innerHTML = durations
    .map((minutes) => `<option value="${minutes}">${minutes} minutes</option>`)
    .join("");
  syncScenarioControls();
}

function syncScenarioControls() {
  const pack = activeScenarioPack();
  if (pack) {
    els["scenario-track"].value = pack.trackId;
    els["scenario-duration"].value = String(pack.durationMinutes);
  }
  els["seed-input"].value = state.seed;
  renderScenarioSummary(pack);
}

function selectedScenarioPack() {
  return SCENARIO_PACKS.find((pack) =>
    pack.trackId === els["scenario-track"].value
    && pack.durationMinutes === Number(els["scenario-duration"].value)
  ) || DEFAULT_SCENARIO_PACK;
}

function previewScenarioSelection() {
  const pack = selectedScenarioPack();
  els["seed-input"].value = pack.recommendedSeed;
  renderScenarioSummary(pack, true);
}

function applyScenarioSelection() {
  applyScenarioPack(selectedScenarioPack().id);
}

function applyScenarioPack(packId) {
  const pack = SCENARIO_BY_ID.get(packId);
  if (!pack) return;
  const seedInput = els["seed-input"].value;
  const seedBelongsToPack = SCENARIO_PACKS.some((item) => item.recommendedSeed === seedInput);
  state.scenarioPackId = pack.id;
  state.settings.activeTopics = new Set(pack.topics);
  state.tutorial.enabled = false;
  state.seed = !seedInput || seedBelongsToPack
    ? pack.recommendedSeed
    : normalizeSeed(seedInput, pack.recommendedSeed);
  els["seed-input"].value = state.seed;
  syncScenarioControls();
  renderSettings();
  newGame();
}

function renderScenarioSummary(pack = activeScenarioPack(), preview = false) {
  if (!pack) {
    els["scenario-summary"].innerHTML = `
      <span class="status-pill">Custom topic deck</span>
      <p>Manual module choices are active. Select and apply a validated scenario pack for timed lesson structure, a round limit, and pack-specific printing.</p>
    `;
    return;
  }
  els["scenario-summary"].innerHTML = `
    <span class="status-pill">${preview ? "Preview" : "Active"}: ${pack.durationMinutes} minutes / ${pack.rounds} round${pack.rounds === 1 ? "" : "s"}</span>
    <p><strong>${escapeHtml(pack.shortTitle)}</strong></p>
    <p>${escapeHtml(pack.summary)}</p>
    <p class="schedule-line">${pack.schedule.briefing} min brief / ${pack.schedule.play} min play / ${pack.schedule.debrief} min debrief</p>
    <p>App ${escapeHtml(APP_VERSION)}; content ${escapeHtml(CONTENT_VERSION)}; sources reviewed through ${escapeHtml(LEGAL_SOURCE_REVIEW.reviewedThrough)}.</p>
    <details>
      <summary>Objectives and checkpoints</summary>
      <ul>${pack.learningObjectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <ol>${pack.checkpoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </details>
  `;
}

function getLocalStorage() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readAutosaveCandidate() {
  const storage = getLocalStorage();
  const raw = storage?.getItem(AUTOSAVE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw);
    restoreSessionState(snapshot, KNOWN_SESSION_IDS);
    return snapshot;
  } catch {
    return null;
  }
}

function persistAutosave() {
  if (!state.autosaveReady || state.autosaveAvailable) return;
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(createSessionSnapshot(state)));
  } catch {
    setSessionStatus("Autosave is unavailable in this browser. Export a replay for a portable copy.", true);
  }
}

function resumeAutosave() {
  if (!state.autosaveAvailable) return;
  const snapshot = state.autosaveAvailable;
  state.autosaveAvailable = null;
  restoreSnapshot(snapshot, `Autosave resumed from ${new Date(snapshot.savedAt).toLocaleString()}. Timers remain paused until the next timed action.`);
}

function discardAutosave(announce = true) {
  const storage = getLocalStorage();
  if (storage) storage.removeItem(AUTOSAVE_STORAGE_KEY);
  state.autosaveAvailable = null;
  if (announce) {
    setSessionStatus("Prior autosave discarded. The current session will now autosave locally.");
    renderAutosaveControls();
    persistAutosave();
  }
}

function renderAutosaveControls() {
  const available = Boolean(state.autosaveAvailable);
  els["resume-autosave-button"].hidden = !available;
  els["discard-autosave-button"].hidden = !available;
}

function loadPlaytestStats() {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const saved = JSON.parse(storage.getItem(PLAYTEST_STORAGE_KEY) || "null");
    state.playtestStats = sanitizePlaytestStats(saved);
    if (saved) persistPlaytestStats();
  } catch {
    state.playtestStats = createEmptyPlaytestStats();
  }
}

function persistPlaytestStats() {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(state.playtestStats));
  } catch {
    setSessionStatus("Local playtest stats could not be saved in this browser.", true);
  }
}

function saveSession() {
  const storage = getLocalStorage();
  if (!storage) {
    setSessionStatus("Local browser storage is unavailable. Export a replay file instead.", true);
    return;
  }
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(createSessionSnapshot(state)));
    setSessionStatus(`Session saved locally at round ${state.round}, ${state.phase} phase.`);
  } catch (error) {
    setSessionStatus(`Session could not be saved: ${error.message}`, true);
  }
}

function loadSession() {
  const storage = getLocalStorage();
  const raw = storage?.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    setSessionStatus("No local saved session was found.", true);
    return;
  }
  try {
    restoreSnapshot(JSON.parse(raw), "Local session restored. Timers remain paused until the next timed action.");
  } catch (error) {
    setSessionStatus(`Saved session could not be loaded: ${error.message}`, true);
  }
}

function restoreSnapshot(snapshot, message) {
  stopTimer();
  const restored = restoreSessionState(snapshot, KNOWN_SESSION_IDS);
  if (restored.currentRoundMetrics) {
    const savedAt = Date.parse(snapshot.savedAt);
    const elapsedAtSave = Number.isFinite(savedAt)
      ? Math.max(0, savedAt - restored.currentRoundMetrics.startedAt)
      : 0;
    restored.currentRoundMetrics.startedAt = Date.now() - elapsedAtSave;
  }
  Object.assign(state, restored);
  state.autosaveAvailable = null;
  state.autosaveReady = true;
  syncScenarioControls();
  renderSettings();
  setSessionStatus(message);
  render();
}

function exportReplay() {
  try {
    const pack = activeScenarioPack();
    const envelope = createReplayEnvelope(state, pack);
    const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSeed = state.seed.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "seed";
    link.href = href;
    link.download = `civpro-replay-${state.scenarioPackId || "custom"}-${safeSeed}-round-${state.round}.json`;
    link.click();
    URL.revokeObjectURL(href);
    setSessionStatus("Replay file exported with the seed, exact state, docket events, and round assessments.");
  } catch (error) {
    setSessionStatus(`Replay export failed: ${error.message}`, true);
  }
}

async function importReplay() {
  const file = els["import-replay-input"].files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Replay exceeds the 2 MB import limit.");
    const envelope = parseReplayEnvelope(await file.text(), KNOWN_SESSION_IDS);
    restoreSnapshot(envelope.snapshot, `Replay imported for seed ${envelope.reproducibility.seed}.`);
  } catch (error) {
    setSessionStatus(`Replay import failed: ${error.message}`, true);
  } finally {
    els["import-replay-input"].value = "";
  }
}

function clearPlaytestStats() {
  state.playtestStats = createEmptyPlaytestStats();
  const storage = getLocalStorage();
  if (storage) storage.removeItem(PLAYTEST_STORAGE_KEY);
  setSessionStatus("Local-only playtest statistics cleared.");
  renderPlaytestStats();
}

function clearLocalGameData() {
  if (!window.confirm("Clear this game's saved sessions, written reflections, and balance history from this browser? Downloaded replay files must be removed separately.")) return;
  const storage = getLocalStorage();
  try {
    for (const key of [SESSION_STORAGE_KEY, AUTOSAVE_STORAGE_KEY, PLAYTEST_STORAGE_KEY]) storage?.removeItem(key);
  } catch {
    setSessionStatus("Browser storage could not be cleared. Use this browser's site-data controls.", true);
    return;
  }
  state.autosaveAvailable = null;
  state.autosaveReady = false;
  state.playtestStats = createEmptyPlaytestStats();
  newGame();
  state.autosaveReady = true;
  setSessionStatus("Saved sessions, writing, and balance history cleared here. Remove any downloaded replays separately.");
}

function setSessionStatus(message, isError = false) {
  state.sessionStatus = message;
  state.sessionStatusError = isError;
  if (!els["session-status"]) return;
  els["session-status"].textContent = message;
  els["session-status"].classList.toggle("error", isError);
}

function render() {
  renderScores();
  renderTimer();
  renderPhases();
  renderResources();
  renderTutorial();
  renderScenarioSummary();
  renderSources();
  renderClaimHand();
  renderActiveCase();
  renderLearningCycle();
  renderAttackHand();
  renderMotionHand();
  renderDiscovery();
  renderJudge();
  renderAssessment();
  renderPlaytestStats();
  renderAutosaveControls();
  setSessionStatus(state.sessionStatus, state.sessionStatusError);
  persistAutosave();
}

function renderScores() {
  els["player-one-label"].textContent = state.players[0].name;
  els["player-one-score"].textContent = state.players[0].score;
  els["player-two-label"].textContent = state.players[1].name;
  els["player-two-score"].textContent = state.players[1].score;
  els["round-value"].textContent = state.round;
  els["roles-value"].textContent = `${state.players[state.plaintiff].name} plaintiff; ${state.players[state.defense].name} defense.`;
}

function renderTimer() {
  const card = els["timer-card"];
  card.classList.toggle("idle", !state.deadline);
  card.classList.toggle("warning", Number.isFinite(state.secondsLeft) && state.secondsLeft <= 5);
  els["timer-label"].textContent = state.deadline?.label || (state.settings.noTimer || state.settings.studyMode ? "Timer off" : "No deadline");
  els["timer-value"].textContent = Number.isFinite(state.secondsLeft) ? `${state.secondsLeft}s` : "--";
}

function renderPhases() {
  els["phase-list"].innerHTML = PHASES.map(([id, label], index) => `
    <li class="phase-step ${state.phase === id ? "active" : ""}"${state.phase === id ? " aria-current=\"step\"" : ""}>
      <span>${index + 1}</span>
      <strong>${escapeHtml(label)}</strong>
    </li>
  `).join("");
}

function renderResources() {
  els["resource-panel"].innerHTML = `
    <div class="resource-card"><span>Plaintiff budget</span><strong>${state.resources.plaintiff}</strong></div>
    <div class="resource-card"><span>Defense budget</span><strong>${state.resources.defense}</strong></div>
    <div class="resource-card"><span>Discards</span><strong>${state.discards.attacks.length + state.discards.motions.length}</strong></div>
  `;
}

function renderTutorial() {
  if (!state.tutorial.enabled) {
    els["tutorial-panel"].innerHTML = "";
    return;
  }
  const step = TUTORIAL_STEPS[state.tutorial.step];
  els["tutorial-panel"].innerHTML = `
    <span class="section-label">Tutorial</span>
    <h2>${escapeHtml(step.title)}</h2>
    <p>${escapeHtml(step.body)}</p>
    <p class="tutorial-count">Step ${state.tutorial.step + 1} of ${TUTORIAL_STEPS.length}</p>
  `;
}

function renderSettings() {
  els["study-mode"].checked = state.settings.studyMode;
  const modes = [
    ["noTimer", "No timer"],
    ["examMode", "Exam mode"],
    ["showExplanations", "Show explanations"]
  ];
  els["mode-toggles"].innerHTML = modes.map(([id, label]) => `
    <label class="toggle small">
      <input type="checkbox" data-mode="${escapeHtml(id)}" ${state.settings[id] ? "checked" : ""}>
      <span>${escapeHtml(label)}</span>
    </label>
  `).join("");
  els["topic-toggles"].innerHTML = TOPIC_MODULES.map((topic) => `
    <label class="toggle small">
      <input type="checkbox" data-topic="${safeId(topic.id)}" ${state.settings.activeTopics.has(topic.id) ? "checked" : ""}>
      <span>${escapeHtml(topic.label)}${topic.preview ? " (preview)" : ""}</span>
    </label>
  `).join("");
  els["mode-toggles"].querySelectorAll("[data-mode]").forEach((input) => {
    input.addEventListener("change", () => {
      state.settings[input.dataset.mode] = input.checked;
      if (input.dataset.mode === "noTimer") {
        if (input.checked) stopTimer();
        else resumePhaseTimer();
      }
      render();
    });
  });
  els["topic-toggles"].querySelectorAll("[data-topic]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.settings.activeTopics.add(input.dataset.topic);
      else state.settings.activeTopics.delete(input.dataset.topic);
      if (!state.settings.activeTopics.size) state.settings.activeTopics.add("jurisdiction");
      state.scenarioPackId = null;
      state.tutorial.enabled = false;
      syncScenarioControls();
      renderSettings();
      newGame();
    });
  });
}

function renderSources() {
  const activeSources = normalizeAuthorityIds(state.judge.authorityIds)
    .map((id) => AUTHORITY_BY_ID.get(id))
    .filter(Boolean);
  if (!activeSources.length) {
    els["source-list"].innerHTML = "<li>No governing authority is active for this bench note.</li>";
    return;
  }
  els["source-list"].innerHTML = activeSources.map((source) => `
    <li>
      <span class="authority-type">${escapeHtml(authorityTypeLabel(source.authorityType))}</span>
      <a href="${safeExternalHref(source.officialHref || source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>
      <strong>${escapeHtml(source.pinpoint)}</strong>
      <p>${escapeHtml(source.proposition)}</p>
      ${source.officialHref && source.href !== source.officialHref
        ? `<a class="readable-source" href="${safeExternalHref(source.href)}" target="_blank" rel="noreferrer">Readable reference</a>`
        : ""}
    </li>
  `).join("");
}

function renderLearningCycle() {
  const cycle = state.learningCycle.current;
  const previousKey = els["learning-cycle-output"].dataset.cycleKey;
  const cycleKey = cycle ? `${cycle.id}:${cycle.stage}` : "empty";
  const focusWasInside = els["learning-cycle-output"].contains?.(document.activeElement);
  els["learning-cycle-output"].dataset.cycleKey = cycleKey;
  if (!cycle) {
    els["learning-cycle-output"].innerHTML = `
      <span class="section-label">Learning cycle</span>
      <h2>Commit before the ruling</h2>
      <p>When an attack is played, predict the result, choose a procedural response, revise after the ruling, and test one altered fact.</p>
    `;
    return;
  }

  if (cycle.stage === "predict") {
    els["learning-cycle-output"].innerHTML = `
      <span class="status-pill">Step 1 of 4: committed answer</span>
      <h2>${escapeHtml(cycle.attackTitle)}</h2>
      <p><strong>Fact pattern:</strong> ${escapeHtml(cycle.factPattern)}</p>
      <p><strong>Issue:</strong> ${escapeHtml(cycle.issuePrompt)}</p>
      <form data-learning-form="prediction" class="reflection-form">
        <fieldset>
          <legend>Predict the ruling before choosing a response</legend>
          <label><input type="radio" name="prediction" value="attack-succeeds" required> Attack succeeds</label>
          <label><input type="radio" name="prediction" value="attack-fails" required> Attack fails</label>
        </fieldset>
        <label for="initial-reasoning">Why? Identify the controlling fact and rule.</label>
        <textarea id="initial-reasoning" name="reasoning" rows="3" minlength="10" maxlength="1200" required></textarea>
        <p>Use at least 10 characters. Use only the fictional case facts; do not enter personal information.</p>
        <button class="button blue" type="submit">Commit prediction</button>
      </form>
    `;
  } else if (cycle.stage === "response") {
    const responsiveCards = cycle.mechanicalCheck.responsiveCardIds.map((id) => CARD_LABELS[id] || id);
    els["learning-cycle-output"].innerHTML = `
      <span class="status-pill">Step 2 of 4: mechanical check</span>
      <h2>Prediction locked: ${escapeHtml(predictionLabel(cycle.initial.prediction))}</h2>
      <p>${escapeHtml(cycle.initial.reasoning)}</p>
      <p><strong>Check:</strong> ${escapeHtml(cycle.mechanicalCheck.message)}</p>
      ${responsiveCards.length ? `<p><strong>Responsive cards in hand:</strong> ${responsiveCards.map(escapeHtml).join("; ")}</p>` : ""}
      <button class="button secondary" type="button" data-action="stand-on-prediction">Use no response</button>
    `;
  } else if (cycle.stage === "revise") {
    els["learning-cycle-output"].innerHTML = `
      <span class="status-pill">Steps 3 and 4: revise and transfer</span>
      <h2>${escapeHtml(cycle.ruling.label)}</h2>
      <p>${escapeHtml(cycle.ruling.body)}</p>
      <p><strong>Your initial answer:</strong> ${escapeHtml(predictionLabel(cycle.initial.prediction))}. ${escapeHtml(cycle.initial.reasoning)}</p>
      <p><strong>Comparison:</strong> ${cycle.predictionCorrect ? "Your prediction matched the ruling." : "Your prediction did not match the ruling."}</p>
      <form data-learning-form="revision" class="reflection-form">
        <label for="revision-reasoning">Revise your analysis after seeing the ruling.</label>
        <textarea id="revision-reasoning" name="revision" rows="3" minlength="10" maxlength="1200" required></textarea>
        <fieldset>
          <legend>${escapeHtml(cycle.alteredFactPrompt)}</legend>
          <label><input type="radio" name="alteredPrediction" value="attack-succeeds" required> Attack succeeds</label>
          <label><input type="radio" name="alteredPrediction" value="attack-fails" required> Attack fails</label>
        </fieldset>
        <label for="altered-reasoning">Explain which changed fact controls.</label>
        <textarea id="altered-reasoning" name="alteredReasoning" rows="3" minlength="10" maxlength="1200" required></textarea>
        <p>Use at least 10 characters in each explanation. Use only fictional case facts.</p>
        <button class="button green" type="submit">Save revision and continue</button>
      </form>
    `;
  } else {
    els["learning-cycle-output"].innerHTML = `
      <span class="status-pill">Cycle complete</span>
      <h2>${escapeHtml(cycle.attackTitle)} debrief saved</h2>
      <p><strong>Initial:</strong> ${escapeHtml(predictionLabel(cycle.initial.prediction))}. ${escapeHtml(cycle.initial.reasoning)}</p>
      <p><strong>Ruling:</strong> ${escapeHtml(cycle.ruling.label)}. ${escapeHtml(cycle.ruling.body)}</p>
      <p><strong>Revision:</strong> ${escapeHtml(cycle.revision)}</p>
      <p><strong>Altered fact:</strong> ${escapeHtml(predictionLabel(cycle.alteredPrediction.prediction))}. ${escapeHtml(cycle.alteredPrediction.reasoning)}</p>
    `;
  }

  const form = els["learning-cycle-output"].querySelector("form");
  if (form) {
    for (const input of form.querySelectorAll("textarea, input")) {
      const saved = cycle.draft?.[cycle.stage]?.[input.name];
      if (input.type === "radio") input.checked = input.value === saved;
      else input.value = saved || "";
    }
    form.addEventListener("input", () => {
      cycle.draft ||= {};
      cycle.draft[cycle.stage] = Object.fromEntries(new FormData(form));
      persistAutosave();
    });
  }
  if (previousKey !== cycleKey || focusWasInside) {
    const target = els["learning-cycle-output"].querySelector("h2");
    if (target) { target.tabIndex = -1; target.focus(); }
  }
  els["learning-cycle-output"].querySelector("[data-learning-form='prediction']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitInitialPrediction(event.currentTarget);
  });
  els["learning-cycle-output"].querySelector("[data-learning-form='revision']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitLearningRevision(event.currentTarget);
  });
  els["learning-cycle-output"].querySelector("[data-action='stand-on-prediction']")?.addEventListener("click", standOnPrediction);
}

function showLearningError(message) {
  const form = els["learning-cycle-output"].querySelector("form");
  if (!form) return;
  let error = form.querySelector("[role='alert']");
  if (!error) {
    error = document.createElement("p");
    error.setAttribute("role", "alert");
    form.prepend(error);
  }
  error.textContent = message;
}

function authorityTypeLabel(type) {
  const labels = {
    "primary-rule": "Primary rule",
    "primary-statute": "Primary statute",
    "primary-case": "Primary case"
  };
  return labels[type] || "Authority";
}

function renderClaimHand() {
  els["claim-hand"].innerHTML = state.hands.claims.map((claim) => `
    <button class="playing-card ${state.activeCase?.id === claim.id ? "selected" : ""}" ${state.phase !== "claim" ? "disabled" : ""} data-action="file-claim" data-id="${escapeHtml(claim.instanceId)}">
      <span class="card-type">Claim</span>
      <h3>${escapeHtml(claim.title)}</h3>
      <p>${escapeHtml(claim.summary)}</p>
      <div class="card-meta">
        <span class="tag">${escapeHtml(claim.plaintiff.state)} plaintiff</span>
        <span class="tag">${escapeHtml(claim.forumState)} ${escapeHtml(claim.court)}</span>
        <span class="tag">${escapeHtml(formatMoney(claim.amount))}</span>
      </div>
    </button>
  `).join("");
  els["claim-hand"].querySelectorAll("[data-action='file-claim']").forEach((button) => {
    button.addEventListener("click", () => fileClaim(button.dataset.id));
  });
}

function renderActiveCase() {
  if (!state.activeCase) {
    els["active-case"].innerHTML = `
      <div class="empty-state">
        <div><strong>No active claim</strong><p>Pick a case card to begin a round.</p></div>
      </div>
    `;
    return;
  }

  const c = state.activeCase;
  const d = state.selectedDefendant;
  const status = d ? statusFacts(c, d) : null;
  const pack = activeScenarioPack();
  const finalPlannedRound = Boolean(pack && state.round >= pack.rounds);
  const nextRoundLabel = state.sessionComplete ? "Session complete" : finalPlannedRound ? "Finish session" : "Next round";
  els["active-case"].innerHTML = `
    <div class="case-facts">
      <span class="section-label">Active claim</span>
      <h2>${escapeHtml(c.title)}</h2>
      <p>${escapeHtml(c.summary)}</p>
      <dl>
        <div><dt>Plaintiff</dt><dd>${escapeHtml(c.plaintiff.name)} (${escapeHtml(c.plaintiff.state)})</dd></div>
        <div><dt>Forum</dt><dd>${escapeHtml(c.currentForum || c.forumState)} ${escapeHtml(c.currentCourt || c.court)}</dd></div>
        <div><dt>Amount</dt><dd>${escapeHtml(formatMoney(c.amount))}</dd></div>
        <div><dt>Claim</dt><dd>${escapeHtml(c.type)}</dd></div>
      </dl>
      <p>${escapeHtml(c.venueFacts)}</p>
      ${c.supplementalClaim ? `<p><strong>Supplemental claim:</strong> ${escapeHtml(c.supplementalClaim.title)}</p>` : ""}
      <div class="defendant-options">
        ${c.defendants.map((option) => `
          <button class="option-button ${d?.id === option.id ? "selected" : ""}" ${state.phase !== "defendant" ? "disabled" : ""} data-action="choose-defendant" data-id="${escapeHtml(option.id)}">
            <strong>${escapeHtml(option.name)}</strong>
            <span>${escapeHtml(option.state)}${option.ppb && option.ppb !== option.state ? ` / PPB ${escapeHtml(option.ppb)}` : ""}. ${escapeHtml(option.role)}</span>
          </button>
        `).join("")}
      </div>
      <div class="case-actions">
        <button class="button blue" data-action="pass-attacks" ${state.phase !== "attack" || isLearningActionBlocked() ? "disabled" : ""}>Pass to discovery</button>
        <button class="button red" data-action="close-discovery" ${state.phase !== "discovery" || isLearningActionBlocked() ? "disabled" : ""}>Close discovery</button>
        <button class="button green" data-action="next-round" ${state.phase !== "trial" || state.sessionComplete || isLearningActionBlocked() ? "disabled" : ""}>${nextRoundLabel}</button>
      </div>
    </div>
    <div class="case-docket">
      <span class="section-label">Docket</span>
      ${status ? `
        <div class="status-grid">
          <div><span>Diversity</span><strong>${escapeHtml(status.diversity)}</strong></div>
          <div><span>Federal SMJ</span><strong>${escapeHtml(status.smj)}</strong></div>
          <div><span>PJ contacts</span><strong>${escapeHtml(status.pj)}</strong></div>
          <div><span>Service</span><strong>${escapeHtml(status.service)}</strong></div>
          <div><span>Removal</span><strong>${escapeHtml(status.removal)}</strong></div>
          <div><span>Supp. Jx</span><strong>${escapeHtml(status.supplemental)}</strong></div>
        </div>
      ` : ""}
      <ul class="docket-list" tabindex="0" aria-label="Case docket">${state.docket.map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong>${escapeHtml(entry.detail)}</li>`).join("")}</ul>
    </div>
  `;
  els["active-case"].querySelectorAll("[data-action='choose-defendant']").forEach((button) => button.addEventListener("click", () => chooseDefendant(button.dataset.id)));
  els["active-case"].querySelector("[data-action='pass-attacks']")?.addEventListener("click", passAttacks);
  els["active-case"].querySelector("[data-action='close-discovery']")?.addEventListener("click", closeDiscovery);
  els["active-case"].querySelector("[data-action='next-round']")?.addEventListener("click", nextRound);
}

function renderAttackHand() {
  renderExchangeControls("attacks", "attack");
  els["draw-attack-button"].disabled = state.hands.attacks.length >= HAND_LIMITS.attacks || isLearningActionBlocked();
  els["attack-hand"].innerHTML = state.hands.attacks.map((card) => {
    const disabled = !canPlayAttack(card) || !canAfford("defense", card.cost);
    return `
      <button class="playing-card" ${disabled ? "disabled" : ""} data-action="attack" data-id="${escapeHtml(card.instanceId)}">
        <span class="card-type attack">${escapeHtml(card.title)}</span>
        <h3>${escapeHtml(card.subtitle)}</h3>
        <p>${escapeHtml(card.text)}</p>
        <div class="card-meta"><span class="tag">${card.timing === "summary" ? "After discovery" : "Threshold"}</span><span class="tag">${card.cost} budget</span></div>
      </button>
    `;
  }).join("");
  els["attack-hand"].querySelectorAll("[data-action='attack']").forEach((button) => button.addEventListener("click", () => playAttack(button.dataset.id)));
}

function renderMotionHand() {
  renderExchangeControls("motions", "motion");
  els["draw-motion-button"].disabled = state.hands.motions.length >= HAND_LIMITS.motions;
  els["motion-hand"].innerHTML = state.hands.motions.map((card) => {
    const isMotion = card.kind === "motion";
    const isDiscoveryAnswer = card.kind === "discovery";
    const disabled = isMotion
      ? state.phase !== "response" || state.learningCycle.current?.stage !== "response" || !canAfford("plaintiff", card.cost)
      : isDiscoveryAnswer
        ? !hasPendingDiscoveryResistance() || !canAfford("plaintiff", card.cost)
        : state.phase !== "discovery" || !canAfford("plaintiff", card.cost);
    return `
      <button class="playing-card" ${disabled ? "disabled" : ""} data-action="${isMotion ? "motion" : isDiscoveryAnswer ? "discovery-response" : "tool"}" data-id="${escapeHtml(card.instanceId)}">
        <span class="card-type ${isMotion ? "motion" : "discovery"}">${isMotion ? "Motion" : "Discovery"}</span>
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>
        <div class="card-meta"><span class="tag">${card.cost} budget</span></div>
      </button>
    `;
  }).join("");
  els["motion-hand"].querySelectorAll("[data-action='motion']").forEach((button) => button.addEventListener("click", () => respondWithMotion(button.dataset.id)));
  els["motion-hand"].querySelectorAll("[data-action='discovery-response']").forEach((button) => button.addEventListener("click", () => answerDiscoveryResistance(button.dataset.id)));
}

function renderExchangeControls(type, label) {
  const select = els[`exchange-${label}-card`];
  const selected = select.value;
  select.innerHTML = state.hands[type].map((card) => `<option value="${escapeHtml(card.instanceId)}">${escapeHtml(CARD_LABELS[card.id])}</option>`).join("");
  if (state.hands[type].some((card) => card.instanceId === selected)) select.value = selected;
  const disabled = !exchangeAllowed(type) || !state.hands[type].length || (!state.decks[type].length && !state.discards[type].length);
  select.disabled = disabled;
  els[`exchange-${label}-button`].disabled = disabled;
}

function renderDiscovery() {
  if (!state.activeCase || !state.selectedDefendant) {
    els["discovery-list"].innerHTML = `<div class="empty-state"><div><strong>No checklist yet</strong><p>File a claim and choose a defendant first.</p></div></div>`;
    return;
  }
  const tools = state.hands.motions.filter((card) => card.kind === "discovery-tool");
  els["discovery-list"].innerHTML = state.activeCase.evidence.map((item) => {
    const complete = item.complete;
    const pending = item.pendingResistance;
    return `
      <article class="evidence-item ${complete ? "complete" : ""}">
        <span class="card-type discovery">${complete ? "Collected" : pending ? "Objected" : "Needed"}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="card-meta"><span class="tag">${escapeHtml(toolName(item.tool))}</span>${item.resistance ? `<span class="tag">${escapeHtml(resistanceLabel(item.resistance))}</span>` : ""}</div>
        <div class="case-actions">
          ${tools.map((tool) => `
            <button class="button secondary" data-action="request-evidence" data-evidence="${escapeHtml(item.id)}" data-tool="${escapeHtml(tool.instanceId)}" ${state.phase !== "discovery" || isLearningActionBlocked() || complete || pending || !canAfford("plaintiff", tool.cost) ? "disabled" : ""}>${escapeHtml(tool.title)}</button>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  els["discovery-list"].querySelectorAll("[data-action='request-evidence']").forEach((button) => {
    button.addEventListener("click", () => requestEvidence(button.dataset.evidence, button.dataset.tool));
  });
}

function renderJudge() {
  const tone = state.judge.tone || "neutral";
  const hidden = state.settings.examMode && !state.judge.revealed;
  els["judge-output"].innerHTML = `
    <span class="ruling ${tone}">${tone === "good" ? "Granted" : tone === "bad" ? "Problem" : "Bench note"}</span>
    <h3>${escapeHtml(state.judge.title)}</h3>
    ${hidden ? `<p>Analysis hidden for exam mode.</p><button class="button secondary" data-action="reveal-ruling">Reveal analysis</button>` : `
      <p>${state.settings.showExplanations ? escapeHtml(state.judge.body) : "Ruling recorded. Enable explanations to show the full rule note."}</p>
      ${state.settings.showExplanations && state.judge.proposition ? `<p><strong>Supported proposition:</strong> ${escapeHtml(state.judge.proposition)}</p>` : ""}
    `}
  `;
  els["judge-output"].querySelector("[data-action='reveal-ruling']")?.addEventListener("click", () => {
    state.judge.revealed = true;
    renderJudge();
  });
}

function renderAssessment() {
  const assessment = state.lastAssessment;
  if (!assessment) {
    els["assessment-output"].innerHTML = `
      <p>Complete a round to generate doctrines triggered, wrong motions, outcome, missing proof, and governing authority IDs.</p>
    `;
    return;
  }
  const durationMinutes = assessment.durationMs / 60000;
  const outcomeClass = assessment.outcome.type === "trial-ready" ? "good" : "bad";
  els["assessment-output"].innerHTML = `
    <span class="ruling ${outcomeClass}">${escapeHtml(assessment.outcome.label)}</span>
    <h3>${escapeHtml(assessment.caseTitle)}</h3>
    <p>${escapeHtml(assessment.outcome.reason)} Round length: ${durationMinutes < 0.1 ? "under 0.1" : durationMinutes.toFixed(1)} minutes.</p>
    <dl class="assessment-metrics">
      <div><dt>Attacks</dt><dd>${assessment.attacksSucceeded}/${assessment.attacksPlayed} succeeded</dd></div>
      <div><dt>Budget failures</dt><dd>P ${assessment.budgetFailures.plaintiff} / D ${assessment.budgetFailures.defense}</dd></div>
    </dl>
    <h4>Doctrines triggered</h4>
    ${renderCompactList(assessment.doctrinesTriggered, "No doctrine card was resolved.")}
    <h4>Wrong motions or tools</h4>
    ${assessment.wrongMotions.length
      ? `<ul>${assessment.wrongMotions.map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.reason)}</li>`).join("")}</ul>`
      : `<p>None recorded.</p>`}
    <h4>Missing proof at outcome</h4>
    ${renderCompactList(assessment.missingProofItems.map((item) => item.title), "Every listed proof item was collected.")}
    <h4>Missed doctrines</h4>
    ${renderCompactList(assessment.missedDoctrines || [], "Every committed prediction matched its ruling.")}
    <h4>Review next</h4>
    ${renderCompactList(assessment.reviewTopics || [], "No additional review topic was flagged.")}
    <h4>Governing authorities</h4>
    ${renderAssessmentAuthorities(assessment.sourceHooks)}
    <h4>Prediction and revision trail</h4>
    ${renderLearningDebrief(assessment.learningCycles || [])}
  `;
}

function renderAssessmentAuthorities(authorityIds) {
  const sources = normalizeAuthorityIds(authorityIds)
    .map((id) => AUTHORITY_BY_ID.get(id))
    .filter(Boolean);
  return sources.length
    ? `<ul>${sources.map((source) => `<li><a href="${safeExternalHref(source.officialHref || source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>, ${escapeHtml(source.pinpoint)}</li>`).join("")}</ul>`
    : "<p>No governing authority was recorded.</p>";
}

function renderLearningDebrief(cycles) {
  if (!cycles.length) return "<p>No contested ruling completed the full learning cycle.</p>";
  return cycles.map((cycle) => `
    <details class="learning-debrief">
      <summary>${escapeHtml(cycle.attackTitle)}: ${cycle.predictionCorrect ? "prediction matched" : "prediction revised"}</summary>
      <p><strong>Initial:</strong> ${escapeHtml(predictionLabel(cycle.initial?.prediction))}. ${escapeHtml(cycle.initial?.reasoning)}</p>
      <p><strong>Ruling:</strong> ${escapeHtml(cycle.ruling?.label)}. ${escapeHtml(cycle.ruling?.body)}</p>
      <p><strong>Revision:</strong> ${escapeHtml(cycle.revision)}</p>
      <p><strong>Altered fact:</strong> ${escapeHtml(cycle.alteredFactPrompt)} ${escapeHtml(predictionLabel(cycle.alteredPrediction?.prediction))}. ${escapeHtml(cycle.alteredPrediction?.reasoning)}</p>
    </details>
  `).join("");
}

function renderPlaytestStats() {
  const summary = aggregatePlaytestStats(state.playtestStats, CARD_LABELS);
  if (!summary.roundCount) {
    els["stats-output"].innerHTML = `
      <p>No completed rounds are stored yet. Stats stay in this browser and are not included in the public site or source pipeline.</p>
    `;
    return;
  }
  const neverCases = summary.neverTrialReady.slice(0, 4).map((item) => `${item.title} (${item.rounds})`);
  const deadCards = summary.deadCards.slice(0, 4).map((item) => `${item.title} (${item.drawn} draws)`);
  els["stats-output"].innerHTML = `
    <dl class="stats-grid">
      <div><dt>Rounds</dt><dd>${summary.roundCount}</dd></div>
      <div><dt>Avg. length</dt><dd>${summary.averageRoundMinutes.toFixed(1)} min</dd></div>
      <div><dt>Attack success</dt><dd>${Math.round(summary.attackSuccessRate * 100)}%</dd></div>
      <div><dt>Budget misses</dt><dd>P ${summary.budgetFailures.plaintiff} / D ${summary.budgetFailures.defense}</dd></div>
      <div><dt>Card exchanges</dt><dd>D ${summary.cardExchanges.attacks} / P ${summary.cardExchanges.motions}</dd></div>
    </dl>
    <p>These counts combine stored rounds. Clear stats before a comparable pilot run. A disabled unaffordable card cannot record a budget attempt; note those situations separately.</p>
    <h4>Cases never trial ready</h4>
    ${renderCompactList(neverCases, "Every played case has reached trial at least once.")}
    <h4>Drawn but never played</h4>
    ${renderCompactList(deadCards, "No dead-card signal yet.")}
  `;
}

function renderCompactList(items, emptyText) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(emptyText)}</p>`;
}

function hasPendingDiscoveryResistance() {
  return Boolean(state.activeCase?.evidence.some((item) => item.pendingResistance));
}

function printCards() {
  const pack = activeScenarioPack();
  const cases = pack ? selectByIds(CASES, pack.caseIds) : activeByTopic(CASES, state.settings.activeTopics);
  const attacks = pack ? selectByIds(ATTACK_CARDS, pack.attackCardIds) : activeByTopic(ATTACK_CARDS, state.settings.activeTopics);
  const motions = pack ? selectByIds(MOTION_CARDS, pack.motionCardIds) : activeByTopic(MOTION_CARDS, state.settings.activeTopics);
  els["print-deck"].innerHTML = `
    <h1>Civ Pro: Trial Ready Printable Deck</h1>
    <div class="print-lesson-header">
      <p><strong>Pack:</strong> ${escapeHtml(pack?.title || "Custom topic deck")}</p>
      <p><strong>Replay seed:</strong> ${escapeHtml(state.seed)}</p>
      ${pack ? `<p><strong>Schedule:</strong> ${pack.schedule.briefing} min brief / ${pack.schedule.play} min play / ${pack.schedule.debrief} min debrief</p>
      <p><strong>Objectives:</strong> ${pack.learningObjectives.map(escapeHtml).join("; ")}</p>` : ""}
    </div>
    <h2>Case Cards</h2>
    <div class="print-grid">${cases.map(printCaseCard).join("")}</div>
    <h2>Attack Cards</h2>
    <div class="print-grid">${attacks.map((card) => printRuleCard(card, "Attack")).join("")}</div>
    <h2>Motion and Discovery Cards</h2>
    <div class="print-grid">${motions.map((card) => printRuleCard(card, card.kind === "discovery-tool" ? "Discovery Tool" : card.kind === "discovery" ? "Discovery Motion" : "Motion")).join("")}</div>
  `;
  window.print();
}

function selectByIds(items, ids) {
  return ids.map((id) => items.find((item) => item.id === id)).filter(Boolean);
}

function printCaseCard(card) {
  return `
    <article class="print-card">
      <span>Claim</span>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.summary)}</p>
      <p><strong>Forum:</strong> ${escapeHtml(card.forumState)} ${escapeHtml(card.court)}</p>
      <p><strong>Amount:</strong> ${escapeHtml(formatMoney(card.amount))}</p>
      <p><strong>Proof:</strong> ${card.evidence.map((item) => escapeHtml(item.title)).join("; ")}</p>
    </article>
  `;
}

function printRuleCard(card, type) {
  return `
    <article class="print-card">
      <span>${escapeHtml(type)}</span>
      <h3>${escapeHtml(card.title)}</h3>
      <h4>${escapeHtml(card.subtitle || card.kind)}</h4>
      <p>${escapeHtml(card.text)}</p>
      <p><strong>Cost:</strong> ${card.cost || 0}</p>
    </article>
  `;
}

function shuffle(items) {
  return seededShuffle(items, state);
}

document.addEventListener("DOMContentLoaded", init);
