export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function activeByTopic(items, activeTopics) {
  return items.filter((item) => item.topics?.some((topic) => activeTopics.has(topic)) || activeTopics.has(item.topic));
}

export function withInstance(card, sequence) {
  return { ...clone(card), instanceId: `${card.id}-${sequence}` };
}

export function caseDefendants(c, d) {
  if (!c || !d) return [];
  const joinedIds = new Set(Array.isArray(c.joinedDefendantIds) ? c.joinedDefendantIds : []);
  return [
    d,
    ...(c.defendants || []).filter((defendant) => joinedIds.has(defendant.id) && defendant.id !== d.id)
  ];
}

export function defendantCitizenships(defendant) {
  return new Set([defendant?.state, defendant?.ppb].filter(Boolean));
}

export function hasCompleteDiversity(c, d) {
  if (!c || !d || !c.plaintiff?.state) return false;
  return caseDefendants(c, d).every((defendant) => !defendantCitizenships(defendant).has(c.plaintiff.state));
}

export function hasFederalSmj(c, d) {
  if (!c) return false;
  if (c.federalQuestion) return true;
  return Boolean(d && hasCompleteDiversity(c, d) && c.amount > 75000);
}

export function hasForumDefendant(c, d) {
  if (!c || !d) return false;
  const forumState = c.currentForum || c.forumState;
  return caseDefendants(c, d).some((defendant) =>
    defendant.properlyJoinedAndServed !== false
    && defendantCitizenships(defendant).has(forumState)
  );
}

export function removalBasis(c, d) {
  if (!c) return "none";
  const federalQuestion = Boolean(c.federalQuestion);
  const diversity = Boolean(d && hasCompleteDiversity(c, d) && c.amount > 75000);
  if (federalQuestion && diversity) return "both";
  if (federalQuestion) return "federal-question";
  if (diversity) return "diversity";
  return "none";
}

export function isRemovalAvailable(c, d) {
  if (!c || !d || (c.currentCourt || c.court) !== "state" || c.removalProcedurallyBlocked) return false;
  const basis = removalBasis(c, d);
  if (basis === "none") return false;
  return basis !== "diversity" || !hasForumDefendant(c, d);
}

export function statusFacts(c, d) {
  const currentCourt = c.currentCourt || c.court;
  const currentForum = c.currentForum || c.forumState;
  const diversity = hasCompleteDiversity(c, d);
  const federalSmj = hasFederalSmj(c, d);
  const pj = Boolean(d && (d.contacts.includes(currentForum) || d.state === currentForum || d.ppb === currentForum));
  const basis = removalBasis(c, d);
  const removable = isRemovalAvailable(c, d);
  const removalStatus = currentCourt !== "state"
    ? "Not applicable"
    : removable
      ? basis === "federal-question" ? "Available: federal question" : basis === "both" ? "Available: both bases" : "Available: diversity"
      : basis === "diversity" && hasForumDefendant(c, d)
        ? "Blocked: forum defendant"
        : basis === "none" ? "No federal basis" : "Procedurally blocked";
  return {
    diversity: diversity ? "Complete" : "Broken",
    smj: federalSmj ? "Yes" : currentCourt === "state" ? "State general" : "No",
    pj: pj ? "Present" : "Weak",
    service: c.serviceProper ? "Proper" : "Defective",
    removal: removalStatus,
    removalBasis: basis,
    supplemental: c.supplementalClaim
      ? c.supplementalClaim.related && c.supplementalClaim.anchorFederal
        ? "Likely"
        : "Weak"
      : "None"
  };
}

