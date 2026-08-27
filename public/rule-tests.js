import { ATTACK_CARDS, CASES } from "./data.js";
import {
  activeByTopic,
  allEvidenceCollected,
  clone,
  evaluateAttack,
  formatMoney,
  hasCompleteDiversity,
  hasFederalSmj,
  hasForumDefendant,
  isRemovalAvailable,
  missingEvidence,
  removalBasis,
  resistanceLabel,
  statusFacts,
  toolName,
  withInstance
} from "./rules.js";

function caseById(id) {
  return clone(CASES.find((item) => item.id === id));
}

function attackById(id) {
  return ATTACK_CARDS.find((item) => item.id === id);
}

function selectedDefendant(c, id) {
  return c.defendants.find((item) => item.id === id);
}

function evalFor(caseId, defendantId, attackId, overrides = {}) {
  const c = caseById(caseId);
  Object.assign(c, overrides.casePatch || {});
  c.currentCourt = c.currentCourt || c.court;
  c.currentForum = c.currentForum || c.forumState;
  const d = selectedDefendant(c, defendantId);
  return evaluateAttack({
    attack: attackById(attackId),
    activeCase: c,
    selectedDefendant: d,
    attackCount: overrides.attackCount || 0,
    missingEvidence: overrides.missingEvidence || missingEvidence(c)
  });
}

function completedCase(caseId) {
  const c = caseById(caseId);
  c.evidence.forEach((item) => {
    item.complete = true;
  });
  return c;
}

