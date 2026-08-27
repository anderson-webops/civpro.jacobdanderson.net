import { LEGAL_REFERENCE_CARDS, LEGAL_SOURCE_CARDS, LEGAL_SOURCE_MANIFEST } from "./legal-sources.generated.js";
import { REVIEWED_CASES, REVIEWED_SOURCE_CARDS } from "./game-artifacts.generated.js";

export const SOURCES = LEGAL_SOURCE_CARDS;
export const SOURCE_REFERENCES = [
  ...LEGAL_REFERENCE_CARDS,
  ...REVIEWED_SOURCE_CARDS.map((source, index) => ({
    id: `reviewed-provider-lane-${index + 1}`,
    authorityType: "provider-metadata",
    status: "reference-only",
    ...source
  }))
];
export const LEGAL_SOURCE_REVIEW = LEGAL_SOURCE_MANIFEST.sourceReview;

export const PHASES = [
  ["claim", "File Claim"],
  ["defendant", "Pick Defendant"],
  ["attack", "Rule 12 / Removal"],
  ["response", "Motion Response"],
  ["discovery", "Discovery"],
  ["summary", "Summary Judgment"],
  ["trial", "Trial Ready"]
];

export const TOPIC_MODULES = [
  { id: "jurisdiction", label: "Jurisdiction and removal", default: true },
  { id: "service", label: "Service of process", default: true },
  { id: "joinder", label: "Claim and party joinder", default: true },
  { id: "supplemental", label: "Supplemental jurisdiction", default: true },
  { id: "discovery", label: "Discovery and Rule 56", default: true },
  { id: "erie", label: "Erie preview", default: false },
  { id: "class-actions", label: "Class actions preview", default: false, preview: true }
];

