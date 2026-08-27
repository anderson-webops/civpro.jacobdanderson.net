export const REQUIRED_ENV_KEYS = [
  {
    key: "GOVINFO_API_KEY",
    provider: "govinfo",
    reason: "Fetch official federal package and collection metadata from govinfo."
  },
  {
    key: "COURTLISTENER_API_TOKEN",
    provider: "courtlistener",
    reason: "Fetch court opinions, dockets, and RECAP-backed examples from CourtListener."
  },
  {
    key: "CONGRESS_API_KEY",
    provider: "congress",
    reason: "Fetch federal bill and legislative-history metadata from Congress.gov."
  },
  {
    key: "OPENSTATES_API_KEY",
    provider: "openstates",
    reason: "Fetch state legislative metadata for future state-procedure expansions."
  },
  {
    key: "PACER_USERNAME",
    provider: "pacer",
    reason: "Optional direct PACER access for docket material; use only in server-side import jobs."
  },
  {
    key: "PACER_PASSWORD",
    provider: "pacer",
    reason: "Optional direct PACER access for docket material; use only in server-side import jobs."
  }
];

export const SOURCE_PROVIDERS = [
  {
    id: "frcp-official",
    label: "U.S. Courts Federal Rules of Civil Procedure",
    type: "official-page",
    href: "https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-civil-procedure",
    envKeys: [],
    gameUse: "Canonical FRCP reference point for rule text, pending amendments, and committee materials."
  },
  {
    id: "cornell-lii",
    label: "Cornell Legal Information Institute",
    type: "public-web",
    href: "https://www.law.cornell.edu/rules/frcp",
    envKeys: [],
    gameUse: "Readable rule and statute pages for in-game source links and student-facing doctrine notes."
  },
  {
    id: "courtlistener",
    label: "CourtListener REST API",
    type: "api",
    href: "https://www.courtlistener.com/help/api/rest/",
    envKeys: ["COURTLISTENER_API_TOKEN"],
    gameUse: "Opinion and docket examples for procedural-card fact patterns."
  },
  {
    id: "govinfo",
    label: "govinfo API",
    type: "api",
    href: "https://api.govinfo.gov/docs",
    envKeys: ["GOVINFO_API_KEY"],
    gameUse: "Official federal package metadata for the U.S. Code, Federal Register, and rulemaking materials."
  },
  {
    id: "federal-register",
    label: "FederalRegister.gov API",
    type: "api",
    href: "https://www.federalregister.gov/developers/documentation/api/v1",
    envKeys: [],
    gameUse: "No-key public API for rulemaking notices and regulatory context."
  },
  {
    id: "ecfr",
    label: "eCFR API",
    type: "api",
    href: "https://www.ecfr.gov/developers/documentation/api/v1",
    envKeys: [],
    gameUse: "No-key public API for CFR snapshots and future regulation-based scenarios."
  },
  {
    id: "congress",
    label: "Congress.gov API",
    type: "api",
    href: "https://api.congress.gov/",
    envKeys: ["CONGRESS_API_KEY"],
    gameUse: "Legislative metadata for statutes, amendments, and future statutory-civil-procedure modules."
  },
  {
    id: "openstates",
    label: "Open States API v3",
    type: "api",
    href: "https://docs.openstates.org/api-v3/",
    envKeys: ["OPENSTATES_API_KEY"],
    gameUse: "State legislative material for later state-court and state-procedure modules."
  },
  {
    id: "pacer",
    label: "PACER / RECAP source path",
    type: "restricted-api",
    href: "https://pacer.uscourts.gov/",
    envKeys: ["PACER_USERNAME", "PACER_PASSWORD"],
    gameUse: "Optional server-side direct import path. Prefer CourtListener/RECAP first because direct PACER can be credentialed and fee-bearing."
  }
];

const FRCP_OFFICIAL = "https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-civil-procedure";
const REVIEWED_THROUGH = "2026-08-27";
const houseCodeUrl = (section) => `https://uscode.house.gov/view.xhtml?req=%28title%3A28+section%3A${section}+edition%3Aprelim%29`;

