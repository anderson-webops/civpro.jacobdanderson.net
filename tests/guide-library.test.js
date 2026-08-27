import fs from "node:fs";
import { LEGAL_SOURCE_CARDS } from "../public/legal-sources.generated.js";
import { GUIDE_CATEGORIES, GUIDES } from "../public/guides/catalog.js";

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const html = fs.readFileSync("public/guides/index.html", "utf8");
const app = fs.readFileSync("public/guides/library.js", "utf8");
const sourceIds = new Set(LEGAL_SOURCE_CARDS.map((source) => source.id));

expect(GUIDES.length === 8, "The library should include exactly eight launch guides.");
expect(GUIDE_CATEGORIES.length === 8, "The guide category list should include all eight requested topics.");
expect(new Set(GUIDES.map((guide) => guide.category)).size === 8, "Each requested category should have a guide.");

for (const guide of GUIDES) {
  for (const field of ["title", "summary", "professorFraming", "examStrategy", "hypothetical", "mnemonic"]) {
    expect(typeof guide[field] === "string" && guide[field].length > 12, `${guide.id} needs a substantive ${field}.`);
  }
  expect(typeof guide.id === "string" && guide.id.length > 4, "Every guide needs a stable id.");
  expect(GUIDE_CATEGORIES.includes(guide.category), `${guide.id} needs a recognized category.`);
  expect(Array.isArray(guide.governingRules) && guide.governingRules.length > 0, `${guide.id} needs governing rules or statutes.`);
  expect(Array.isArray(guide.cases) && guide.cases.length > 0, `${guide.id} needs case framing.`);
  expect(Array.isArray(guide.checklist) && guide.checklist.length >= 5, `${guide.id} needs a five-step self-check.`);
  expect(Array.isArray(guide.sourceIds) && guide.sourceIds.length > 0, `${guide.id} needs traceable source IDs.`);
  for (const sourceId of guide.sourceIds) {
    expect(sourceIds.has(sourceId), `${guide.id} references unknown source ${sourceId}.`);
  }
}

expect(html.includes('id="guide-search"'), "The guide library should expose a search input.");
expect(html.includes('id="guide-category"'), "The guide library should expose a category filter.");
expect(html.includes('aria-live="polite"'), "The result count should announce search changes.");
expect(html.includes("Educational boundary"), "The library should show its educational boundary.");
expect(html.includes("Privacy:"), "The library should show a truthful privacy statement.");
expect(app.includes("LEGAL_REFERENCE_CARDS"), "The source policy should distinguish provider and future-reference cards.");
expect(app.includes("renderAuthority"), "Guide authorities should resolve from traceable source IDs.");

if (failures.length) {
  console.error("Guide library tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Guide library tests passed.");
}
