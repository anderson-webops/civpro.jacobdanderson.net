import {
  commitInitialPrediction,
  completeLearningCycle,
  createLearningCycle,
  learningReviewPending,
  recordLearningRuling
} from "../public/learning-cycle.js";

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

const cycle = createLearningCycle({
  round: 1,
  attack: { id: "remove", title: "Notice of Removal", subtitle: "Move to Federal Court" },
  evaluation: {
    prompt: "Is original federal jurisdiction present?",
    authorityIds: ["usc-28-1441"],
    proposition: "Section 1441 controls removal."
  },
  activeCase: { id: "case-1", title: "Removal Case", summary: "A state action presents a federal claim." },
  selectedDefendant: { id: "defendant-1", name: "Forum Defendant" },
  responseOptions: ["remand"],
  createdAt: Date.parse("2026-08-27T12:00:00Z")
});

expect(cycle.stage === "predict" && learningReviewPending(cycle), "A new cycle should block on the committed prediction.");
const committed = commitInitialPrediction(cycle, {
  prediction: "attack-succeeds",
  reasoning: "The federal claim supplies original federal jurisdiction.",
  committedAt: Date.parse("2026-08-27T12:01:00Z")
});
expect(committed.initial.reasoning.includes("federal claim"), "The initial reasoning should be preserved verbatim.");
expect(committed.mechanicalCheck.responsiveCardIds.includes("remand"), "The mechanical check should preserve responsive cards.");

const ruled = recordLearningRuling(committed, {
  attackSucceeded: true,
  motionId: "remand",
  motionTitle: "Motion to Remand",
  motionResponsive: true,
  body: "Federal-question removal is available.",
  authorityIds: ["usc-28-1441", "usc-28-1331"],
  proposition: "The forum-defendant restriction does not bar federal-question removal.",
  ruledAt: Date.parse("2026-08-27T12:02:00Z")
});
expect(ruled.stage === "revise" && ruled.predictionCorrect, "The ruling should compare the result with the committed prediction.");

const completed = completeLearningCycle(ruled, {
  revision: "The correct sequence is original jurisdiction first, then any basis-specific removal restriction.",
  alteredPrediction: "attack-fails",
  alteredReasoning: "With diversity alone and a served forum defendant, section 1441(b)(2) blocks removal.",
  completedAt: Date.parse("2026-08-27T12:03:00Z")
});
expect(completed.stage === "complete" && !learningReviewPending(completed), "A saved revision should unblock the game.");
expect(completed.initial.reasoning === committed.initial.reasoning, "Completion must not overwrite the learner's initial answer.");
expect(completed.revision.includes("correct sequence"), "Completion should preserve the learner's revision.");
expect(completed.alteredPrediction.prediction === "attack-fails", "Completion should preserve the altered-fact prediction.");

try {
  commitInitialPrediction(cycle, { prediction: "attack-succeeds", reasoning: "too short" });
  failures.push("Short reasoning should be rejected.");
} catch {
  // Expected.
}

if (failures.length) {
  console.error("Learning-cycle tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Learning-cycle tests passed.");
}