export function evaluateAttack({ attack, activeCase: c, selectedDefendant: d, attackCount, missingEvidence }) {
  const currentCourt = c.currentCourt || c.court;
  const currentForum = c.currentForum || c.forumState;
  const diversity = hasCompleteDiversity(c, d);
  const federalSmj = hasFederalSmj(c, d);
  const venueProper = currentForum === c.eventState || d.contacts.includes(currentForum);
  const namedDefendantIds = new Set(caseDefendants(c, d).map((item) => item.id));
  const localJoiner = c.defendants.find((item) =>
    item.forumDefendant
    && !namedDefendantIds.has(item.id)
    && item.sameTransaction
  );
  const waivableLate = attackCount > 0 && ["pj", "late-rule12", "venue", "service"].includes(attack.id) && !c.rule12Preserved;

  if (waivableLate) {
    return {
      hasMerit: false,
      counterWorks: true,
      prompt: "Plaintiff can object that this waivable Rule 12 defense came too late.",
      body: "The defense was not consolidated into the first Rule 12 response in this simplified model.",
      winDetail: `${attack.subtitle} is waived because it was raised after an earlier threshold move.`,
      authorityIds: ["frcp-12"],
      proposition: "Rules 12(g)(2) and 12(h)(1) generally require timely consolidation of waivable Rule 12 defenses."
    };
  }

  switch (attack.id) {
    case "pj": {
      const hasContacts = d.contacts.includes(currentForum) || d.state === currentForum || d.ppb === currentForum;
      return {
        hasMerit: !hasContacts,
        counterWorks: hasContacts,
        prompt: "Plaintiff must point to forum contacts, domicile, consent, or forum-linked conduct.",
        body: `${d.name} has no meaningful ${currentForum} contact in the case data.`,
        winDetail: `${d.name} has forum contacts tied to ${currentForum}, so the personal-jurisdiction attack fails.`,
        authorityIds: ["frcp-12", "case-international-shoe"],
        proposition: "Rule 12(b)(2) permits a personal-jurisdiction defense, while due process requires a sufficient forum connection."
      };
    }
    case "late-rule12": {
      const hasContacts = d.contacts.includes(currentForum) || d.state === currentForum || d.ppb === currentForum;
      return {
        hasMerit: !hasContacts,
        counterWorks: hasContacts,
        prompt: "This card tests Rule 12 consolidation and the underlying waivable defense.",
        body: `${d.name} lacks forum contacts and the defense was raised in time.`,
        winDetail: hasContacts
          ? "The underlying defense is weak because forum contacts are present."
          : "The defense was raised in the first threshold window.",
        authorityIds: ["frcp-12"],
        proposition: "Rules 12(g)(2) and 12(h)(1) govern consolidation and waiver of waivable threshold defenses."
      };
    }
    case "service": {
      return {
        hasMerit: !c.serviceProper,
        counterWorks: true,
        prompt: "Plaintiff can cure defective service if the problem is caught early.",
        body: "Service is defective in the case data.",
        winDetail: "Service is already proper, so the attack fails.",
        cureDetail: "Service is cured and the case stays alive.",
        authorityIds: ["frcp-4", "frcp-12"],
        proposition: "Rule 4 governs service, and Rule 12(b)(5) permits a defense of insufficient service of process."
      };
    }
    case "smj": {
      const attackHasMerit = currentCourt === "federal" && !federalSmj;
      return {
        hasMerit: attackHasMerit,
        counterWorks: federalSmj,
        prompt: "Plaintiff must show federal question jurisdiction or diversity plus more than $75,000.",
        body: "Federal court lacks original jurisdiction in the current setup.",
        winDetail: c.federalQuestion
          ? "The claim arises under federal law, so federal-question jurisdiction supports the case."
          : "Complete diversity and more than $75,000 support diversity jurisdiction.",
        authorityIds: ["usc-28-1331", "usc-28-1332", "frcp-12"],
        proposition: "Federal-question or diversity jurisdiction must support a federal action, and Rule 12(b)(1) permits an SMJ challenge."
      };
    }
    case "venue": {
      return {
        hasMerit: !venueProper,
        counterWorks: true,
        prompt: "Plaintiff can either show venue connections or transfer instead of losing the claim.",
        body: `${currentForum} is weak because the events and selected defendant do not connect there.`,
        winDetail: `${currentForum} has venue connections through the events or defendant contacts.`,
        cureDetail: `The case is transferred to ${c.eventState}, keeping the claim alive but costing tempo.`,
        authorityIds: ["usc-28-1391", "frcp-12"],
        proposition: "Section 1391 supplies the general venue rules, and Rule 12(b)(3) permits an improper-venue defense."
      };
    }
    case "remove": {
      const basis = removalBasis(c, d);
      const forumDefendant = hasForumDefendant(c, d);
      const removable = isRemovalAvailable(c, d);
      const reason = basis === "federal-question"
        ? "Federal-question jurisdiction supplies the removal basis."
        : basis === "both"
          ? "Federal-question and diversity jurisdiction each supply an original-jurisdiction basis."
          : basis === "diversity"
            ? "Complete diversity and the amount in controversy supply the removal basis."
            : "No federal-question or diversity basis supplies original jurisdiction.";
      return {
        hasMerit: removable,
        counterWorks: !removable,
        prompt: "Plaintiff can seek remand if original federal jurisdiction is missing or, in a diversity-only case, a properly joined and served forum defendant triggers the statutory restriction.",
        body: `${reason} Removal is proper in this simplified model.`,
        winDetail: currentCourt !== "state"
          ? "The case is already in federal court, so removal is unavailable."
          : basis === "none"
            ? "Removal is improper because federal original jurisdiction is missing."
            : basis === "diversity" && forumDefendant
              ? "A properly joined and served forum defendant blocks removal based solely on diversity."
              : "A separate procedural removal restriction blocks this notice.",
        authorityIds: [
          "usc-28-1441",
          ...(basis === "federal-question" || basis === "both" ? ["usc-28-1331"] : []),
          ...(basis === "diversity" || basis === "both" ? ["usc-28-1332"] : [])
        ],
        proposition: "Section 1441 permits removal of qualifying state actions, but subsection (b)(2) restricts only actions removable solely under diversity jurisdiction."
      };
    }
    case "join": {
      const canJoin = Boolean(localJoiner);
      return {
        hasMerit: canJoin,
        counterWorks: !canJoin,
        prompt: "Plaintiff can oppose if the added party is unrelated or merely tactical.",
        body: canJoin
          ? `${localJoiner.name} is a forum defendant tied to the same transaction, complicating diversity/removal.`
          : "No same-transaction forum defendant is available from the case data.",
        winDetail: "The proposed joinder is not supported by the case facts.",
        authorityIds: ["frcp-20", "usc-28-1332", "usc-28-1441"],
        proposition: "Permissive joinder and party citizenship are distinct from the forum-defendant restriction on diversity-only removal."
      };
    }
    case "supplemental": {
      const claim = c.supplementalClaim;
      const supported = Boolean(claim?.related && claim?.anchorFederal);
      return {
        hasMerit: Boolean(claim && !supported),
        counterWorks: supported,
        prompt: "Plaintiff must show the added state claim shares a common nucleus with an anchor federal claim.",
        body: claim
          ? `${claim.title} is too unrelated to ride with the anchor claim.`
          : "There is no supplemental claim to attack.",
        winDetail: claim
          ? `${claim.title} shares operative facts with the federal anchor claim.`
          : "No supplemental claim is in play.",
        authorityIds: ["usc-28-1367"],
        proposition: "Section 1367(a) generally reaches claims forming part of the same Article III case or controversy."
      };
    }
    case "erie": {
      const erieProblem = currentCourt === "federal" && Boolean(c.stateLawConflict);
      return {
        hasMerit: erieProblem,
        counterWorks: true,
        prompt: "Plaintiff must identify state substantive law versus federal procedure.",
        body: "The case is in federal court on state-law rights and has an unresolved state-law conflict.",
        winDetail: "No Erie conflict is live in this case state.",
        cureDetail: "State substantive law is applied and federal procedure remains available.",
        authorityIds: ["case-erie"],
        proposition: "A federal court adjudicating state-created rights applies state substantive law while federal procedure remains controlling."
      };
    }
    case "failure-state-claim": {
      const thinPleading = c.pleadingLevel < 2;
      return {
        hasMerit: thinPleading,
        counterWorks: true,
        prompt: "Plaintiff can ask for leave to amend if the complaint is factually thin.",
        body: "The complaint is too bare to move into discovery without amendment.",
        winDetail: "The complaint already states enough factual matter for the game to proceed.",
        cureDetail: "Leave to amend is granted. The pleading is treated as cured.",
        authorityIds: ["frcp-8", "frcp-12", "frcp-15"],
        proposition: "Rules 8 and 12(b)(6) frame pleading sufficiency, while Rule 15 governs amendment."
      };
    }
    case "class-cert": {
      const problem = Boolean(c.classAction && !c.rule23Ready);
      return {
        hasMerit: problem,
        counterWorks: true,
        prompt: "Plaintiff must show Rule 23 fit in this preview module.",
        body: "The class device is not yet supported by the case record.",
        winDetail: c.classAction ? "Rule 23 fit has already been shown." : "This is not a class-action claim.",
        cureDetail: "The class-action preview gate is satisfied.",
        authorityIds: ["frcp-23"],
        proposition: "A proposed class must satisfy Rule 23(a) and an applicable Rule 23(b) category."
      };
    }
    case "summary-judgment": {
      return {
        hasMerit: missingEvidence.length > 0,
        counterWorks: missingEvidence.length === 0,
        prompt: "Plaintiff must show record evidence for each listed proof item.",
        body: missingEvidence.length
          ? `The discovery record is missing ${missingEvidence.map((item) => item.title).join(", ")}.`
          : "The discovery record covers every proof item.",
        winDetail: "Record evidence exists for every required proof item.",
        authorityIds: ["frcp-56"],
        proposition: "Rule 56 turns on whether the record shows a genuine dispute of material fact and entitlement to judgment as a matter of law."
      };
    }
    default:
      return {
        hasMerit: false,
        counterWorks: false,
        prompt: "No rule found.",
        body: "No rule found.",
        winDetail: "No rule found.",
        authorityIds: [],
        proposition: "No governing authority is mapped to this prototype action."
      };
  }
}

export function allEvidenceCollected(activeCase) {
  return Boolean(activeCase?.evidence.every((item) => item.complete));
}

export function missingEvidence(activeCase) {
  if (!activeCase) return [];
  return activeCase.evidence.filter((item) => !item.complete);
}

export function toolName(tool) {
  const names = {
    deposition: "Deposition",
    rfp: "Request for production",
    admission: "Request for admission",
    expert: "Expert proof"
  };
  return names[tool] || tool;
}

export function resistanceLabel(resistance) {
  const labels = {
    burden: "undue burden",
    privacy: "privacy/proportionality",
    privilege: "privilege",
    resistance: "general resistance"
  };
  return labels[resistance] || resistance;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