export const SOURCE_REVIEW = {
  contentVersion: "2026-08-27.1",
  reviewedThrough: REVIEWED_THROUGH,
  currentRulesNote: "Current Federal Rules of Civil Procedure page reviewed; the rules page reports rules last amended in 2025.",
  currentRulesHref: FRCP_OFFICIAL,
  pendingAmendmentsNote: "The August 2026 preliminary draft includes proposed civil amendments for a later effective date. Proposed text is not treated as governing law in the simulator.",
  pendingAmendmentsHref: "https://www.uscourts.gov/forms-rules/pending-rules-and-forms-amendments"
};

const ruleSource = (number, topic, pinpoint, proposition, gameUse) => ({
  id: `frcp-${number}`,
  citation: `FRCP ${number}`,
  provider: "cornell-lii",
  authorityType: "primary-rule",
  status: "governing",
  href: `https://www.law.cornell.edu/rules/frcp/rule_${number}`,
  officialHref: FRCP_OFFICIAL,
  topic,
  pinpoint,
  proposition,
  gameUse,
  reviewedThrough: REVIEWED_THROUGH
});

const statuteSource = (section, topic, pinpoint, proposition, gameUse) => ({
  id: `usc-28-${section}`,
  citation: `28 U.S.C. ${section}`,
  provider: "cornell-lii",
  authorityType: "primary-statute",
  status: "governing",
  href: `https://www.law.cornell.edu/uscode/text/28/${section}`,
  officialHref: houseCodeUrl(section),
  topic,
  pinpoint,
  proposition,
  gameUse,
  reviewedThrough: REVIEWED_THROUGH
});

const caseSource = (id, citation, officialHref, readableHref, topic, pinpoint, proposition, gameUse) => ({
  id,
  citation,
  provider: "library-of-congress",
  authorityType: "primary-case",
  status: "governing",
  href: readableHref,
  officialHref,
  topic,
  pinpoint,
  proposition,
  gameUse,
  reviewedThrough: REVIEWED_THROUGH
});

