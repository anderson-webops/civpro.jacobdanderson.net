import {
  ATTACK_CARDS,
  CASES,
  MOTION_CARDS,
  PHASES,
  SOURCES,
  TOPIC_MODULES,
  TUTORIAL_STEPS
} from "./data.js";
import { runRuleTests } from "./rule-tests.js";
import { DEFAULT_SCENARIO_PACK_ID, SCENARIO_PACKS } from "./scenario-packs.generated.js";
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
  normalizeSeed,
  parseReplayEnvelope,
  restoreSessionState,
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
const SESSION_STORAGE_KEY = "civpro.v0.3.saved-session";
const PLAYTEST_STORAGE_KEY = "civpro.v0.3.playtest-stats";
const KNOWN_SESSION_IDS = {
  scenarioPackIds: new Set(SCENARIO_PACKS.map((item) => item.id)),
  caseIds: new Set(CASES.map((item) => item.id)),
  attackCardIds: new Set(ATTACK_CARDS.map((item) => item.id)),
  motionCardIds: new Set(MOTION_CARDS.map((item) => item.id))
};
const CARD_LABELS = Object.fromEntries(
  [...ATTACK_CARDS, ...MOTION_CARDS].map((card) => [card.id, card.subtitle ? `${card.title}: ${card.subtitle}` : card.title])
);
const DISCOVERY_SOURCE_HOOKS = {
  deposition: "FRCP 30",
  rfp: "FRCP 34",
  admission: "FRCP 36",
  expert: "FRCP 26(a)(2)"
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
  playtestStats: createEmptyPlaytestStats(),
  sessionStatus: "Local save and replay controls are ready.",
  sessionStatusError: false,
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
    cite: "This prototype abstracts the 1L pretrial sequence into competitive card play.",
    revealed: true
  }
};

const els = {};

