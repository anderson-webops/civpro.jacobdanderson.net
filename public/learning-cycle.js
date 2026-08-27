export const LEARNING_CYCLE_SCHEMA_VERSION = 1;

const PREDICTIONS = new Set(["attack-succeeds", "attack-fails"]);

const ALTERED_FACT_PROMPTS = {
  pj: "Alter one forum-contact fact. Would the personal-jurisdiction attack now succeed or fail?",
  "late-rule12": "Assume the defense expressly preserved the issue in its first Rule 12 response. Would the attack now succeed or fail?",
  service: "Assume service was completed by a method authorized by Rule 4. Would the service attack now succeed or fail?",
  smj: "Assume the complaint adds a federal claim on its face. Would the subject-matter-jurisdiction attack now succeed or fail?",
  venue: "Assume a substantial part of the events occurred in the chosen district. Would the venue attack now succeed or fail?",
  remove: "Assume the case rests only on diversity and a properly joined and served forum defendant is named. Would removal now succeed or fail?",
  join: "Assume the proposed defendant has no connection to the same transaction or occurrence. Would joinder now succeed or fail?",
  supplemental: "Assume the added state claim shares no operative facts with the federal anchor. Would supplemental jurisdiction now survive?",
  erie: "Assume a valid Federal Rule directly governs the disputed procedure. Would state law still control that procedural issue?",
  "failure-state-claim": "Assume the complaint adds concrete facts supporting each element. Would the Rule 12(b)(6) attack now succeed or fail?",
  "class-cert": "Assume the record shows one common contention capable of classwide resolution. Would the certification attack now succeed or fail?",
  "summary-judgment": "Assume one required element has no record evidence. Would summary judgment now succeed or fail?"
};

export function createLearningCycle({
  round,
  attack,
  evaluation,
  activeCase,
  selectedDefendant,
  responseOptions = [],
  createdAt = Date.now()
}) {
  if (!attack?.id || !evaluation || !activeCase || !selectedDefendant) {
    throw new TypeError("Attack, evaluation, active case, and selected defendant are required.");
  }
  return {
    schemaVersion: LEARNING_CYCLE_SCHEMA_VERSION,
    id: `round-${round}-${attack.id}-${createdAt}`,
    round,
    attackId: attack.id,
    attackTitle: attack.subtitle || attack.title,
    caseId: activeCase.id,
    caseTitle: activeCase.title,
    defendantId: selectedDefendant.id,
    defendantName: selectedDefendant.name,
    stage: "predict",
    factPattern: `${activeCase.summary} Selected defendant: ${selectedDefendant.name}.`,
    issuePrompt: evaluation.prompt,
    responseOptions: [...responseOptions],
    initial: null,
    mechanicalCheck: null,
    ruling: null,
    revision: null,
    alteredFactPrompt: ALTERED_FACT_PROMPTS[attack.id] || "Change one material fact. Would the ruling change?",
    alteredPrediction: null,
    predictionCorrect: null,
    createdAt: new Date(createdAt).toISOString(),
    completedAt: null
  };
}

export function commitInitialPrediction(cycle, { prediction, reasoning, committedAt = Date.now() }) {
  assertStage(cycle, "predict");
  validatePrediction(prediction);
  const normalizedReasoning = normalizeWriting(reasoning, "Initial reasoning");
  return {
    ...clone(cycle),
    stage: "response",
    initial: {
      prediction,
      reasoning: normalizedReasoning,
      committedAt: new Date(committedAt).toISOString()
    },
    mechanicalCheck: {
      message: cycle.responseOptions.length
        ? "Now choose a procedurally responsive motion, or stand on the prediction without responding."
        : "No responsive motion is currently in hand. You may stand on the prediction without responding.",
      responsiveCardIds: [...cycle.responseOptions]
    }
  };
}

export function recordLearningRuling(cycle, {
  attackSucceeded,
  motionId = null,
  motionTitle = null,
  motionResponsive = false,
  body,
  authorityIds = [],
  proposition = "",
  ruledAt = Date.now()
}) {
  assertStage(cycle, "response");
  const actual = attackSucceeded ? "attack-succeeds" : "attack-fails";
  return {
    ...clone(cycle),
    stage: "revise",
    ruling: {
      actual,
      label: attackSucceeded ? "Attack succeeds" : "Attack fails",
      body: String(body || "Ruling recorded.").slice(0, 2000),
      motionId,
      motionTitle,
      motionResponsive: Boolean(motionResponsive),
      authorityIds: [...new Set(authorityIds)],
      proposition: String(proposition || "").slice(0, 2000),
      ruledAt: new Date(ruledAt).toISOString()
    },
    predictionCorrect: cycle.initial.prediction === actual
  };
}

export function completeLearningCycle(cycle, {
  revision,
  alteredPrediction,
  alteredReasoning,
  completedAt = Date.now()
}) {
  assertStage(cycle, "revise");
  validatePrediction(alteredPrediction);
  return {
    ...clone(cycle),
    stage: "complete",
    revision: normalizeWriting(revision, "Revision"),
    alteredPrediction: {
      prediction: alteredPrediction,
      reasoning: normalizeWriting(alteredReasoning, "Altered-fact reasoning")
    },
    completedAt: new Date(completedAt).toISOString()
  };
}

export function learningReviewPending(cycle) {
  return Boolean(cycle && cycle.stage !== "complete");
}

export function predictionLabel(value) {
  return value === "attack-succeeds" ? "Attack succeeds" : value === "attack-fails" ? "Attack fails" : "Not recorded";
}

function validatePrediction(value) {
  if (!PREDICTIONS.has(value)) throw new TypeError("Choose whether the attack succeeds or fails.");
}

function normalizeWriting(value, label) {
  const normalized = String(value ?? "").trim().slice(0, 1200);
  if (normalized.length < 10) throw new TypeError(`${label} must be at least 10 characters.`);
  return normalized;
}

function assertStage(cycle, stage) {
  if (!cycle || cycle.schemaVersion !== LEARNING_CYCLE_SCHEMA_VERSION || cycle.stage !== stage) {
    throw new TypeError(`Learning cycle must be in the ${stage} stage.`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