export const DOCTRINE_SOURCES = [
  ruleSource("4", "Service of process", "Rule 4(c), (e), (h), and (m)", "Rule 4 governs service of process and the time for service.", "Service challenges and cure-service responses."),
  ruleSource("8", "Pleading baseline", "Rule 8(a)", "A complaint must contain a short and plain statement of jurisdiction, claim, and requested relief.", "Complaint-sufficiency analysis."),
  ruleSource("12", "Threshold defenses and waiver", "Rule 12(b), (g), and (h)", "Rule 12 identifies threshold defenses and controls consolidation and waiver of waivable defenses.", "Attack timing, motion responses, and waiver."),
  ruleSource("13", "Counterclaims and crossclaims", "Rule 13(a), (b), and (g)", "Rule 13 distinguishes compulsory and permissive counterclaims and authorizes qualifying crossclaims.", "Future counterclaim expansion."),
  ruleSource("14", "Third-party practice", "Rule 14(a)", "Rule 14 governs when a defending party may bring in a nonparty who may be liable for all or part of the claim.", "Future impleader expansion."),
  ruleSource("15", "Amended and supplemental pleadings", "Rule 15(a) and (c)", "Rule 15 governs amendment and relation back.", "Leave-to-amend responses."),
  ruleSource("18", "Claim joinder", "Rule 18(a)", "A party asserting a claim may join as many claims as it has against an opposing party.", "Claim-stacking decisions."),
  ruleSource("19", "Required party joinder", "Rule 19(a) and (b)", "Rule 19 identifies required parties and the consequences when joinder is not feasible.", "Required-party analysis."),
  ruleSource("20", "Permissive party joinder", "Rule 20(a)", "Parties may be joined when claims arise from the same transaction or occurrence and share a common question.", "Party-joinder cards."),
  ruleSource("23", "Class actions", "Rule 23(a) and (b)", "A class must satisfy Rule 23(a) and fit at least one Rule 23(b) category.", "Class-certification preview."),
  ruleSource("26", "Discovery scope and disclosures", "Rule 26(a), (b)(1), and (b)(5)", "Discovery must be relevant, nonprivileged, and proportional, with specified disclosure and privilege procedures.", "Discovery scope, objections, and expert proof."),
  ruleSource("30", "Depositions", "Rule 30(a) and (b)", "Rule 30 governs oral depositions and notice.", "Deposition discovery cards."),
  ruleSource("34", "Requests for production", "Rule 34(a) and (b)", "Rule 34 governs requests for documents, ESI, tangible things, and property inspection.", "Production-request cards."),
  ruleSource("36", "Requests for admission", "Rule 36(a) and (b)", "Rule 36 permits requests to admit and gives admissions conclusive effect in the action unless withdrawn or amended.", "Admission and narrowing cards."),
  ruleSource("37", "Discovery enforcement", "Rule 37(a) and (b)", "Rule 37 governs motions to compel and sanctions for discovery failures.", "Motions to compel and sanctions responses."),
  ruleSource("56", "Summary judgment", "Rule 56(a) and (c)", "Summary judgment depends on the cited record and the absence of a genuine dispute of material fact.", "End-of-discovery Rule 56 attacks."),
  statuteSource("1331", "Federal-question jurisdiction", "Section 1331", "District courts have original jurisdiction over civil actions arising under federal law.", "Federal-question cases and anchor claims."),
  statuteSource("1332", "Diversity jurisdiction", "Section 1332(a)", "Diversity jurisdiction requires qualifying citizenship and an amount in controversy exceeding $75,000.", "Complete-diversity and amount checks."),
  statuteSource("1367", "Supplemental jurisdiction", "Section 1367(a) and (b)", "Supplemental jurisdiction generally extends to related claims within the same Article III case, subject to statutory limits.", "Tagalong-claim analysis."),
  statuteSource("1391", "Venue", "Section 1391(b) and (c)", "Section 1391 supplies the general venue rules and entity-residence definitions.", "Venue and transfer decisions."),
  statuteSource("1441", "Removal", "Section 1441(a) and (b)(2)", "Removal requires original federal jurisdiction, and the forum-defendant restriction applies only when removal is based solely on diversity.", "Removal, forum-defendant, and remand play."),
  statuteSource("1446", "Removal procedure", "Section 1446(a), (b), and (c)", "Section 1446 governs the notice, timing, and specified procedures for removal.", "Removal timing variants."),
  caseSource(
    "case-international-shoe",
    "International Shoe Co. v. Washington, 326 U.S. 310 (1945)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep326/usrep326310/usrep326310.pdf",
    "https://www.law.cornell.edu/supremecourt/text/326/310",
    "Personal jurisdiction",
    "326 U.S. at 316-19",
    "Due process permits personal jurisdiction when forum contacts make suit consistent with traditional notions of fair play and substantial justice.",
    "Personal-jurisdiction attacks."
  ),
  caseSource(
    "case-erie",
    "Erie Railroad Co. v. Tompkins, 304 U.S. 64 (1938)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep304/usrep304064/usrep304064.pdf",
    "https://www.law.cornell.edu/supremecourt/text/304/64",
    "Erie doctrine",
    "304 U.S. at 78-80",
    "Federal courts exercising diversity jurisdiction apply state substantive law.",
    "Erie preview rulings."
  ),
  caseSource(
    "case-hanna",
    "Hanna v. Plumer, 380 U.S. 460 (1965)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep380/usrep380460/usrep380460.pdf",
    "https://www.law.cornell.edu/supremecourt/text/380/460",
    "Erie and federal rules",
    "380 U.S. at 469-74",
    "A valid Federal Rule governs when it directly addresses the procedural issue within the Rules Enabling Act and constitutional bounds.",
    "Erie guide analysis."
  ),
  caseSource(
    "case-mottley",
    "Louisville & Nashville Railroad Co. v. Mottley, 211 U.S. 149 (1908)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep211/usrep211149/usrep211149.pdf",
    "https://www.law.cornell.edu/supremecourt/text/211/149",
    "Federal-question jurisdiction",
    "211 U.S. at 152-54",
    "Federal-question jurisdiction ordinarily must appear on the face of the plaintiff's well-pleaded complaint.",
    "Jurisdiction guide analysis."
  ),
  caseSource(
    "case-gibbs",
    "United Mine Workers v. Gibbs, 383 U.S. 715 (1966)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep383/usrep383715/usrep383715.pdf",
    "https://www.law.cornell.edu/supremecourt/text/383/715",
    "Supplemental jurisdiction",
    "383 U.S. at 725-27",
    "Related federal and state claims may form one constitutional case when they share a common nucleus of operative fact.",
    "Supplemental-jurisdiction guide analysis."
  ),
  caseSource(
    "case-twombly",
    "Bell Atlantic Corp. v. Twombly, 550 U.S. 544 (2007)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep550/usrep550544/usrep550544.pdf",
    "https://www.law.cornell.edu/supct/html/05-1126.ZO.html",
    "Pleading sufficiency",
    "550 U.S. at 555-70",
    "A complaint needs enough factual matter to plausibly suggest entitlement to relief, not labels or a formulaic recitation.",
    "Pleading guide analysis."
  ),
  caseSource(
    "case-celotex",
    "Celotex Corp. v. Catrett, 477 U.S. 317 (1986)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep477/usrep477317/usrep477317.pdf",
    "https://www.law.cornell.edu/supremecourt/text/477/317",
    "Summary judgment",
    "477 U.S. at 322-25",
    "A summary-judgment movant may identify an absence of evidence supporting the nonmovant's case.",
    "Rule 56 guide analysis."
  ),
  caseSource(
    "case-wal-mart",
    "Wal-Mart Stores, Inc. v. Dukes, 564 U.S. 338 (2011)",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep564/usrep564338/usrep564338.pdf",
    "https://www.law.cornell.edu/supct/html/10-277.ZO.html",
    "Class actions",
    "564 U.S. at 349-60",
    "Rule 23(a)(2) commonality requires a common contention capable of classwide resolution.",
    "Class-actions guide analysis."
  )
];

