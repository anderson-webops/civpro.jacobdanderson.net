import assert from "node:assert/strict";
import { SCENARIO_PACKS } from "../public/scenario-packs.generated.js";

// Synthetic, cooperative walkthroughs. These are not participant results or pacing estimates.
export async function rehearsePacks(browser, baseUrl) {
  let completed = 0;
  let exchanges = 0;
  for (const pack of SCENARIO_PACKS) {
    for (const route of ["complete-record", "early-close"]) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(baseUrl);
        await page.locator("#study-mode").check();
        await page.locator("#scenario-track").selectOption(pack.trackId);
        await page.locator("#scenario-duration").selectOption(String(pack.durationMinutes));
        await page.locator("#apply-scenario-button").click();
        const plannedRounds = route === "complete-record" ? pack.rounds : 1;
        for (let round = 1; round <= plannedRounds; round += 1) {
          await page.locator("#claim-hand .playing-card").first().click();
          await page.locator("#active-case .option-button").first().click();
          await page.locator("[data-action='pass-attacks']").click();
          if (route === "complete-record") {
            const initial = await snapshot(page);
            for (const evidence of initial.activeCase.evidence) {
              const tool = await findCard(page, "motions", (card) => card.tool === evidence.tool);
              await page.locator(`[data-action='request-evidence'][data-evidence='${evidence.id}'][data-tool='${tool.instanceId}']`).click();
              if (evidence.resistance) {
                const answer = await findCard(page, "motions", (card) => card.kind === "discovery" && card.answers.includes(evidence.resistance));
                await page.locator(`[data-action='discovery-response'][data-id='${answer.instanceId}']`).click();
              }
            }
          } else {
            await page.locator("[data-action='close-discovery']").click();
            const attack = await findCard(page, "attacks", (card) => card.id === "summary-judgment");
            await page.locator(`[data-action='attack'][data-id='${attack.instanceId}']`).click();
            await page.locator("[name='prediction'][value='attack-succeeds']").check();
            await page.locator("#initial-reasoning").fill("Synthetic rehearsal: the proof checklist is incomplete.");
            await page.getByRole("button", { name: "Commit prediction" }).click();
            await page.getByRole("button", { name: "Use no response" }).click();
            await page.locator("#revision-reasoning").fill("Synthetic rehearsal: the ruling follows the missing proof.");
            await page.locator("[name='alteredPrediction'][value='attack-succeeds']").check();
            await page.locator("#altered-reasoning").fill("Synthetic rehearsal: the changed record still lacks one item.");
            await page.getByRole("button", { name: "Save revision and continue" }).click();
          }
          const final = await snapshot(page);
          assert.equal(final.phase, "trial", `${pack.id}/${route}/${round} must reach assessment`);
          assert.equal(final.lastAssessment.outcome.type, route === "complete-record" ? "trial-ready" : "dismissed");
          assert.equal(final.lastAssessment.wrongMotions.length, 0, "Progress must not require a deliberately wrong motion");
          assert.ok(final.resources.plaintiff >= 0 && final.resources.defense >= 0);
          exchanges += Object.values(final.lastAssessment.cardExchanges).reduce((sum, count) => sum + count, 0);
          const history = await page.evaluate(() => localStorage.getItem("civpro.v0.4.playtest-stats"));
          assert.ok(!history.includes("Synthetic rehearsal"), "Long-term balance history must omit written answers");
          completed += 1;
          await page.locator("[data-action='next-round']").click();
          if (route === "complete-record" && round === plannedRounds) {
            assert.equal((await snapshot(page)).sessionComplete, true, `${pack.id} must finish the planned session`);
          }
        }
      } finally {
        await context.close();
      }
    }
  }
  console.log(`Synthetic pilot rehearsal: ${SCENARIO_PACKS.length} packs, ${completed} assessed rounds, ${exchanges} budget-neutral exchanges. No human participants.`);
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.autosave")).state);
}

async function findCard(page, type, matches) {
  const label = type === "attacks" ? "attack" : "motion";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const before = await snapshot(page);
    const card = before.hands[type].find(matches);
    if (card) return card;
    await page.locator(`#exchange-${label}-card`).selectOption(before.hands[type][0].instanceId);
    await page.locator(`#exchange-${label}-button`).click();
    const after = await snapshot(page);
    assert.equal(after.hands[type].length, before.hands[type].length, "An exchange must keep hand size constant");
    assert.deepEqual(after.resources, before.resources, "An exchange must not spend or refund litigation budget");
    assert.equal(after.currentRoundMetrics.cardsPlayed?.[before.hands[type][0].id] || 0,
      before.currentRoundMetrics.cardsPlayed?.[before.hands[type][0].id] || 0, "Exchanging is not playing a card");
  }
  throw new Error(`Required ${type} card remained inaccessible after bounded exchanges`);
}
