import fs from "node:fs";

const html = fs.readFileSync("public/index.html", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const uniqueHtmlIds = new Set(htmlIds);
expect(htmlIds.length === uniqueHtmlIds.size, "index.html should not contain duplicate ids.");

const bindElementsMatch = app.match(/function bindElements\(\) \{[\s\S]*?\]\.forEach/);
expect(Boolean(bindElementsMatch), "app.js bindElements id list could not be found.");

if (bindElementsMatch) {
  const referencedIds = [...bindElementsMatch[0].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  for (const id of referencedIds) {
    expect(uniqueHtmlIds.has(id), `app.js references missing DOM id ${id}.`);
  }
}

expect(/<script type="module" src="app\.js"><\/script>/.test(html), "index.html should load app.js as a module.");
expect(!html.includes('id="test-button"') && !app.includes("showRuleTests"), "The public student toolbar should not expose the developer test runner.");
expect(app.includes("printCards"), "app.js should keep the print deck hook.");
expect(app.includes("startTutorial"), "app.js should keep the tutorial hook.");
expect(app.includes("renderSources"), "app.js should render source cards in the Rule Judge panel.");
expect(app.includes("AUTHORITY_BY_ID"), "Rulings should resolve traceable authority IDs.");
expect(app.includes("renderLearningCycle"), "The app should render committed predictions and revisions.");
expect(app.includes("persistAutosave"), "The app should autosave reproducible sessions locally.");
expect(app.includes("SCENARIO_PACKS"), "app.js should load validated classroom scenario packs.");
expect(app.includes("seededShuffle"), "app.js should use seeded shuffles.");
expect(!app.includes("Math.random"), "app.js should not use unseeded Math.random shuffles.");
expect(app.includes("createSessionSnapshot"), "app.js should support save/load snapshots.");
expect(app.includes("createReplayEnvelope"), "app.js should support replay export.");
expect(app.includes("renderAssessment"), "app.js should render instructor assessment evidence.");
expect(app.includes("renderPlaytestStats"), "app.js should render local-only balance signals.");
expect(app.includes("pack.attackCardIds"), "Printable decks should honor scenario-pack card subsets.");

if (failures.length) {
  console.error("App contract tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("App contract tests passed.");