export const LIVE_PROBES = [
  {
    id: "courtlistener-rule-12-search",
    provider: "courtlistener",
    label: "CourtListener Rule 12 opinion search",
    envKeys: ["COURTLISTENER_API_TOKEN"],
    method: "GET",
    url: "https://www.courtlistener.com/api/rest/v4/search/",
    query: {
      q: "\"Rule 12(b)(6)\" \"motion to dismiss\"",
      type: "o",
      page_size: "3"
    },
    headers: {
      Authorization: "Token ${COURTLISTENER_API_TOKEN}"
    },
    gameUse: "Seed real-world motion-to-dismiss example fact patterns."
  },
  {
    id: "govinfo-uscode-collection",
    provider: "govinfo",
    label: "govinfo U.S. Code collection probe",
    envKeys: ["GOVINFO_API_KEY"],
    method: "GET",
    url: "https://api.govinfo.gov/collections/USCODE/2024-01-01T00:00:00Z",
    query: {
      pageSize: "3",
      offsetMark: "*",
      api_key: "${GOVINFO_API_KEY}"
    },
    gameUse: "Verify official U.S. Code package access before statute ingestion."
  },
  {
    id: "federal-register-civil-procedure",
    provider: "federal-register",
    label: "Federal Register civil procedure document probe",
    envKeys: [],
    method: "GET",
    url: "https://www.federalregister.gov/api/v1/documents.json",
    query: {
      "conditions[term]": "\"civil procedure\"",
      per_page: "3",
      order: "newest"
    },
    gameUse: "Find rulemaking context and amendment notices."
  },
  {
    id: "ecfr-title-index",
    provider: "ecfr",
    label: "eCFR title index probe",
    envKeys: [],
    method: "GET",
    url: "https://www.ecfr.gov/api/versioner/v1/titles.json",
    query: {},
    gameUse: "Verify public CFR metadata access for future regulation cards."
  },
  {
    id: "congress-bill-index",
    provider: "congress",
    label: "Congress.gov recent bill probe",
    envKeys: ["CONGRESS_API_KEY"],
    method: "GET",
    url: "https://api.congress.gov/v3/bill",
    query: {
      limit: "3",
      api_key: "${CONGRESS_API_KEY}"
    },
    gameUse: "Verify legislative metadata access for statutory-update modules."
  },
  {
    id: "openstates-jurisdictions",
    provider: "openstates",
    label: "Open States jurisdiction probe",
    envKeys: ["OPENSTATES_API_KEY"],
    method: "GET",
    url: "https://v3.openstates.org/jurisdictions",
    query: {},
    headers: {
      "X-API-KEY": "${OPENSTATES_API_KEY}"
    },
    gameUse: "Verify state-legislative metadata access for state-court expansions."
  },
  {
    id: "pacer-account-config",
    provider: "pacer",
    label: "PACER account configuration check",
    envKeys: ["PACER_USERNAME", "PACER_PASSWORD"],
    method: "MANUAL",
    url: "https://pacer.uscourts.gov/",
    query: {},
    restricted: true,
    gameUse: "Confirm PACER account fields are present without performing direct PACER access."
  }
];
