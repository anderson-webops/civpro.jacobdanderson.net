import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const root = path.resolve("dist/client");
const failures = [];
const server = http.createServer(serveStatic);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await expectAccessible(page, "game landing page");
  expect(await page.locator("#resume-autosave-button").isHidden(), "A fresh session should not offer a nonexistent autosave to resume.");
  expect(await page.locator("#discard-autosave-button").isHidden(), "A fresh session should not offer a nonexistent autosave to discard.");

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
  expect(await page.locator("[data-learning-form='prediction']").count() === 1, "An attack should open the committed-prediction step.");
  await page.locator("[data-learning-form='prediction'] input[value='attack-succeeds']").check();
  await page.locator("#initial-reasoning").fill("The selected facts appear to satisfy the attack's governing standard.");
  await page.locator("[data-learning-form='prediction'] button[type='submit']").click();
  expect(await page.getByText("Prediction locked:", { exact: false }).count() === 1, "The learner's initial answer should lock before the response.");
  await page.getByRole("button", { name: "Use no response" }).click();
  expect(await page.locator("[data-learning-form='revision']").count() === 1, "The ruling should require a revision before play continues.");
  await page.locator("#revision-reasoning").fill("The ruling turns on the specific forum, timing, and party facts identified by the source.");
  await page.locator("[data-learning-form='revision'] input[value='attack-fails']").check();
  await page.locator("#altered-reasoning").fill("Changing the stated material fact changes how the governing standard applies.");
  await page.locator("[data-learning-form='revision'] button[type='submit']").click();
  expect(await page.getByText("Cycle complete", { exact: true }).count() === 1, "Saving the revision should complete and unblock the learning cycle.");
  await expectAccessible(page, "completed learning cycle");

  await page.goto(`${baseUrl}/guides/`, { waitUntil: "networkidle" });
  await expectAccessible(page, "guide library");
  await page.locator("#guide-search").fill("removal");
  expect((await page.locator("#guide-result-count").textContent()).startsWith("1 of 8"), "Guide search should filter the catalog and announce the result count.");

  for (const sensitivePath of ["/.env", "/ops/", "/scripts/", "/tests/", "/data/"]) {
    const response = await page.request.get(`${baseUrl}${sensitivePath}`);
    expect(response.status() === 404, `${sensitivePath} should not exist in the portable artifact.`);
  }
  expect(consoleErrors.length === 0, `Rendered pages should not emit console errors: ${consoleErrors.join(" | ")}`);
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  await browser?.close();
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
  const result = await new AxeBuilder({ page }).analyze();
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