function init() {
  bindElements();
  setupScenarioControls();
  bindEvents();
  loadPlaytestStats();
  renderSettings();
  newGame();
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
    "test-button",
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
    "attack-hand",
    "motion-hand",
    "discovery-list",
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
    newGame();
  });
  els["tutorial-button"].addEventListener("click", startTutorial);
  els["print-button"].addEventListener("click", printCards);
  els["test-button"].addEventListener("click", showRuleTests);
  els["draw-attack-button"].addEventListener("click", () => drawToHand("attacks", 1, HAND_LIMITS.attacks));
  els["draw-motion-button"].addEventListener("click", () => drawToHand("motions", 1, HAND_LIMITS.motions));
  els["study-mode"].addEventListener("change", () => {
    state.settings.studyMode = els["study-mode"].checked;
    if (state.settings.studyMode) {
      stopTimer();
      setJudge("neutral", "Study mode enabled", "Timers are paused. Talk through the rule before choosing a card.", "Classroom review mode.");
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
  state.activeCase.blockedRemoval = Boolean(defendant.forumDefendant);
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
  trackDoctrine(attack.subtitle, evaluation.source);
  state.pendingAttack = { attack, evaluation };
  state.phase = "response";
  recordDocket(`${attack.title} played`, attack.subtitle, {
    type: "attack-played",
    cardId: attack.id,
    doctrine: attack.subtitle,
    source: evaluation.source
  });
  setJudge("neutral", `${attack.subtitle} pending`, evaluation.prompt, evaluation.source);
  startTimer("Motion response due", activeScenarioPack()?.timers.responseSeconds || 20, () => resolveAttack(null));
  render();
}

function canPlayAttack(attack) {
  if (attack.timing === "summary") return state.phase === "summary";
  return state.phase === "attack";
}

function respondWithMotion(instanceId) {
  if (state.phase !== "response" || !state.pendingAttack) return;
  const motion = state.hands.motions.find((card) => card.instanceId === normalizeInstanceId(instanceId));
  if (!motion || motion.kind !== "motion" || !spend("plaintiff", motion.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(motion);
  trackCardPlayed(motion);
  resolveAttack(motion);
}

function resolveAttack(motion) {
  if (!state.pendingAttack) return;
  stopTimer();
  const { attack, evaluation } = state.pendingAttack;
  state.pendingAttack = null;
  const motionIsResponsive = Boolean(motion && motion.answers.includes(attack.id));
  const correctMotion = motionIsResponsive && evaluation.counterWorks;

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
    recordDocket("No timely response", "The attack stands because the motion window expired.", {
      type: "response-missed",
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
      source: evaluation.source
    });
    setJudge("good", "Procedural save", evaluation.cureDetail || evaluation.winDetail, evaluation.source);
    continueAfterThresholdAttack();
    return;
  }

  trackAttackResult(false);
  state.attackCount += 1;
  recordDocket("Attack denied", evaluation.winDetail, {
    type: "attack-denied",
    attackId: attack.id,
    source: evaluation.source
  });
  setJudge("good", "Motion granted", evaluation.winDetail, evaluation.source);
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
    source: evaluation.source
  });
  setJudge("neutral", "Attack fails", evaluation.winDetail || "The facts do not support the procedural attack.", evaluation.source);
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
      source: evaluation.source
    });
    setJudge("bad", "Removed to federal court", body || evaluation.body, evaluation.source);
    continueAfterThresholdAttack();
    return;
  }

  if (attack.id === "join") {
    state.activeCase.blockedRemoval = true;
    state.activeCase.joinedForumDefendant = true;
    if (state.activeCase.currentCourt === "federal" && !hasFederalSmj(state.activeCase, state.selectedDefendant)) {
      state.activeCase.currentCourt = "state";
    }
    state.attackCount += 1;
    recordDocket("Local party joined", "Diversity leverage is reduced and removal is blocked.", {
      type: "party-joined",
      attackId: attack.id,
      source: evaluation.source
    });
    setJudge("bad", "Joinder changes the forum math", body || evaluation.body, evaluation.source);
    continueAfterThresholdAttack();
    return;
  }

  if (attack.id === "venue") {
    state.activeCase.currentForum = state.activeCase.eventState;
    state.attackCount += 1;
    recordDocket("Transferred", `Venue moves to ${state.activeCase.eventState}.`, {
      type: "forum-changed",
      attackId: attack.id,
      source: evaluation.source
    });
    setJudge("bad", "Venue attack succeeds", body || evaluation.body, evaluation.source);
    continueAfterThresholdAttack();
    return;
  }

  dismissCase(attack.subtitle, body || evaluation.body, evaluation.source);
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
  if (state.phase !== "attack") return;
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
  if (state.phase !== "discovery" || !state.activeCase) return;
  const evidence = state.activeCase.evidence.find((item) => item.id === evidenceId);
  const tool = state.hands.motions.find((item) => item.instanceId === normalizeInstanceId(instanceId));
  if (!evidence || !tool || tool.kind !== "discovery-tool" || !spend("plaintiff", tool.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(tool);
  trackCardPlayed(tool);
  trackDoctrine(tool.title, DISCOVERY_SOURCE_HOOKS[tool.tool]);

  if (tool.tool !== evidence.tool) {
    const reason = `${tool.title} does not match ${evidence.title}; ${toolName(evidence.tool)} was required.`;
    trackWrongMotion(tool, reason, evidence.id);
    recordDocket("Wrong discovery tool", `${tool.title} does not match ${evidence.title}.`, {
      type: "wrong-discovery-tool",
      cardId: tool.id,
      evidenceId: evidence.id,
      correct: false
    });
    setJudge("bad", "Discovery miss", `${evidence.title} calls for ${toolName(evidence.tool)}.`, "The game maps discovery tools to their ordinary Civ Pro use.");
    render();
    return;
  }

  recordDocket(tool.title, `${state.players[state.plaintiff].name} targets ${evidence.title}.`, {
    type: "discovery-request",
    cardId: tool.id,
    evidenceId: evidence.id,
    correct: true,
    source: DISCOVERY_SOURCE_HOOKS[tool.tool]
  });
  const resistance = evidence.resistance || "resistance";
  if (evidence.resistance) {
    evidence.pendingResistance = resistance;
    setJudge(
      "neutral",
      "Discovery objection raised",
      `The defense objects on ${resistanceLabel(resistance)} grounds. Use a discovery motion card to solve it.`,
      "Rule 37 permits motions to compel after discovery resistance."
    );
    advanceTutorial("request-resistant-docs");
    render();
    return;
  }

  collectEvidence(evidence);
  if (state.phase !== "trial") {
    setJudge("good", "Discovery obtained", `${evidence.title} is collected.`, "Targeted discovery generally proceeds when relevant and proportional.");
  }
  if (evidence.tool === "deposition") advanceTutorial("collect-deposition");
  if (evidence.tool === "expert") advanceTutorial("expert-proof");
  render();
}

function answerDiscoveryResistance(instanceId) {
  if (state.phase !== "discovery" || !state.activeCase) return;
  const evidence = state.activeCase.evidence.find((item) => item.pendingResistance);
  const motion = state.hands.motions.find((item) => item.instanceId === normalizeInstanceId(instanceId));
  if (!evidence || !motion || motion.kind !== "discovery" || !spend("plaintiff", motion.cost)) return;
  removeFromHand("motions", instanceId);
  state.discards.motions.push(motion);
  trackCardPlayed(motion);
  trackDoctrine("Discovery objections", "FRCP 26(b)(1), 26(b)(5), and 37");
  const resistance = evidence.pendingResistance;
  const works = motion.answers.includes(resistance);
  recordDocket(motion.title, motion.text, {
    type: "discovery-motion",
    cardId: motion.id,
    evidenceId: evidence.id,
    correct: works,
    source: "FRCP 26 and 37"
  });

  if (!works) {
    trackWrongMotion(motion, `Did not solve the ${resistanceLabel(resistance)} objection.`, evidence.id);
    delete evidence.pendingResistance;
    evidence.failed = true;
    setJudge("bad", "Discovery denied", `${motion.title} does not solve a ${resistanceLabel(resistance)} objection.`, "Discovery disputes require the right procedural response.");
    render();
    return;
  }

  delete evidence.pendingResistance;
  collectEvidence(evidence);
  if (state.phase !== "trial") {
    setJudge("good", "Discovery motion granted", `${motion.title} answers the objection. ${evidence.title} is now in the record.`, "This abstracts Rule 37 motion-to-compel practice.");
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
    source: DISCOVERY_SOURCE_HOOKS[evidence.tool]
  });
  if (allEvidenceCollected(state.activeCase)) {
    awardTrialReady();
  }
}

