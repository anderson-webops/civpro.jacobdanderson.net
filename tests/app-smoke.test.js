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

  querySelector() {
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
expect(elements.get("judge-output")?.innerHTML.includes("Player 1 is plaintiff"), "Initial render should populate the Rule Judge.");
expect(elements.get("scenario-summary")?.innerHTML.includes("Jurisdiction and Removal"), "Initial render should show the active scenario pack.");
expect(elements.get("seed-input")?.value === "jurisdiction-removal-50-v1", "Initial render should expose the pack seed.");
expect(elements.get("assessment-output")?.innerHTML.includes("Complete a round"), "Initial render should explain when assessment appears.");
expect(elements.get("stats-output")?.innerHTML.includes("No completed rounds"), "Initial render should explain local-only stats.");

const firstClaimHand = elements.get("claim-hand")?.innerHTML;
elements.get("new-game-button")?.eventListeners.get("click")?.();
expect(elements.get("claim-hand")?.innerHTML === firstClaimHand, "Starting again with the same seed should reproduce the claim hand.");

elements.get("save-session-button")?.eventListeners.get("click")?.();
expect(window.localStorage.getItem("civpro.v0.4.saved-session")?.includes('"appVersion":"0.4.0"'), "Save should write a Version 0.4 local snapshot.");
expect(window.localStorage.getItem("civpro.v0.4.saved-session")?.includes('"contentVersion":"2026-08-27.1"'), "Save should identify the content version.");
elements.get("seed-input").value = "changed-seed";
elements.get("new-game-button")?.eventListeners.get("click")?.();
elements.get("load-session-button")?.eventListeners.get("click")?.();
expect(elements.get("seed-input")?.value === "jurisdiction-removal-50-v1", "Load should restore the saved replay seed.");
expect(elements.get("session-status")?.textContent.includes("restored"), "Load should report restored session status.");

if (failures.length) {
  console.error("App smoke tests failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("App smoke tests passed.");