const CORE_CASES = [
  {
    id: "tire-failure",
    topics: ["jurisdiction", "joinder", "discovery"],
    title: "Interstate Tire Failure",
    type: "Products liability",
    plaintiff: { name: "Riley Driver", state: "OK" },
    forumState: "OK",
    court: "state",
    eventState: "OK",
    amount: 120000,
    federalQuestion: false,
    pleadingLevel: 2,
    serviceProper: true,
    venueFacts: "Crash and injury treatment happened in Oklahoma.",
    summary: "An Oklahoma driver alleges a highway blowout caused serious injuries.",
    defendants: [
      {
        id: "tireco",
        name: "TireCo Manufacturing",
        state: "DE",
        ppb: "PA",
        contacts: ["OK", "PA", "DE"],
        role: "Designed and shipped the tire line nationwide, including Oklahoma.",
        sameTransaction: true
      },
      {
        id: "carco",
        name: "CarCo Motors",
        state: "MI",
        ppb: "MI",
        contacts: ["OK", "MI"],
        role: "Sold the vehicle through authorized Oklahoma dealers.",
        sameTransaction: true
      },
      {
        id: "roadworks",
        name: "RoadWorks Engineering",
        state: "OK",
        ppb: "OK",
        contacts: ["OK"],
        role: "Maintained the construction zone where the crash happened.",
        sameTransaction: true,
        forumDefendant: true
      }
    ],
    evidence: [
      {
        id: "engineer-depo",
        title: "Engineer deposition",
        tool: "deposition",
        description: "Pin down defect knowledge and alternative designs."
      },
      {
        id: "quality-docs",
        title: "Quality-control documents",
        tool: "rfp",
        description: "Request production of internal defect reports.",
        resistance: "burden"
      },
      {
        id: "expert-report",
        title: "Expert report",
        tool: "expert",
        description: "Connect the failure mode to causation and damages."
      }
    ]
  },
  {
    id: "wage-platform",
    topics: ["jurisdiction", "supplemental", "discovery"],
    title: "Platform Wage Claim",
    type: "Federal statutory claim",
    plaintiff: { name: "Dana Courier", state: "GA" },
    forumState: "GA",
    court: "federal",
    eventState: "GA",
    amount: 18000,
    federalQuestion: true,
    pleadingLevel: 2,
    serviceProper: true,
    supplementalClaim: {
      title: "State wage-law tagalong",
      related: true,
      anchorFederal: true
    },
    venueFacts: "Work, records, and supervisors are centered in Georgia.",
    summary: "A courier sues a delivery platform under a federal wage statute and related state wage law.",
    defendants: [
      {
        id: "deliverly",
        name: "Deliverly Inc.",
        state: "DE",
        ppb: "CA",
        contacts: ["GA", "CA", "DE"],
        role: "Operates the app and driver policies in Georgia.",
        sameTransaction: true
      },
      {
        id: "local-franchise",
        name: "Atlanta Dispatch LLC",
        state: "GA",
        ppb: "GA",
        contacts: ["GA"],
        role: "Local contractor that controlled route assignments.",
        sameTransaction: true,
        forumDefendant: true
      },
      {
        id: "payroll-vendor",
        name: "Payroll Vendor Co.",
        state: "TX",
        ppb: "TX",
        contacts: ["TX"],
        role: "Processed payroll from Texas with no Georgia-facing operations.",
        sameTransaction: false
      }
    ],
    evidence: [
      {
        id: "driver-data",
        title: "Driver app data",
        tool: "rfp",
        description: "Collect hours, routes, and pay calculations."
      },
      {
        id: "manager-depo",
        title: "Manager deposition",
        tool: "deposition",
        description: "Test control over the courier's work."
      },
      {
        id: "policy-admission",
        title: "Classification admission",
        tool: "admission",
        description: "Narrow whether the worker was treated as a contractor."
      }
    ]
  },
  {
    id: "software-contract",
    topics: ["jurisdiction", "service", "discovery"],
    title: "Broken SaaS Rollout",
    type: "Contract",
    plaintiff: { name: "Harbor Clinic", state: "WA" },
    forumState: "WA",
    court: "state",
    eventState: "WA",
    amount: 69000,
    federalQuestion: false,
    pleadingLevel: 1,
    serviceProper: false,
    venueFacts: "Implementation meetings and the failed deployment were in Washington.",
    summary: "A clinic sues after an electronic-records platform fails before launch, but service is defective.",
    defendants: [
      {
        id: "cloudscribe",
        name: "CloudScribe LLC",
        state: "OR",
        ppb: "OR",
        contacts: ["WA", "OR"],
        role: "Sent implementation staff into Washington and negotiated there.",
        sameTransaction: true
      },
      {
        id: "consultant",
        name: "Cascade IT Consulting",
        state: "WA",
        ppb: "WA",
        contacts: ["WA"],
        role: "Local integration consultant named in the same rollout failure.",
        sameTransaction: true,
        forumDefendant: true
      },
      {
        id: "security-auditor",
        name: "Lone Star Security",
        state: "TX",
        ppb: "TX",
        contacts: ["TX"],
        role: "Remote auditor with a thin relationship to the disputed contract.",
        sameTransaction: false
      }
    ],
    evidence: [
      {
        id: "contract-redlines",
        title: "Contract redlines",
        tool: "rfp",
        description: "Show scope, deadline, and breach terms."
      },
      {
        id: "implementation-depo",
        title: "Implementation lead deposition",
        tool: "deposition",
        description: "Establish missed milestones and notice."
      },
      {
        id: "damages-calculation",
        title: "Damages calculation",
        tool: "expert",
        description: "Support lost revenue and replacement costs."
      }
    ]
  },
  {
    id: "defamation-stream",
    topics: ["jurisdiction", "discovery"],
    title: "Viral Defamation Stream",
    type: "Defamation",
    plaintiff: { name: "Mina Founder", state: "NY" },
    forumState: "NY",
    court: "state",
    eventState: "NY",
    amount: 250000,
    federalQuestion: false,
    pleadingLevel: 2,
    serviceProper: true,
    venueFacts: "Plaintiff resides in New York and alleges reputational harm there.",
    summary: "A founder sues over statements made during a livestream about her company.",
    defendants: [
      {
        id: "streamer",
        name: "Westcast Media",
        state: "CA",
        ppb: "CA",
        contacts: ["CA", "NY"],
        role: "Sold subscriptions and targeted New York viewers.",
        sameTransaction: true
      },
      {
        id: "guest",
        name: "Guest Analyst",
        state: "FL",
        ppb: "FL",
        contacts: ["FL"],
        role: "One-time guest with no New York targeting beyond the stream.",
        sameTransaction: true
      },
      {
        id: "ny-sponsor",
        name: "Hudson Sponsor LLC",
        state: "NY",
        ppb: "NY",
        contacts: ["NY"],
        role: "New York sponsor alleged to have republished clips.",
        sameTransaction: true,
        forumDefendant: true
      }
    ],
    evidence: [
      {
        id: "analytics",
        title: "Audience analytics",
        tool: "rfp",
        description: "Show forum targeting and scope of publication.",
        resistance: "privacy"
      },
      {
        id: "host-depo",
        title: "Host deposition",
        tool: "deposition",
        description: "Explore knowledge, fault, and source checking."
      },
      {
        id: "admission-falsity",
        title: "Admission on falsity",
        tool: "admission",
        description: "Lock down whether key statements are disputed."
      }
    ]
  },
  {
    id: "data-breach",
    topics: ["jurisdiction", "erie", "discovery"],
    title: "Bank Data Breach",
    type: "Negligence / consumer claim",
    plaintiff: { name: "Pat Account Holder", state: "IL" },
    forumState: "IL",
    court: "federal",
    eventState: "IL",
    amount: 82000,
    federalQuestion: false,
    pleadingLevel: 1,
    serviceProper: true,
    stateLawConflict: true,
    venueFacts: "The account holder banked in Illinois; breach response was nationwide.",
    summary: "A bank customer alleges negligent security after identity-theft losses in a federal diversity case.",
    defendants: [
      {
        id: "bank",
        name: "MetroBank NA",
        state: "DE",
        ppb: "NY",
        contacts: ["IL", "NY", "DE"],
        role: "Maintained Illinois accounts and branches.",
        sameTransaction: true
      },
      {
        id: "processor",
        name: "Card Processor Inc.",
        state: "NJ",
        ppb: "NJ",
        contacts: ["NJ", "IL"],
        role: "Processed the affected transactions.",
        sameTransaction: true
      },
      {
        id: "local-branch",
        name: "Chicago Branch Services",
        state: "IL",
        ppb: "IL",
        contacts: ["IL"],
        role: "Local affiliate named for account support failures.",
        sameTransaction: true,
        forumDefendant: true
      }
    ],
    evidence: [
      {
        id: "security-audit",
        title: "Security audit",
        tool: "rfp",
        description: "Request breach-risk and remediation records.",
        resistance: "privilege"
      },
      {
        id: "ciso-depo",
        title: "CISO deposition",
        tool: "deposition",
        description: "Establish standard of care and breach response."
      },
      {
        id: "loss-proof",
        title: "Loss records",
        tool: "rfp",
        description: "Prove causation and amount in controversy."
      }
    ]
  },
  {
    id: "festival-injury",
    topics: ["jurisdiction", "joinder", "discovery"],
    title: "Festival Stage Collapse",
    type: "Premises / negligence",
    plaintiff: { name: "Noah Attendee", state: "TN" },
    forumState: "TN",
    court: "state",
    eventState: "TN",
    amount: 155000,
    federalQuestion: false,
    pleadingLevel: 2,
    serviceProper: true,
    venueFacts: "The collapse and witnesses are in Tennessee.",
    summary: "A concertgoer sues after a temporary stage collapses during a storm.",
    defendants: [
      {
        id: "festival",
        name: "Riverfront Festival LLC",
        state: "TN",
        ppb: "TN",
        contacts: ["TN"],
        role: "Local event organizer and forum defendant.",
        sameTransaction: true,
        forumDefendant: true
      },
      {
        id: "stage-builder",
        name: "StageBuild Corp.",
        state: "IN",
        ppb: "IN",
        contacts: ["TN", "IN"],
        role: "Built the temporary stage in Tennessee.",
        sameTransaction: true
      },
      {
        id: "weather-vendor",
        name: "Weather Alerts Ltd.",
        state: "CO",
        ppb: "CO",
        contacts: ["CO"],
        role: "Remote warning vendor with limited Tennessee contacts.",
        sameTransaction: false
      }
    ],
    evidence: [
      {
        id: "inspection-photos",
        title: "Inspection photos",
        tool: "rfp",
        description: "Show the condition of the stage before collapse."
      },
      {
        id: "site-manager-depo",
        title: "Site manager deposition",
        tool: "deposition",
        description: "Establish notice of weather and structural issues."
      },
      {
        id: "engineering-report",
        title: "Engineering report",
        tool: "expert",
        description: "Tie collapse mechanics to negligent construction."
      }
    ]
  },
  {
    id: "unrelated-tagalong",
    topics: ["supplemental", "discovery"],
    title: "Whistleblower Plus Rent Dispute",
    type: "Federal claim with unrelated state claim",
    plaintiff: { name: "Casey Analyst", state: "CO" },
    forumState: "CO",
    court: "federal",
    eventState: "CO",
    amount: 42000,
    federalQuestion: true,
    pleadingLevel: 2,
    serviceProper: true,
    supplementalClaim: {
      title: "Unrelated apartment deposit claim",
      related: false,
      anchorFederal: true
    },
    venueFacts: "The employment claim is in Colorado; the deposit dispute involves a separate landlord transaction.",
    summary: "A federal whistleblower claim is bundled with an unrelated state-law rent-deposit dispute.",
    defendants: [
      {
        id: "employer",
        name: "FrontRange Analytics",
        state: "CO",
        ppb: "CO",
        contacts: ["CO"],
        role: "Employer accused under the federal statute.",
        sameTransaction: true,
        forumDefendant: true
      },
      {
        id: "landlord",
        name: "Peak Lease LLC",
        state: "UT",
        ppb: "UT",
        contacts: ["CO", "UT"],
        role: "Landlord tied only to the separate deposit dispute.",
        sameTransaction: false
      }
    ],
    evidence: [
      {
        id: "complaint-files",
        title: "Internal complaint files",
        tool: "rfp",
        description: "Show protected activity and employer notice."
      },
      {
        id: "supervisor-depo",
        title: "Supervisor deposition",
        tool: "deposition",
        description: "Tie discipline to protected reporting."
      },
      {
        id: "timeline-admission",
        title: "Timing admission",
        tool: "admission",
        description: "Narrow the sequence of report and retaliation."
      }
    ]
  },
  {
    id: "subscription-class",
    topics: ["class-actions", "discovery"],
    title: "Auto-Renewal Class Preview",
    type: "Consumer class action",
    plaintiff: { name: "Jordan Subscriber", state: "CA" },
    forumState: "CA",
    court: "federal",
    eventState: "CA",
    amount: 12000,
    federalQuestion: false,
    pleadingLevel: 2,
    serviceProper: true,
    classAction: true,
    rule23Ready: false,
    venueFacts: "Subscribers allege the same auto-renewal interface and billing workflow.",
    summary: "A named subscriber seeks to represent a class over recurring subscription charges.",
    defendants: [
      {
        id: "streambox",
        name: "StreamBox Inc.",
        state: "DE",
        ppb: "CA",
        contacts: ["CA", "DE"],
        role: "Designed the renewal flow in California.",
        sameTransaction: true
      }
    ],
    evidence: [
      {
        id: "subscriber-data",
        title: "Subscriber cohort data",
        tool: "rfp",
        description: "Show numerosity and common billing events.",
        resistance: "privacy"
      },
      {
        id: "ux-depo",
        title: "Product manager deposition",
        tool: "deposition",
        description: "Establish common design and disclosures."
      },
      {
        id: "common-admission",
        title: "Common-flow admission",
        tool: "admission",
        description: "Narrow whether the same flow reached all users."
      }
    ]
  }
];