function closeDiscovery() {
  if (state.phase !== "discovery") return;
  state.phase = "summary";
  recordDocket("Discovery closed", `${missingEvidence(state.activeCase).length} proof item(s) remain incomplete.`, {
    type: "phase-changed",
    source: "FRCP 56"
  });
  setJudge("neutral", "Discovery closed", "The defense may now play summary judgment. The plaintiff must show record evidence for every required proof item.", "Rule 56 turns the discovery record into the next procedural fight.");
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
    { type: "summary-judgment", source: "FRCP 56", correct: missing.length === 0 }
  );

  if (!motion || !motionIsResponsive || missing.length) {
    if (missing.length) {
      trackAttackResult(true);
      dismissCase("Summary judgment", "The plaintiff lacks record evidence for every required element.", "FRCP 56");
      return;
    }
  }

  trackAttackResult(false);
  awardTrialReady();
  setJudge("good", "Summary judgment denied", "The record contains every required proof item, so the claim is trial ready.", "FRCP 56");
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
  finalizeRound({ type: "trial-ready", label: "Trial ready", reason: "Every required proof item is in the record." });
  setJudge("good", "Claim reaches trial", `The plaintiff survives threshold attacks and builds the record. Score ${points} points, then rotate roles.`, "The game treats trial readiness as the Civ Pro win condition.");
  stopTimer();
  render();
}

