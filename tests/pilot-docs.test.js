import fs from "node:fs";
import { SCENARIO_PACKS } from "../public/scenario-packs.generated.js";

const failures = [];
const index = fs.readFileSync("public/index.html", "utf8");
const guideCss = fs.readFileSync("public/guides/guide.css", "utf8");
const guides = {
  instructor: fs.readFileSync("public/guides/instructor-guide.html", "utf8"),
  lessons: fs.readFileSync("public/guides/lesson-plans.html", "utf8"),
  student: fs.readFileSync("public/guides/student-quickstart.html", "utf8")
};

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const filename of ["instructor-guide.html", "student-quickstart.html", "lesson-plans.html"]) {
  expect(index.includes(`guides/${filename}`), `The game should link to ${filename}.`);
}
expect(index.includes("guides/index.html"), "The game should link to the searchable guide library.");

for (const [name, html] of Object.entries(guides)) {
  expect(/<title>[^<]+<\/title>/.test(html), `${name} guide should have a document title.`);
  expect(/<main\b/.test(html), `${name} guide should have a main landmark.`);
  expect(/<nav\b[^>]*aria-label=/.test(html), `${name} guide should have labeled guide navigation.`);
  expect(html.includes('href="guide.css"'), `${name} guide should use the printable guide stylesheet.`);
  expect(html.includes("favicon.svg"), `${name} guide should use the site favicon.`);
  expect(html.includes("skip-link"), `${name} guide should provide a skip link.`);
  expect(html.includes('href="index.html"'), `${name} guide should link to the searchable library.`);
}

expect(guideCss.includes("@media print"), "Pilot guides should have print styling.");

for (const pack of SCENARIO_PACKS) {
  expect(
    guides.lessons.includes(`data-pack="${pack.id}"`),
    `Lesson plans should include scenario pack ${pack.id}.`
  );
}
expect(
  [...guides.lessons.matchAll(/data-pack="([^"]+)"/g)].length === SCENARIO_PACKS.length,
  "Lesson plans should map exactly one row to each validated scenario pack."
);

for (const phrase of [
  "Save / Load",
  "Export / Import replay",
  "Doctrines triggered",
  "Wrong motions or tools",
  "Missing proof",
  "Governing sources",
  "Average round length",
  "Attack success rate",
  "Budget failures",
  "Cases never trial ready",
  "Drawn but never played",
  "stored only in the current browser"
]) {
  expect(guides.instructor.includes(phrase), `Instructor guide should explain ${phrase}.`);
}

for (const phrase of [
  "Plaintiff team",
  "Defense team",
  "The seven-step round",
  "Say the reasoning out loud",
  "learning model, not legal advice"
]) {
  expect(guides.student.includes(phrase), `Student quickstart should include ${phrase}.`);
}

if (failures.length) {
  console.error("Pilot documentation tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot documentation tests passed.");