export function runRuleTests() {
  const tests = [
    {
      name: "clone performs a deep copy",
      run: () => {
        const original = caseById("tire-failure");
        const copy = clone(original);
        copy.defendants[0].contacts.push("NV");
        return !original.defendants[0].contacts.includes("NV");
      }
    },
    {
      name: "activeByTopic keeps cards with matching topics arrays",
      run: () => activeByTopic(CASES, new Set(["class-actions"])).some((item) => item.id === "subscription-class")
    },
    {
      name: "activeByTopic keeps cards with a matching single topic",
      run: () => activeByTopic(ATTACK_CARDS, new Set(["service"])).some((item) => item.id === "service")
    },
    {
      name: "withInstance preserves card data and appends stable sequence suffix",
      run: () => withInstance(ATTACK_CARDS[0], 42).instanceId === `${ATTACK_CARDS[0].id}-42`
    },
    {
      name: "complete diversity exists when no plaintiff state matches defendant citizenship",
      run: () => {
        const c = caseById("tire-failure");
        return hasCompleteDiversity(c, selectedDefendant(c, "tireco"));
      }
    },
    {
      name: "complete diversity fails against same-state forum defendant",
      run: () => {
        const c = caseById("festival-injury");
        return !hasCompleteDiversity(c, selectedDefendant(c, "festival"));
      }
    },
    {
      name: "joined same-state defendant breaks complete diversity",
      run: () => {
        const c = caseById("tire-failure");
        c.joinedDefendantIds = ["roadworks"];
        return !hasCompleteDiversity(c, selectedDefendant(c, "tireco"));
      }
    },
    {
      name: "forum-defendant status does not itself change citizenship analysis",
      run: () => {
        const c = caseById("tire-failure");
        c.plaintiff.state = "KS";
        c.joinedDefendantIds = ["roadworks"];
        return hasCompleteDiversity(c, selectedDefendant(c, "tireco"))
          && hasForumDefendant(c, selectedDefendant(c, "tireco"));
      }
    },
    {
      name: "procedural removal block does not alter complete diversity",
      run: () => {
        const c = caseById("tire-failure");
        c.removalProcedurallyBlocked = true;
        const d = selectedDefendant(c, "tireco");
        return hasCompleteDiversity(c, d) && !isRemovalAvailable(c, d);
      }
    },
    {
      name: "federal question creates federal SMJ without diversity",
      run: () => hasFederalSmj(caseById("wage-platform"), null)
    },
    {
      name: "amount exactly 75000 does not satisfy diversity amount threshold",
      run: () => {
        const c = caseById("tire-failure");
        c.amount = 75000;
        return !hasFederalSmj(c, selectedDefendant(c, "tireco"));
      }
    },
    {
      name: "statusFacts reports removal available for removable state case",
      run: () => statusFacts(caseById("tire-failure"), selectedDefendant(caseById("tire-failure"), "tireco")).removal === "Available: diversity"
    },
    {
      name: "statusFacts reports weak personal jurisdiction for out-of-forum defendant",
      run: () => {
        const c = caseById("wage-platform");
        return statusFacts(c, selectedDefendant(c, "payroll-vendor")).pj === "Weak";
      }
    },
    {
      name: "personal jurisdiction attack has merit without forum contacts",
      run: () => evalFor("wage-platform", "payroll-vendor", "pj").hasMerit
    },
    {
      name: "personal jurisdiction attack fails with forum contacts",
      run: () => !evalFor("tire-failure", "tireco", "pj").hasMerit
    },
    {
      name: "serial Rule 12 defense has merit when timely and underlying defense is valid",
      run: () => evalFor("wage-platform", "payroll-vendor", "late-rule12").hasMerit
    },
    {
      name: "late waivable Rule 12 defense is blocked after first attack",
      run: () => !evalFor("software-contract", "cloudscribe", "service", { attackCount: 1 }).hasMerit
    },
    {
      name: "preserved Rule 12 defense can still be raised after an earlier attack",
      run: () =>
        evalFor("software-contract", "cloudscribe", "service", {
          attackCount: 1,
          casePatch: { rule12Preserved: true }
        }).hasMerit
    },
    {
      name: "defective service has merit before cure",
      run: () => evalFor("software-contract", "cloudscribe", "service").hasMerit
    },
    {
      name: "proper service attack fails",
      run: () => !evalFor("tire-failure", "tireco", "service").hasMerit
    },
    {
      name: "federal SMJ attack has merit when federal court lacks original jurisdiction",
      run: () =>
        evalFor("software-contract", "cloudscribe", "smj", {
          casePatch: { currentCourt: "federal" }
        }).hasMerit
    },
    {
      name: "SMJ attack does not dismiss ordinary state-court general jurisdiction case",
      run: () => !evalFor("software-contract", "cloudscribe", "smj").hasMerit
    },
    {
      name: "improper venue attack has merit when forum has no event or defendant connection",
      run: () =>
        evalFor("software-contract", "cloudscribe", "venue", {
          casePatch: { currentForum: "NV" }
        }).hasMerit
    },
    {
      name: "proper venue attack fails where events occurred in forum",
      run: () => !evalFor("tire-failure", "tireco", "venue").hasMerit
    },
    {
      name: "diverse tire defendant can remove state claim over 75000",
      run: () => evalFor("tire-failure", "tireco", "remove").hasMerit
    },
    {
      name: "forum defendant blocks diversity removal",
      run: () => !evalFor("festival-injury", "festival", "remove").hasMerit
    },
    {
      name: "forum defendant does not block federal-question removal",
      run: () => evalFor("wage-platform", "local-franchise", "remove", {
        casePatch: { currentCourt: "state" }
      }).hasMerit
    },
    {
      name: "federal-question removal basis remains available without diversity",
      run: () => {
        const c = caseById("wage-platform");
        c.currentCourt = "state";
        const d = selectedDefendant(c, "local-franchise");
        return removalBasis(c, d) === "federal-question" && isRemovalAvailable(c, d);
      }
    },
    {
      name: "already-federal case cannot be removed again",
      run: () => !evalFor("wage-platform", "deliverly", "remove").hasMerit
    },
    {
      name: "explicit procedural restriction can block otherwise available removal",
      run: () => !evalFor("tire-failure", "tireco", "remove", {
        casePatch: { removalProcedurallyBlocked: true }
      }).hasMerit
    },
    {
      name: "join attack has merit when same-transaction forum defendant is available",
      run: () => evalFor("tire-failure", "tireco", "join").hasMerit
    },
    {
      name: "join attack fails when no local same-transaction defendant exists",
      run: () => !evalFor("subscription-class", "streambox", "join").hasMerit
    },
    {
      name: "related state wage claim survives supplemental attack",
      run: () => !evalFor("wage-platform", "deliverly", "supplemental").hasMerit
    },
    {
      name: "unrelated tagalong claim fails supplemental jurisdiction",
      run: () => evalFor("unrelated-tagalong", "employer", "supplemental").hasMerit
    },
    {
      name: "supplemental attack fails when no supplemental claim is in play",
      run: () => !evalFor("tire-failure", "tireco", "supplemental").hasMerit
    },
    {
      name: "Erie problem appears in federal diversity state-law claim",
      run: () => evalFor("data-breach", "bank", "erie").hasMerit
    },
    {
      name: "Erie attack fails when no state-law conflict is live",
      run: () => !evalFor("tire-failure", "tireco", "erie").hasMerit
    },
    {
      name: "failure to state a claim attack has merit against thin pleading",
      run: () => evalFor("software-contract", "cloudscribe", "failure-state-claim").hasMerit
    },
    {
      name: "failure to state a claim attack fails against sufficient pleading",
      run: () => !evalFor("tire-failure", "tireco", "failure-state-claim").hasMerit
    },
    {
      name: "class certification preview has merit before Rule 23 showing",
      run: () => evalFor("subscription-class", "streambox", "class-cert").hasMerit
    },
    {
      name: "class certification attack fails for non-class case",
      run: () => !evalFor("tire-failure", "tireco", "class-cert").hasMerit
    },
    {
      name: "summary judgment has merit when proof checklist is incomplete",
      run: () => evalFor("tire-failure", "tireco", "summary-judgment").hasMerit
    },
    {
      name: "summary judgment fails when all evidence is collected",
      run: () => {
        const c = completedCase("tire-failure");
        return !evaluateAttack({
          attack: attackById("summary-judgment"),
          activeCase: c,
          selectedDefendant: selectedDefendant(c, "tireco"),
          attackCount: 0,
          missingEvidence: missingEvidence(c)
        }).hasMerit;
      }
    },
    {
      name: "unknown attack id returns default no-rule result",
      run: () => {
        const c = caseById("tire-failure");
        const result = evaluateAttack({
          attack: { id: "unknown-rule", subtitle: "Unknown" },
          activeCase: c,
          selectedDefendant: selectedDefendant(c, "tireco"),
          attackCount: 0,
          missingEvidence: missingEvidence(c)
        });
        return !result.hasMerit && result.authorityIds.length === 0;
      }
    },
    {
      name: "every mapped attack result carries authority IDs and a proposition",
      run: () => ATTACK_CARDS.every((attack) => {
        const c = caseById("tire-failure");
        const result = evaluateAttack({
          attack,
          activeCase: c,
          selectedDefendant: selectedDefendant(c, "tireco"),
          attackCount: 0,
          missingEvidence: missingEvidence(c)
        });
        return Array.isArray(result.authorityIds)
          && result.authorityIds.length > 0
          && typeof result.proposition === "string"
          && result.proposition.length > 20;
      })
    },
    {
      name: "missingEvidence returns all incomplete proof items",
      run: () => missingEvidence(caseById("tire-failure")).length === 3
    },
    {
      name: "allEvidenceCollected is true only after every proof item is complete",
      run: () => allEvidenceCollected(completedCase("tire-failure"))
    },
    {
      name: "allEvidenceCollected is false for null active case",
      run: () => !allEvidenceCollected(null)
    },
    {
      name: "toolName resolves known discovery tools and preserves unknown tools",
      run: () => toolName("rfp") === "Request for production" && toolName("site-visit") === "site-visit"
    },
    {
      name: "resistanceLabel resolves known objections and preserves unknown objections",
      run: () => resistanceLabel("privacy") === "privacy/proportionality" && resistanceLabel("custom") === "custom"
    },
    {
      name: "formatMoney renders whole-dollar game amounts",
      run: () => formatMoney(120000) === "$120,000"
    }
  ];

  const failures = [];
  for (const test of tests) {
    try {
      if (!test.run()) failures.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error.message}`);
    }
  }

  return {
    total: tests.length,
    passed: tests.length - failures.length,
    failures
  };
}