export const CASES = [...CORE_CASES, ...REVIEWED_CASES];

export const ATTACK_CARDS = [
  {
    id: "pj",
    topic: "jurisdiction",
    title: "Rule 12(b)(2)",
    subtitle: "Lack of Personal Jurisdiction",
    timing: "threshold",
    cost: 1,
    text: "Dismiss if this forum lacks power over the selected defendant."
  },
  {
    id: "late-rule12",
    topic: "service",
    title: "Serial Rule 12 Defense",
    subtitle: "Late Waivable Defense",
    timing: "threshold",
    cost: 1,
    text: "Test whether a waivable Rule 12 defense was raised too late."
  },
  {
    id: "smj",
    topic: "jurisdiction",
    title: "Rule 12(b)(1)",
    subtitle: "Lack of Subject-Matter Jurisdiction",
    timing: "threshold",
    cost: 1,
    text: "Attack federal jurisdiction when no federal question or diversity basis exists."
  },
  {
    id: "service",
    topic: "service",
    title: "Rule 12(b)(5)",
    subtitle: "Insufficient Service",
    timing: "threshold",
    cost: 1,
    text: "Attack defective service before the defense is waived."
  },
  {
    id: "venue",
    topic: "jurisdiction",
    title: "Rule 12(b)(3)",
    subtitle: "Improper Venue",
    timing: "threshold",
    cost: 1,
    text: "Challenge location when events and defendants do not connect to the forum."
  },
  {
    id: "remove",
    topic: "jurisdiction",
    title: "Notice of Removal",
    subtitle: "Move to Federal Court",
    timing: "threshold",
    cost: 2,
    text: "Remove a state case if federal court would have original jurisdiction."
  },
  {
    id: "join",
    topic: "joinder",
    title: "Join Local Defendant",
    subtitle: "Destroy or Block Diversity",
    timing: "threshold",
    cost: 2,
    text: "Add a forum defendant from the same transaction to complicate removal."
  },
  {
    id: "supplemental",
    topic: "supplemental",
    title: "28 U.S.C. 1367",
    subtitle: "No Supplemental Jurisdiction",
    timing: "threshold",
    cost: 1,
    text: "Attack an added state claim that does not share the same nucleus of facts."
  },
  {
    id: "erie",
    topic: "erie",
    title: "Erie Problem",
    subtitle: "Wrong Law Applied",
    timing: "threshold",
    cost: 1,
    text: "In a federal diversity case, force the player to choose the right source of law."
  },
  {
    id: "failure-state-claim",
    topic: "jurisdiction",
    title: "Rule 12(b)(6)",
    subtitle: "Failure to State a Claim",
    timing: "threshold",
    cost: 1,
    text: "Attack a thin complaint before discovery begins."
  },
  {
    id: "class-cert",
    topic: "class-actions",
    title: "Rule 23",
    subtitle: "Oppose Class Certification",
    timing: "threshold",
    cost: 2,
    text: "Challenge numerosity, commonality, typicality, adequacy, or fit."
  },
  {
    id: "summary-judgment",
    topic: "discovery",
    title: "Rule 56",
    subtitle: "Summary Judgment",
    timing: "summary",
    cost: 2,
    text: "Win if the plaintiff lacks evidence on a required element after discovery."
  }
];