function dismissCase(title, body, source) {
  if (!state.activeCase || state.phase === "trial") return;
  state.activeCase.dismissed = true;
  state.players[state.defense].score += 1;
  state.players[state.plaintiff].dismissed += 1;
  state.phase = "trial";
  trackDoctrine(title, source);
  recordDocket("Claim dismissed", title, {
    type: "round-outcome",
    outcome: "dismissed",
    source
  });
  finalizeRound({ type: "dismissed", label: "Dismissed", reason: title });
  setJudge("bad", title, `${body} Defense scores 1 point.`, source);
  stopTimer();
  render();
}

function nextRound() {
  stopTimer();
  advanceTutorial("next-round");
  const roundLimit = activeScenarioPack()?.rounds;
  if (roundLimit && state.round >= roundLimit) {
    state.sessionComplete = true;
    setJudge(
      "good",
      "Classroom session complete",
      `${roundLimit} planned round${roundLimit === 1 ? "" : "s"} finished. Use the assessment and local balance signals for debrief, then export the replay if the class found a confusing result.`,
      "Version 0.3 classroom pilot workflow."
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

function trackDoctrine(doctrine, source) {
  if (!state.currentRoundMetrics) return;
  addUniqueMetric(state.currentRoundMetrics.doctrinesTriggered, doctrine);
  addUniqueMetric(state.currentRoundMetrics.sourceHooks, source);
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

function startTimer(label, seconds, onExpire) {
  stopTimer();
  if (state.settings.studyMode || state.settings.noTimer) {
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

function stopTimer() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.deadline = null;
  state.secondsLeft = null;
}

function setJudge(tone, title, body, cite) {
  state.judge = {
    tone,
    title,
    body,
    cite,
    revealed: !state.settings.examMode || tone === "neutral"
  };
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
    .map(([id, title]) => `<option value="${id}">${title}</option>`)
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

function loadPlaytestStats() {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const saved = JSON.parse(storage.getItem(PLAYTEST_STORAGE_KEY) || "null");
    state.playtestStats = saved?.schemaVersion === 1 && Array.isArray(saved.rounds)
      ? saved
      : createEmptyPlaytestStats();
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
  renderAttackHand();
  renderMotionHand();
  renderDiscovery();
  renderJudge();
  renderAssessment();
  renderPlaytestStats();
  setSessionStatus(state.sessionStatus, state.sessionStatusError);
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
    <li class="phase-step ${state.phase === id ? "active" : ""}">
      <span>${index + 1}</span>
      <strong>${label}</strong>
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
    <h2>${step.title}</h2>
    <p>${step.body}</p>
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
      <input type="checkbox" data-mode="${id}" ${state.settings[id] ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `).join("");
  els["topic-toggles"].innerHTML = TOPIC_MODULES.map((topic) => `
    <label class="toggle small">
      <input type="checkbox" data-topic="${topic.id}" ${state.settings.activeTopics.has(topic.id) ? "checked" : ""}>
      <span>${topic.label}${topic.preview ? " (preview)" : ""}</span>
    </label>
  `).join("");
  els["mode-toggles"].querySelectorAll("[data-mode]").forEach((input) => {
    input.addEventListener("change", () => {
      state.settings[input.dataset.mode] = input.checked;
      if (input.dataset.mode === "noTimer" && input.checked) stopTimer();
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
  els["source-list"].innerHTML = SOURCES.map((source) => `
    <li><a href="${source.href}" target="_blank" rel="noreferrer">${source.label}</a>: ${source.note}</li>
  `).join("");
}

function renderClaimHand() {
  els["claim-hand"].innerHTML = state.hands.claims.map((claim) => `
    <button class="playing-card ${state.activeCase?.id === claim.id ? "selected" : ""}" ${state.phase !== "claim" ? "disabled" : ""} data-action="file-claim" data-id="${claim.instanceId}">
      <span class="card-type">Claim</span>
      <h3>${claim.title}</h3>
      <p>${claim.summary}</p>
      <div class="card-meta">
        <span class="tag">${claim.plaintiff.state} plaintiff</span>
        <span class="tag">${claim.forumState} ${claim.court}</span>
        <span class="tag">${formatMoney(claim.amount)}</span>
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
      <h2>${c.title}</h2>
      <p>${c.summary}</p>
      <dl>
        <div><dt>Plaintiff</dt><dd>${c.plaintiff.name} (${c.plaintiff.state})</dd></div>
        <div><dt>Forum</dt><dd>${c.currentForum || c.forumState} ${c.currentCourt || c.court}</dd></div>
        <div><dt>Amount</dt><dd>${formatMoney(c.amount)}</dd></div>
        <div><dt>Claim</dt><dd>${c.type}</dd></div>
      </dl>
      <p>${c.venueFacts}</p>
      ${c.supplementalClaim ? `<p><strong>Supplemental claim:</strong> ${c.supplementalClaim.title}</p>` : ""}
      <div class="defendant-options">
        ${c.defendants.map((option) => `
          <button class="option-button ${d?.id === option.id ? "selected" : ""}" ${state.phase !== "defendant" ? "disabled" : ""} data-action="choose-defendant" data-id="${option.id}">
            <strong>${option.name}</strong>
            <span>${option.state}${option.ppb && option.ppb !== option.state ? ` / PPB ${option.ppb}` : ""}. ${option.role}</span>
          </button>
        `).join("")}
      </div>
      <div class="case-actions">
        <button class="button blue" data-action="pass-attacks" ${state.phase !== "attack" ? "disabled" : ""}>Pass to discovery</button>
        <button class="button red" data-action="close-discovery" ${state.phase !== "discovery" ? "disabled" : ""}>Close discovery</button>
        <button class="button green" data-action="next-round" ${state.phase !== "trial" || state.sessionComplete ? "disabled" : ""}>${nextRoundLabel}</button>
      </div>
    </div>
    <div class="case-docket">
      <span class="section-label">Docket</span>
      ${status ? `
        <div class="status-grid">
          <div><span>Diversity</span><strong>${status.diversity}</strong></div>
          <div><span>Federal SMJ</span><strong>${status.smj}</strong></div>
          <div><span>PJ contacts</span><strong>${status.pj}</strong></div>
          <div><span>Service</span><strong>${status.service}</strong></div>
          <div><span>Removal</span><strong>${status.removal}</strong></div>
          <div><span>Supp. Jx</span><strong>${status.supplemental}</strong></div>
        </div>
      ` : ""}
      <ul class="docket-list">${state.docket.map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong>${escapeHtml(entry.detail)}</li>`).join("")}</ul>
    </div>
  `;
  els["active-case"].querySelectorAll("[data-action='choose-defendant']").forEach((button) => button.addEventListener("click", () => chooseDefendant(button.dataset.id)));
  els["active-case"].querySelector("[data-action='pass-attacks']")?.addEventListener("click", passAttacks);
  els["active-case"].querySelector("[data-action='close-discovery']")?.addEventListener("click", closeDiscovery);
  els["active-case"].querySelector("[data-action='next-round']")?.addEventListener("click", nextRound);
}

function renderAttackHand() {
  els["draw-attack-button"].disabled = state.hands.attacks.length >= HAND_LIMITS.attacks;
  els["attack-hand"].innerHTML = state.hands.attacks.map((card) => {
    const disabled = !canPlayAttack(card) || !canAfford("defense", card.cost);
    return `
      <button class="playing-card" ${disabled ? "disabled" : ""} data-action="attack" data-id="${card.instanceId}">
        <span class="card-type attack">${card.title}</span>
        <h3>${card.subtitle}</h3>
        <p>${card.text}</p>
        <div class="card-meta"><span class="tag">${card.timing === "summary" ? "After discovery" : "Threshold"}</span><span class="tag">${card.cost} budget</span></div>
      </button>
    `;
  }).join("");
  els["attack-hand"].querySelectorAll("[data-action='attack']").forEach((button) => button.addEventListener("click", () => playAttack(button.dataset.id)));
}

function renderMotionHand() {
  els["draw-motion-button"].disabled = state.hands.motions.length >= HAND_LIMITS.motions;
  els["motion-hand"].innerHTML = state.hands.motions.map((card) => {
    const isMotion = card.kind === "motion";
    const isDiscoveryAnswer = card.kind === "discovery";
    const disabled = isMotion
      ? state.phase !== "response" || !canAfford("plaintiff", card.cost)
      : isDiscoveryAnswer
        ? !hasPendingDiscoveryResistance() || !canAfford("plaintiff", card.cost)
        : state.phase !== "discovery" || !canAfford("plaintiff", card.cost);
    return `
      <button class="playing-card" ${disabled ? "disabled" : ""} data-action="${isMotion ? "motion" : isDiscoveryAnswer ? "discovery-response" : "tool"}" data-id="${card.instanceId}">
        <span class="card-type ${isMotion ? "motion" : "discovery"}">${isMotion ? "Motion" : "Discovery"}</span>
        <h3>${card.title}</h3>
        <p>${card.text}</p>
        <div class="card-meta"><span class="tag">${card.cost} budget</span></div>
      </button>
    `;
  }).join("");
  els["motion-hand"].querySelectorAll("[data-action='motion']").forEach((button) => button.addEventListener("click", () => respondWithMotion(button.dataset.id)));
  els["motion-hand"].querySelectorAll("[data-action='discovery-response']").forEach((button) => button.addEventListener("click", () => answerDiscoveryResistance(button.dataset.id)));
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
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="card-meta"><span class="tag">${toolName(item.tool)}</span>${item.resistance ? `<span class="tag">${resistanceLabel(item.resistance)}</span>` : ""}</div>
        <div class="case-actions">
          ${tools.map((tool) => `
            <button class="button secondary" data-action="request-evidence" data-evidence="${item.id}" data-tool="${tool.instanceId}" ${state.phase !== "discovery" || complete || pending || !canAfford("plaintiff", tool.cost) ? "disabled" : ""}>${tool.title}</button>
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
      ${state.settings.showExplanations ? `<p><strong>Source hook:</strong> ${escapeHtml(state.judge.cite)}</p>` : ""}
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
      <p>Complete a round to generate doctrines triggered, wrong motions, outcome, missing proof, and source hooks.</p>
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
    <h4>Source hooks</h4>
    ${renderCompactList(assessment.sourceHooks, "No source hook was recorded.")}
  `;
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
    </dl>
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
      <h3>${card.title}</h3>
      <p>${card.summary}</p>
      <p><strong>Forum:</strong> ${card.forumState} ${card.court}</p>
      <p><strong>Amount:</strong> ${formatMoney(card.amount)}</p>
      <p><strong>Proof:</strong> ${card.evidence.map((item) => item.title).join("; ")}</p>
    </article>
  `;
}

function printRuleCard(card, type) {
  return `
    <article class="print-card">
      <span>${type}</span>
      <h3>${card.title}</h3>
      <h4>${card.subtitle || card.kind}</h4>
      <p>${card.text}</p>
      <p><strong>Cost:</strong> ${card.cost || 0}</p>
    </article>
  `;
}

function showRuleTests() {
  const result = runRuleTests();
  const body = result.failures.length
    ? `${result.passed}/${result.total} rule tests passed. Failing: ${result.failures.join("; ")}`
    : `${result.passed}/${result.total} rule tests passed.`;
  setJudge(result.failures.length ? "bad" : "good", "Rule tests complete", body, "Same tests are available with npm test.");
  renderJudge();
}

function shuffle(items) {
  return seededShuffle(items, state);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

document.addEventListener("DOMContentLoaded", init);
