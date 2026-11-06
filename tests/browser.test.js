import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { rehearsePacks } from "./pilot-rehearsal.js";
import { createReplayEnvelope } from "../public/classroom.js";
import { ATTACK_CARDS } from "../public/data.js";

const root = path.resolve("dist/client");
const failures = [];
const server = http.createServer(serveStatic);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  console.log("Browser phase: landing and accessibility");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await expectAccessible(page, "game landing page");
  expect(await page.locator("#resume-autosave-button").isHidden(), "A fresh session should not offer a nonexistent autosave to resume.");
  expect(await page.locator("#discard-autosave-button").isHidden(), "A fresh session should not offer a nonexistent autosave to discard.");

  console.log("Browser phase: keyboard and learning cycle");
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(firstFocus === "Skip to game table", "The skip link should be the first keyboard focus target.");
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.id) === "main-content", "The skip link should move focus to the main game.");

  const firstClaim = page.locator("#claim-hand .playing-card:not([disabled])").first();
  await firstClaim.focus();
  await page.keyboard.press("Enter");
  expect(await page.locator("#active-case .defendant-options").count() === 1, "A claim card should be playable by keyboard.");
  await page.locator("#active-case .option-button:not([disabled])").first().click();
  await page.locator("#attack-hand .playing-card:not([disabled])").first().click();
  expect(await page.evaluate(() => document.activeElement?.closest("#learning-cycle-output") !== null), "An attack should move keyboard focus to the prediction panel.");
  expect(await page.locator("[data-learning-form='prediction']").count() === 1, "An attack should open the committed-prediction step.");
  await page.locator("[data-learning-form='prediction'] input[value='attack-succeeds']").check();
  await page.locator("#initial-reasoning").fill("The forum facts are relevant to this procedural issue.");
  await page.locator("#study-mode").check();
  expect(await page.locator("#initial-reasoning").inputValue() === "The forum facts are relevant to this procedural issue.", "Changing Study mode must preserve unfinished reasoning.");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#resume-autosave-button").click();
  expect(await page.locator("#initial-reasoning").inputValue() === "The forum facts are relevant to this procedural issue.", "Autosave recovery should preserve the uncommitted draft.");
  await page.locator("#initial-reasoning").fill("            ");
  await page.locator("[data-learning-form='prediction'] button[type='submit']").click();
  expect(await page.locator("#initial-reasoning").inputValue() === "            ", "A validation error should not delete the learner's writing.");
  expect(await page.locator("[data-learning-form='prediction'] [role='alert']").count() === 1, "Validation feedback should appear beside the writing.");
  await page.locator("#initial-reasoning").fill("The selected facts appear to satisfy the attack's governing standard.");
  await page.locator("[data-learning-form='prediction'] button[type='submit']").click();
  expect(await page.getByText("Prediction locked:", { exact: false }).count() === 1, "The learner's initial answer should lock before the response.");
  await page.getByRole("button", { name: "Use no response" }).click();
  expect(await page.getByText("Response declined", { exact: true }).count() === 1, "An intentional nonresponse must not be reported as a timeout.");
  expect(await page.locator("[data-learning-form='revision']").count() === 1, "The ruling should require a revision before play continues.");
  await page.locator("#revision-reasoning").fill("The ruling turns on the specific forum, timing, and party facts identified by the source.");
  await page.locator("[data-learning-form='revision'] input[value='attack-fails']").check();
  await page.locator("#altered-reasoning").fill("Changing the stated material fact changes how the governing standard applies.");
  await page.locator("[data-learning-form='revision'] button[type='submit']").click();
  expect(await page.getByText("Cycle complete", { exact: true }).count() === 1, "Saving the revision should complete and unblock the learning cycle.");
  await expectAccessible(page, "completed learning cycle");

  await page.locator("#save-session-button").click();
  const savedSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
  await page.evaluate(() => {
    const key = "civpro.v0.4.saved-session";
    const snapshot = JSON.parse(localStorage.getItem(key));
    snapshot.state.judge.tone = `neutral" onmouseover="localStorage.setItem('civpro-xss-proof','triggered')`;
    localStorage.setItem(key, JSON.stringify(snapshot));
  });
  await page.locator("#load-session-button").click();
  expect(await page.locator("#session-status").textContent().then((value) => value.includes("could not be loaded")), "Unsafe saved judge tones should be rejected before rendering.");
  expect(await page.locator("#judge-output [onmouseover]").count() === 0, "Rejected replay state must not create event-handler attributes.");
  await page.locator("#judge-output .ruling").hover();
  expect(await page.evaluate(() => localStorage.getItem("civpro-xss-proof")) === null, "Rejected replay state must not execute in the headerless browser test server.");

  console.log("Browser phase: rejected replay imports");
  const injectedReplay = createReplayEnvelope(savedSnapshot.state);
  injectedReplay.snapshot.state = {
    ...injectedReplay.snapshot.state,
    playtestStats: { rounds: [{ caseId: "__proto__" }] }
  };
  const attackCount = await page.locator("#attack-hand .playing-card").count();
  await page.locator("#import-replay-input").setInputFiles({
    name: "injected-stats.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(injectedReplay))
  });
  await page.waitForFunction(() => document.querySelector("#session-status")?.textContent?.includes("Replay import failed"));
  expect(await page.evaluate(() => !Object.hasOwn(Object.prototype, "rounds")), "Rejected replay must not alter Object.prototype.");
  expect(await page.locator("#attack-hand .playing-card").count() === attackCount, "Rejected replay must not redraw the attack hand.");

  const oversizedReplay = structuredClone(injectedReplay);
  delete oversizedReplay.snapshot.state.playtestStats;
  oversizedReplay.snapshot.state.hands.attacks = Array.from({ length: 1000 }, (_, index) => ({
    ...savedSnapshot.state.hands.attacks[0], instanceId: `pj-${index + 100}`
  }));
  await page.locator("#import-replay-input").setInputFiles({
    name: "oversized-hand.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(oversizedReplay))
  });
  await page.waitForFunction(() => document.querySelector("#session-status")?.textContent?.includes("attack hand exceeds"));
  expect(await page.locator("#attack-hand .playing-card").count() === attackCount, "Oversized replay must fail before rendering cards.");

  const inactiveCaseReplay = createReplayEnvelope(savedSnapshot.state);
  const inactiveClaim = structuredClone(inactiveCaseReplay.snapshot.state.activeCase);
  inactiveClaim.defendants = Array.from({ length: 1000 }, () => structuredClone(inactiveClaim.defendants[0]));
  inactiveCaseReplay.snapshot.state.hands.claims = [inactiveClaim];
  inactiveCaseReplay.snapshot.state.activeCase = null;
  inactiveCaseReplay.snapshot.state.phase = "claim";
  const duplicateProofReplay = createReplayEnvelope(savedSnapshot.state);
  duplicateProofReplay.snapshot.state.activeCase.evidence[1] = structuredClone(duplicateProofReplay.snapshot.state.activeCase.evidence[0]);
  const staleCounterReplay = createReplayEnvelope(savedSnapshot.state);
  staleCounterReplay.snapshot.state.sequence = 1;
  const malformedEventReplay = createReplayEnvelope(savedSnapshot.state);
  malformedEventReplay.snapshot.state.eventSequence = { valueOf: 0, toString: 0 };
  for (const [name, replay, message] of [
    ["inactive-case.json", inactiveCaseReplay, "known case limit"],
    ["duplicate-proof.json", duplicateProofReplay, "duplicate ids"],
    ["stale-counter.json", staleCounterReplay, "exceed existing card identifiers"],
    ["malformed-event-counter.json", malformedEventReplay, "Event sequence"]
  ]) {
    await page.locator("#import-replay-input").setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(replay))
    });
    await page.waitForFunction((fragment) => document.querySelector("#session-status")?.textContent?.includes(fragment), message);
    expect(await page.locator("#attack-hand .playing-card").count() === attackCount, `${name} must not change the rendered session.`);
  }

  console.log("Browser phase: counter exhaustion and atomic recovery");
  for (const sequence of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]) {
    const replay = createReplayEnvelope(savedSnapshot.state);
    replay.snapshot.state.sequence = sequence;
    replay.snapshot.state.hands.attacks = [];
    replay.snapshot.state.decks.attacks = structuredClone(ATTACK_CARDS.slice(0, 2));
    await page.locator("#import-replay-input").setInputFiles({
      name: "bounded-counter.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(replay))
    });
    await page.waitForFunction(() => document.querySelector("#session-status")?.textContent?.includes("Replay imported"));
    await page.locator("#draw-attack-button").click();
    await page.locator("#draw-attack-button").click();
    expect((await page.locator("#session-status").textContent()).includes("identifiers exhausted"), "Counter exhaustion should produce an explicit recoverable error.");
    await page.locator("#save-session-button").click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
    const expectedDraws = sequence === Number.MAX_SAFE_INTEGER ? 0 : 1;
    expect(saved.state.sequence === Number.MAX_SAFE_INTEGER && saved.state.hands.attacks.length === expectedDraws
      && saved.state.decks.attacks.length === 2 - expectedDraws, "A refused draw must preserve the bounded hand and deck.");
    await page.locator("#load-session-button").click();
    expect((await page.locator("#session-status").textContent()).includes("restored"), "Counter-boundary saves must remain reloadable.");
    if (expectedDraws) {
      await page.locator("#save-session-button").click();
      const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
      await page.locator("#exchange-attack-card").selectOption(saved.state.hands.attacks[0].instanceId);
      await page.locator("#exchange-attack-button").click();
      expect((await page.locator("#session-status").textContent()).includes("identifiers exhausted"), "Exhausted exchanges should preserve the explicit limit.");
      await page.locator("#save-session-button").click();
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
      expect(JSON.stringify(after.state) === JSON.stringify(reloaded.state), "A refused exchange must preserve complete session state.");
    }
  }
  const exhaustedRound = createReplayEnvelope(savedSnapshot.state);
  exhaustedRound.snapshot.state.sequence = Number.MAX_SAFE_INTEGER - 2;
  exhaustedRound.snapshot.state.phase = "trial";
  await page.locator("#import-replay-input").setInputFiles({
    name: "exhausted-round.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exhaustedRound))
  });
  await page.waitForFunction(() => document.querySelector("#session-status")?.textContent?.includes("Replay imported"));
  await page.locator("#save-session-button").click();
  const beforeRound = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
  await page.locator("[data-action='next-round']").click();
  expect((await page.locator("#session-status").textContent()).includes("identifiers exhausted"), "An exhausted next round must stop before changing game state.");
  await page.locator("#save-session-button").click();
  const afterRound = await page.evaluate(() => JSON.parse(localStorage.getItem("civpro.v0.4.saved-session")));
  expect(JSON.stringify(afterRound.state) === JSON.stringify(beforeRound.state), "A refused round must retain roles, round, cards and metrics.");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#clear-game-data-button").click();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("civpro.v0.4.")).length) === 0, "Shared-computer cleanup must remove saves, drafts, and balance history.");

  console.log("Browser phase: guides and private-path boundaries");
  await page.goto(`${baseUrl}/guides/`, { waitUntil: "networkidle" });
  await expectAccessible(page, "guide library");
  await page.locator("#guide-search").fill("removal");
  expect((await page.locator("#guide-result-count").textContent()).startsWith("1 of 8"), "Guide search should filter the catalog and announce the result count.");

  for (const sensitivePath of ["/.env", "/ops/", "/scripts/", "/tests/", "/data/"]) {
    const response = await page.request.get(`${baseUrl}${sensitivePath}`);
    expect(response.status() === 404, `${sensitivePath} should not exist in the portable artifact.`);
  }
  expect(consoleErrors.length === 0, `Rendered pages should not emit console errors: ${consoleErrors.join(" | ")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "The game should fit a 390px mobile viewport.");
  await expectAccessible(page, "mobile game");
  console.log("Browser phase: synthetic scenario rehearsal");
  await rehearsePacks(browser, baseUrl);
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  console.log("Browser phase: cleanup");
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error("Rendered browser tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Rendered accessibility and keyboard-flow tests passed.");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

async function expectAccessible(page, label) {
  let timer;
  let result;
  try {
    result = await Promise.race([
      new AxeBuilder({ page }).analyze(),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} accessibility analysis exceeded 60 seconds.`)), 60_000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
  const severe = result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  if (severe.length) {
    failures.push(`${label} has severe accessibility violations: ${severe.map((item) => `${item.id}: ${item.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary}`).join(" | ")}`).join(" || ")}`);
  }
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = decodedPath === "/"
    ? "index.html"
    : decodedPath.endsWith("/")
      ? `${decodedPath.slice(1)}index.html`
      : decodedPath.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const extension = path.extname(filePath);
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(response);
}
