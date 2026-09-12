# Pilot preparation and interim evaluation

Date: 2026-09-12. Baseline: `eaea0da` (application 0.4.0). Candidate: application 0.4.1, content 2026-08-27.1, source review 2026-08-27.

## Human evidence checkpoint

Human instructor sessions: 0. Human student sessions: 0. The user explicitly said participants are not available yet and asked for pilot preparation. No learner feedback, classroom pacing estimate, instructional effectiveness claim, or human balance result is available. This is an interim preparation evaluation, not the requested final human pilot evaluation.

The [protocol](PROTOCOL.md) and [observation sheet](OBSERVATION-SHEET.md) prepare the next human sessions. The existing instructor guide, quickstart, 15 packs, seeded replay, and round assessment remain the teaching surfaces.

## Rehearsal observations and changes

| Finding | Observed or inspected baseline evidence | Candidate change | Verification |
| --- | --- | --- | --- |
| Written prediction lost during facilitation | In Chrome, choose the default pack's Viral Defamation Stream, Westcast Media, and Improper Venue attack. Type reasoning and toggle Study mode: the textarea becomes empty. | Save uncommitted writing with the cycle and restore it on render/recovery; validation errors stay beside the form. | Browser regression includes mode change, reload/resume, and invalid whitespace without deleting the draft. |
| Keyboard focus lost at prediction | After clicking the attack, `document.activeElement` was `BODY`. | Focus the learning-panel heading when the learning stage changes. | Browser assertion after attack plus keyboard entry, automated accessibility, and mobile-width checks. Manual screen-reader use remains untested. |
| Intentional choice reported as time expiry | `standOnPrediction` and the timeout both called the same null-response path, which recorded “No timely response” and an expired window. | Record deliberate nonresponse separately from timeout and evaluate the attack on its merits. | Browser assertion for “Response declined”; existing rule/learning tests remain the doctrine checks. |
| Full motion hand prevents obtaining needed discovery tools | Default 50-minute deal contains eight cards but no deposition or production tool; all draw slots are occupied and no exchange control exists. Needed tools are in the pack, not in hand. | Explicit one-for-one exchange during a role's actionable phase. It keeps hand size and budget unchanged, uses the seeded deck, and records exchanges. | Cooperative browser walkthroughs must reach assessment without spending budget on deliberately wrong moves. Human effects of free exchange are pending. |
| Balance history retains unnecessary writing | `appendRoundStats` cloned the full assessment, including learning cycles, into persistent balance history. | Allowlist numeric counts and canonical game identifiers/labels; scrub legacy stats at load; add shared-device cleanup. | Unit tests inject private marker strings; browser tests check saved drafts and local-data removal. Full session saves/replays intentionally retain writing and are labeled private. |
| Balance signals can be misread | Stats combine stored rounds. Unaffordable cards are disabled, so zero rejected attempts does not establish adequate budget. | Explain those limits, display exchange counts, and record blocked choices manually in the protocol. | Source/UI checks and pilot observation fields. No budget sizes changed. |

## Reproducible technical coverage

`npm run check` includes `tests/browser.test.js` and `tests/pilot-rehearsal.js`. The latter uses isolated browser contexts, recommended seeds, and Study mode. For each of 15 packs it follows a cooperative complete-record route through every planned round, plus one early-close/Rule 56 route. That defines 30 complete-record rounds and 15 early-close rounds. The harness asserts outcome, absence of deliberate wrong moves, hand/budget invariants, planned-session completion, and omission of synthetic writing from balance history. Its fixture reasoning is artificial and is never reported as student reasoning.

The rehearsal selects the first dealt claim/defendant and knows the matching tool. It does not cover every case/defendant combination, contested strategy, random seed, assistive technology, or human decision process. Its run time cannot estimate lesson duration. A separate inspection of all offered pack cases found a minimum discovery cost of 3–4 budget versus starting plaintiff budgets of 5/6/7, before responses and mistakes. This establishes no obvious minimum-cost impossibility, not balanced or attainable play for learners.

Observed candidate result: all 45 scripted rounds reached their expected assessment; the deterministic exchange policy used 242 exchanges. That count is a reason to observe search effort in the human pilot, not evidence that the exchange rule is well balanced. Browser checks also passed draft recovery, nearby validation errors, intentional nonresponse, shared-browser deletion, and the severe automated-accessibility gate at desktop and 390px mobile widths.

Validation results and source delivery are recorded in the release notes after the candidate gates pass. Source delivery does not establish production deployment.

## Next evidence required

Conduct the first instructor setup and student round when participants become available. Record actual task completion, help, timing, accessibility friction, and assessment usefulness privately. Repeat comparable runs to assess free exchanges and pacing. Apply justified changes, retest, then replace the pending human-evidence section with a reviewed aggregate evaluation. The active goal remains incomplete until those human sessions, resulting improvements, and final evaluation are supported by evidence.
