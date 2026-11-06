import { ATTACK_CARDS, CASES } from "../public/data.js";

const elements = new Map();
const failures = [];

class StubElement {
  constructor(id) {
    this.id = id;
    this.children = [];
    this.checked = false;
    this.disabled = false;
    this.value = "";
    this.files = [];
    this.dataset = {};
    this.eventListeners = new Map();
    this.classList = {
      values: new Set(),
      toggle: (name, force) => {
        if (force === undefined ? !this.classList.values.has(name) : force) {
          this.classList.values.add(name);
        } else {
          this.classList.values.delete(name);
        }
      }
    };
    this._textContent = "";
    this._innerHTML = "";
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return this._textContent;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  addEventListener(event, handler) {
    this.eventListeners.set(event, handler);
  }

  querySelectorAll() {
    return [];
  }

  querySelector(selector) {
    if (selector === "[data-action='next-round']" && this.innerHTML.includes('data-action="next-round"')) {
      const key = `${this.id} ${selector}`;
      if (!elements.has(key)) elements.set(key, new StubElement(key));
      return elements.get(key);
    }
    return null;
  }
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

global.window = {
  setInterval: () => 1,
  clearInterval: () => {},
  print: () => {},
  localStorage: {
    values: new Map(),
    getItem(key) {
      return this.values.has(key) ? this.values.get(key) : null;
    },
    setItem(key, value) {
      this.values.set(key, String(value));
    },
    removeItem(key) {
      this.values.delete(key);
    }
  }
};

global.document = {
  getElementById(id) {
    if (!elements.has(id)) {
      elements.set(id, new StubElement(id));
    }
    return elements.get(id);
  },
  addEventListener(event, handler) {
    if (event === "DOMContentLoaded") {
      handler();
    }
  }
};

await import("../public/app.js");

expect(elements.get("player-one-score")?.textContent === "0", "Initial render should set player one score.");
expect(elements.get("player-two-score")?.textContent === "0", "Initial render should set player two score.");
expect(elements.get("round-value")?.textContent === "1", "Initial render should set round one.");
expect(elements.get("roles-value")?.textContent.includes("plaintiff"), "Initial render should show player roles.");
expect(elements.get("claim-hand")?.innerHTML.includes("playing-card"), "Initial render should draw claim cards.");
expect(elements.get("attack-hand")?.innerHTML.includes("playing-card"), "Initial render should draw attack cards.");
expect(elements.get("motion-hand")?.innerHTML.includes("playing-card"), "Initial render should draw motion cards.");
expect(elements.get("source-list")?.innerHTML.includes("No governing authority"), "Initial bench notes should not display unrelated authority cards.");
expect(elements.get("judge-output")?.innerHTML.includes("No ruling yet"), "Initial render should populate the Rule Judge.");
expect(elements.get("scenario-summary")?.innerHTML.includes("Jurisdiction and Removal"), "Initial render should show the active scenario pack.");
expect(elements.get("seed-input")?.value === "jurisdiction-removal-50-v1", "Initial render should expose the pack seed.");
expect(elements.get("assessment-output")?.innerHTML.includes("No completed round"), "Initial render should show the empty assessment state.");
expect(elements.get("stats-output")?.innerHTML.includes("No completed rounds"), "Initial render should explain local-only stats.");

const firstClaimHand = elements.get("claim-hand")?.innerHTML;
elements.get("new-game-button")?.eventListeners.get("click")?.();
expect(elements.get("claim-hand")?.innerHTML === firstClaimHand, "Starting again with the same seed should reproduce the claim hand.");

elements.get("save-session-button")?.eventListeners.get("click")?.();
expect(window.localStorage.getItem("civpro.v0.4.saved-session")?.includes('"appVersion":"0.4.5"'), "Save should write a Version 0.4.5 local snapshot.");
expect(window.localStorage.getItem("civpro.v0.4.saved-session")?.includes('"contentVersion":"2026-08-27.1"'), "Save should identify the content version.");
elements.get("seed-input").value = "changed-seed";
elements.get("new-game-button")?.eventListeners.get("click")?.();
elements.get("load-session-button")?.eventListeners.get("click")?.();
expect(elements.get("seed-input")?.value === "jurisdiction-removal-50-v1", "Load should restore the saved replay seed.");
expect(elements.get("session-status")?.textContent.includes("restored"), "Load should report restored session status.");

function currentSnapshot() {
  elements.get("save-session-button").eventListeners.get("click")();
  return JSON.parse(window.localStorage.getItem("civpro.v0.4.saved-session"));
}

function loadSnapshot(value) {
  window.localStorage.setItem("civpro.v0.4.saved-session", JSON.stringify(value));
  elements.get("load-session-button").eventListeners.get("click")();
  expect(elements.get("session-status").textContent.includes("restored"), "A bounded high-counter snapshot should remain reloadable.");
}

const counterBaseline = currentSnapshot();
const malformedEventCounter = structuredClone(counterBaseline);
malformedEventCounter.state.eventSequence = { valueOf: 0, toString: 0 };
window.localStorage.setItem("civpro.v0.4.saved-session", JSON.stringify(malformedEventCounter));
elements.get("load-session-button").eventListeners.get("click")();
expect(elements.get("session-status").textContent.includes("could not be loaded"), "Malformed event counters must be rejected before restoring state.");
expect(JSON.stringify(currentSnapshot().state) === JSON.stringify(counterBaseline.state), "A rejected event counter must preserve the current game.");
for (const sequence of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]) {
  const candidate = structuredClone(counterBaseline);
  candidate.state.sequence = sequence;
  candidate.state.hands.attacks = [];
  candidate.state.decks.attacks = structuredClone(ATTACK_CARDS.slice(0, 2));
  candidate.state.phase = "attack";
  candidate.state.activeCase = structuredClone(CASES[0]);
  candidate.state.selectedDefendantId = CASES[0].defendants[0].id;
  loadSnapshot(candidate);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      elements.get("draw-attack-button").eventListeners.get("click")();
    } catch (error) {
      failures.push(`Counter exhaustion must not throw or lose deck cards: ${error.message}`);
    }
  }
  expect(elements.get("session-status").textContent.includes("identifiers exhausted"), "An exhausted draw must report the recoverable limit.");
  const saved = currentSnapshot();
  const draws = sequence === Number.MAX_SAFE_INTEGER ? 0 : 1;
  expect(saved.state.sequence === Number.MAX_SAFE_INTEGER, "Draws must retain a safe next counter.");
  expect(saved.state.hands.attacks.length === draws && saved.state.decks.attacks.length === 2 - draws,
    "A refused draw must preserve the deck and hand atomically.");
  loadSnapshot(saved);
  if (draws) {
    const reloaded = currentSnapshot();
    elements.get("exchange-attack-card").value = saved.state.hands.attacks[0].instanceId;
    try {
      elements.get("exchange-attack-button").eventListeners.get("click")();
    } catch (error) {
      failures.push(`Exhausted exchange must not throw: ${error.message}`);
    }
    expect(JSON.stringify(currentSnapshot().state) === JSON.stringify(reloaded.state), "A refused exchange must preserve the complete saved state.");
  }
}
const exhaustedRound = structuredClone(counterBaseline);
exhaustedRound.state.sequence = Number.MAX_SAFE_INTEGER - 2;
exhaustedRound.state.phase = "trial";
exhaustedRound.state.activeCase = structuredClone(CASES[0]);
exhaustedRound.state.selectedDefendantId = CASES[0].defendants[0].id;
loadSnapshot(exhaustedRound);
const beforeRound = currentSnapshot();
try {
  elements.get("active-case [data-action='next-round']").eventListeners.get("click")();
} catch (error) {
  failures.push(`An exhausted round transition must not throw: ${error.message}`);
}
expect(JSON.stringify(currentSnapshot().state) === JSON.stringify(beforeRound.state), "An exhausted round transition must preserve roles, round, hands and metrics.");

if (failures.length) {
  console.error("App smoke tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("App smoke tests passed.");
