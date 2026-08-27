import {
  ATTACK_CARDS,
  CASES,
  MOTION_CARDS,
  PHASES,
  SOURCES,
  TOPIC_MODULES,
  TUTORIAL_STEPS
} from "../public/data.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function idsAreUnique(items, label) {
  const ids = items.map((item) => item.id);
  const unique = new Set(ids);
  expect(ids.length === unique.size, `${label} ids must be unique.`);
}

idsAreUnique(CASES, "Case");
idsAreUnique(ATTACK_CARDS, "Attack card");
idsAreUnique(MOTION_CARDS, "Motion card");

const topicIds = new Set(TOPIC_MODULES.map((topic) => topic.id));
expect(TOPIC_MODULES.some((topic) => topic.default), "At least one topic module must be enabled by default.");
expect(PHASES[0]?.[0] === "claim", "First phase should be claim filing.");
expect(PHASES.at(-1)?.[0] === "trial", "Last phase should be trial ready.");

for (const card of [...ATTACK_CARDS, ...MOTION_CARDS]) {
  expect(topicIds.has(card.topic), `${card.id} uses unknown topic ${card.topic}.`);
  expect(Number.isInteger(card.cost) && card.cost >= 0, `${card.id} must have a nonnegative integer cost.`);
  expect(Boolean(card.title && card.text), `${card.id} must have title and text.`);
}

for (const c of CASES) {
  expect(c.topics.every((topic) => topicIds.has(topic)), `${c.id} has unknown topic.`);
  expect(Boolean(c.title && c.summary && c.type), `${c.id} needs title, summary, and type.`);
  expect(Boolean(c.plaintiff?.name && c.plaintiff?.state), `${c.id} needs plaintiff citizenship.`);
  expect(["state", "federal"].includes(c.court), `${c.id} has invalid starting court.`);
  expect(Boolean(c.forumState && c.eventState), `${c.id} needs forum and event states.`);
  expect(Number.isFinite(c.amount) && c.amount >= 0, `${c.id} needs nonnegative amount in controversy.`);
  expect(Number.isInteger(c.pleadingLevel), `${c.id} needs integer pleading level.`);
  expect(Array.isArray(c.defendants) && c.defendants.length > 0, `${c.id} needs defendants.`);
  expect(Array.isArray(c.evidence) && c.evidence.length > 0, `${c.id} needs discovery proof goals.`);
  idsAreUnique(c.defendants, `${c.id} defendant`);
  idsAreUnique(c.evidence, `${c.id} evidence`);

  for (const d of c.defendants) {
    expect(Boolean(d.name && d.state), `${c.id}/${d.id} needs defendant name and state.`);
    expect(Array.isArray(d.contacts), `${c.id}/${d.id} needs contacts array.`);
    expect(typeof d.sameTransaction === "boolean", `${c.id}/${d.id} needs sameTransaction boolean.`);
  }
}

const attackIds = new Set(ATTACK_CARDS.map((card) => card.id));
const motionAnswers = new Set(
  MOTION_CARDS.filter((card) => card.kind === "motion").flatMap((card) => card.answers || [])
);
for (const attack of ATTACK_CARDS) {
  expect(motionAnswers.has(attack.id), `${attack.id} needs at least one responsive motion card.`);
}
for (const answer of motionAnswers) {
  expect(attackIds.has(answer), `Motion answer ${answer} does not map to an attack card.`);
}

const discoveryTools = new Set(
  MOTION_CARDS.filter((card) => card.kind === "discovery-tool").map((card) => card.tool)
);
const discoveryObjections = new Set(
  MOTION_CARDS.filter((card) => card.kind === "discovery").flatMap((card) => card.answers || [])
);
for (const c of CASES) {
  for (const evidence of c.evidence) {
    expect(discoveryTools.has(evidence.tool), `${c.id}/${evidence.id} uses unsupported discovery tool ${evidence.tool}.`);
    if (evidence.resistance) {
      expect(discoveryObjections.has(evidence.resistance), `${c.id}/${evidence.id} uses unsupported resistance ${evidence.resistance}.`);
    }
  }
}

expect(SOURCES.length >= 20, "Generated source list should include governing doctrine cards.");
for (const source of SOURCES) {
  expect(Boolean(source.id && source.label && source.href && source.officialHref && source.note), `Source card ${source.label || "<missing>"} is incomplete.`);
  expect(/^https:\/\//.test(source.href), `Source ${source.label} should use an HTTPS URL.`);
  expect(/^https:\/\//.test(source.officialHref), `Source ${source.label} should link to an official HTTPS source.`);
  expect(source.authorityType.startsWith("primary-"), `Source ${source.label} should be typed as primary authority.`);
  expect(source.status === "governing", `Source ${source.label} should be marked governing.`);
  expect(source.pinpoint.length > 4 && source.proposition.length > 20, `Source ${source.label} needs a pinpoint and supported proposition.`);
}

expect(TUTORIAL_STEPS.length >= 6, "Tutorial should cover the playable claim-to-trial path.");
for (const step of TUTORIAL_STEPS) {
  expect(Boolean(step.action && step.title && step.body), `Tutorial step ${step.action || "<missing>"} is incomplete.`);
}

if (failures.length) {
  console.error("Data integrity tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Data integrity tests passed.");
