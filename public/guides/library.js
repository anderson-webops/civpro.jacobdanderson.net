import { LEGAL_REFERENCE_CARDS, LEGAL_SOURCE_CARDS, LEGAL_SOURCE_MANIFEST } from "../legal-sources.generated.js";
import { escapeHtml, safeExternalHref, safeId } from "../safe-html.js";
import { GUIDE_CATEGORIES, GUIDES } from "./catalog.js";

const authorityById = new Map(LEGAL_SOURCE_CARDS.map((source) => [source.id, source]));
const searchInput = document.getElementById("guide-search");
const categorySelect = document.getElementById("guide-category");
const resultCount = document.getElementById("guide-result-count");
const results = document.getElementById("guide-results");

categorySelect.innerHTML = ["All topics", ...GUIDE_CATEGORIES]
  .map((category) => `<option value="${category === "All topics" ? "" : escapeHtml(category)}">${escapeHtml(category)}</option>`)
  .join("");

searchInput.addEventListener("input", renderGuides);
categorySelect.addEventListener("change", renderGuides);

function renderGuides() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const matches = GUIDES.filter((guide) => {
    const haystack = JSON.stringify(guide).toLowerCase();
    return (!category || guide.category === category) && (!query || haystack.includes(query));
  });
  resultCount.textContent = `${matches.length} of ${GUIDES.length} guides shown.`;
  results.innerHTML = matches.length
    ? matches.map(renderGuide).join("")
    : `<div class="callout"><strong>No matching guide.</strong> Try a broader rule number, doctrine, or category.</div>`;
  openHashGuide();
}

function renderGuide(guide) {
  const sources = guide.sourceIds.map((id) => authorityById.get(id)).filter(Boolean);
  return `
    <article id="${safeId(guide.id)}" class="guide-card" data-category="${escapeHtml(guide.category)}">
      <p class="eyeline">${escapeHtml(guide.category)}</p>
      <h2>${escapeHtml(guide.title)}</h2>
      <p class="lede">${escapeHtml(guide.summary)}</p>
      <details>
        <summary>Open complete guide</summary>
        ${renderLabeledList("Governing rules and statutes", guide.governingRules)}
        ${renderLabeledList("Cases", guide.cases)}
        <h3>Professor or course-specific framing</h3>
        <p>${escapeHtml(guide.professorFraming)}</p>
        <h3>Exam strategy</h3>
        <p>${escapeHtml(guide.examStrategy)}</p>
        <h3>Hypothetical</h3>
        <p>${escapeHtml(guide.hypothetical)}</p>
        <h3>Mnemonic</h3>
        <p>${escapeHtml(guide.mnemonic)}</p>
        ${renderLabeledList("Self-check", guide.checklist)}
        <h3>Primary authorities</h3>
        <ul class="authority-list">${sources.map(renderAuthority).join("")}</ul>
      </details>
      <a class="permalink" href="#${safeId(guide.id)}">Link to this guide</a>
    </article>
  `;
}

function renderLabeledList(title, items) {
  return `<h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAuthority(source) {
  return `
    <li>
      <a href="${safeExternalHref(source.officialHref || source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>
      <strong>${escapeHtml(source.pinpoint)}</strong>
      <span>${escapeHtml(source.proposition)}</span>
      ${source.officialHref && source.href !== source.officialHref ? `<a href="${safeExternalHref(source.href)}" target="_blank" rel="noreferrer">Readable explanation</a>` : ""}
    </li>
  `;
}

function openHashGuide() {
  const target = document.getElementById(location.hash.slice(1));
  target?.querySelector("details")?.setAttribute("open", "");
}

function renderSourcePolicy() {
  const review = LEGAL_SOURCE_MANIFEST.sourceReview;
  document.getElementById("source-review-note").textContent = `Governing source review: ${review.reviewedThrough}. ${review.currentRulesNote}`;
  const providers = LEGAL_REFERENCE_CARDS.filter((source) => source.authorityType === "provider-metadata");
  const future = LEGAL_REFERENCE_CARDS.filter((source) => source.authorityType === "future-amendment");
  document.getElementById("source-policy-groups").innerHTML = `
    ${sourcePolicyCard("Primary authority", "Rules, statutes, and cases can support a ruling. Each ruling shows only the authorities active for that result.", LEGAL_SOURCE_CARDS.slice(0, 4))}
    ${sourcePolicyCard("Secondary explanation", "Readable links aid study but do not replace the official source linked first in each authority record.", [])}
    ${sourcePolicyCard("Provider and API metadata", "Provider lanes support reviewed content ingestion. They are not displayed as governing authority.", providers)}
    ${sourcePolicyCard("Future amendments", "Proposals are labeled non-governing and never drive current evaluator logic.", future)}
  `;
  document.getElementById("library-version").textContent = `Content ${review.contentVersion}; reviewed through ${review.reviewedThrough}.`;
}

function sourcePolicyCard(title, description, cards) {
  return `
    <article class="card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${cards.length ? `<ul>${cards.map((card) => `<li><a href="${safeExternalHref(card.officialHref || card.href)}" target="_blank" rel="noreferrer">${escapeHtml(card.label)}</a></li>`).join("")}</ul>` : ""}
    </article>
  `;
}

window.addEventListener("hashchange", openHashGuide);
renderSourcePolicy();
renderGuides();