export const MOTION_CARDS = [
  {
    id: "show-contacts",
    topic: "jurisdiction",
    title: "Show Minimum Contacts",
    kind: "motion",
    cost: 1,
    answers: ["pj", "late-rule12"],
    text: "Point to forum contacts, domicile, consent, or conduct tied to the forum."
  },
  {
    id: "waiver-objection",
    topic: "service",
    title: "Waiver Objection",
    kind: "motion",
    cost: 1,
    answers: ["late-rule12", "pj", "venue", "service"],
    text: "Argue the defense was not consolidated into the first Rule 12 response."
  },
  {
    id: "show-smj",
    topic: "jurisdiction",
    title: "Show Federal Jurisdiction",
    kind: "motion",
    cost: 1,
    answers: ["smj"],
    text: "Prove federal question or diversity plus the amount in controversy."
  },
  {
    id: "cure-service",
    topic: "service",
    title: "Cure Service",
    kind: "motion",
    cost: 1,
    answers: ["service"],
    text: "Fix defective service before dismissal becomes fatal."
  },
  {
    id: "transfer-venue",
    topic: "jurisdiction",
    title: "Transfer Instead",
    kind: "motion",
    cost: 1,
    answers: ["venue"],
    text: "Keep the case alive by moving it to a proper court."
  },
  {
    id: "remand",
    topic: "jurisdiction",
    title: "Motion to Remand",
    kind: "motion",
    cost: 1,
    answers: ["remove"],
    text: "Send an improperly removed case back to state court."
  },
  {
    id: "oppose-joinder",
    topic: "joinder",
    title: "Oppose Joinder",
    kind: "motion",
    cost: 1,
    answers: ["join"],
    text: "Argue the added party is outside the same transaction or is a tactical spoiler."
  },
  {
    id: "common-nucleus",
    topic: "supplemental",
    title: "Common Nucleus",
    kind: "motion",
    cost: 1,
    answers: ["supplemental"],
    text: "Show the state claim and anchor claim share operative facts."
  },
  {
    id: "apply-state-rule",
    topic: "erie",
    title: "Apply State Rule",
    kind: "motion",
    cost: 1,
    answers: ["erie"],
    text: "Use state substantive law while keeping federal procedure."
  },
  {
    id: "leave-amend",
    topic: "jurisdiction",
    title: "Leave to Amend",
    kind: "motion",
    cost: 1,
    answers: ["failure-state-claim"],
    text: "Cure pleading defects before the claim is dismissed."
  },
  {
    id: "show-rule23",
    topic: "class-actions",
    title: "Show Rule 23 Fit",
    kind: "motion",
    cost: 2,
    answers: ["class-cert"],
    text: "Show the class device is procedurally available in this preview module."
  },
  {
    id: "show-record",
    topic: "discovery",
    title: "Show Record Evidence",
    kind: "motion",
    cost: 1,
    answers: ["summary-judgment"],
    text: "Defeat summary judgment with evidence for each required element."
  },
  {
    id: "motion-compel",
    topic: "discovery",
    title: "Motion to Compel",
    kind: "discovery",
    cost: 1,
    answers: ["burden", "privacy", "resistance"],
    text: "Force a discovery response after a proper meet-and-confer."
  },
  {
    id: "narrow-request",
    topic: "discovery",
    title: "Narrow Request",
    kind: "discovery",
    cost: 1,
    answers: ["burden", "privacy"],
    text: "Reduce burden or privacy concerns while preserving the core evidence."
  },
  {
    id: "privilege-log",
    topic: "discovery",
    title: "Demand Privilege Log",
    kind: "discovery",
    cost: 1,
    answers: ["privilege"],
    text: "Challenge withheld materials without ignoring privilege boundaries."
  },
  {
    id: "notice-deposition",
    topic: "discovery",
    title: "Notice Deposition",
    kind: "discovery-tool",
    cost: 1,
    tool: "deposition",
    text: "Use Rule 30 style testimony to lock witnesses into the record."
  },
  {
    id: "request-production",
    topic: "discovery",
    title: "Request Production",
    kind: "discovery-tool",
    cost: 1,
    tool: "rfp",
    text: "Use Rule 34 style requests for documents, ESI, and tangible things."
  },
  {
    id: "request-admission",
    topic: "discovery",
    title: "Request Admission",
    kind: "discovery-tool",
    cost: 1,
    tool: "admission",
    text: "Use Rule 36 style requests to narrow what is disputed."
  },
  {
    id: "expert-disclosure",
    topic: "discovery",
    title: "Expert Disclosure",
    kind: "discovery-tool",
    cost: 1,
    tool: "expert",
    text: "Build expert proof for causation, standard of care, or damages."
  }
];

export const TUTORIAL_STEPS = [
  {
    action: "file-claim",
    title: "File a complaint",
    body: "Start with Interstate Tire Failure. The case gives you party citizenship, forum, amount, and proof goals."
  },
  {
    action: "choose-defendant",
    title: "Choose the defendant",
    body: "Pick TireCo. This defendant has Oklahoma contacts, diversity exists, and the case has a real discovery path."
  },
  {
    action: "pass-attacks",
    title: "Move past threshold practice",
    body: "Pass to discovery for the tutorial. In normal play the defense uses this window for Rule 12 and removal cards."
  },
  {
    action: "collect-deposition",
    title: "Take the key deposition",
    body: "Use Notice Deposition on Engineer deposition."
  },
  {
    action: "request-resistant-docs",
    title: "Request documents",
    body: "Use Request Production on Quality-control documents. The defense will object on burden grounds."
  },
  {
    action: "motion-to-compel",
    title: "Solve the objection",
    body: "Use Motion to Compel to turn the disputed documents into record evidence."
  },
  {
    action: "expert-proof",
    title: "Finish the proof checklist",
    body: "Use Expert Disclosure on Expert report. A complete record gets the claim trial ready."
  },
  {
    action: "next-round",
    title: "Rotate roles",
    body: "The round is scored. Use Next round to switch plaintiff and defense."
  }
];
