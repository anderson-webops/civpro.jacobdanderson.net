# Civ Pro: Trial Ready

`Civ Pro: Trial Ready` is a dependency-light browser game for formative 1L Civil Procedure practice. Version 0.4 adds source-ID traceability, corrected diversity and removal analysis, committed predictions, motion-response checks, revisions, altered-fact transfer practice, local autosave, a searchable guide library, and a validated portable public build. It keeps the existing browser-module architecture rather than adopting Patent Practice's React framework.

This repository is `anderson-webops/civpro.jacobdanderson.net`, with its local checkout at `~/Sites/civpro.jacobdanderson.net`.

## Run

The project pins Node `24.18.1` and npm `12.0.2` in `.node-version`, `.nvmrc`, `package.json`, and CI.

Because the app is split into browser modules, run it from the explicit public web root:

```sh
npm run serve
```

Then open `http://localhost:4173`.

## Test

```sh
npm ci
./node_modules/.bin/playwright install chromium
npm run audit
npm run check
```

The complete gate covers doctrine branches, authority IDs, malicious markup escaping, all 15 scenario packs, deterministic save/replay, staged learning cycles, generated source data, private ingestion boundaries, the guide library, the public artifact allowlist, rendered accessibility, and keyboard play. CI installs the same pinned toolchain and Chromium before running this gate.

## Classroom Pilot

The [pilot protocol](docs/pilot/PROTOCOL.md), [blank observation sheet](docs/pilot/OBSERVATION-SHEET.md), and [interim evaluation](docs/pilot/EVALUATION.md) prepare instructor/student sessions. Human participants were unavailable on 2026-09-12. Version 0.4.1 fixes issues reproduced in an agent rehearsal; it does not establish human-tested pacing or balance.

The update preserves draft reasoning through setting changes and reloads, focuses the active learning stage, distinguishes deliberate nonresponse from expiry, and allows budget-neutral card exchanges when the required card is not in hand. Exchange balance remains provisional pending participant observations.

The classroom panel combines five curriculum tracks with 30, 50, and 75 minute formats, producing 15 validated scenario packs:

- Jurisdiction and removal.
- Rule 12 motion practice.
- Discovery and Rule 56.
- Joinder and supplemental jurisdiction.
- Erie and class-actions preview modules.

Each pack defines its own cases, attack cards, motion and discovery cards, budgets, timers, hand sizes, round count, learning objectives, checkpoints, assessment focus, schedule, and recommended replay seed. The source catalog lives in `data/scenario-packs.json`; `npm run scenarios:build` validates it and regenerates `public/scenario-packs.generated.js`.

## Deterministic Sessions and Replay

Deck order comes from a named seed. Starting the same pack with the same seed reproduces the card order. Instructors can:

- Save and load one exact session in browser storage.
- Resume a compatible local autosave without silently overwriting it.
- Export a portable JSON replay containing the seed, exact state, structured docket events, and completed assessments.
- Import that replay to restore the precise phase, hands, budgets, case state, docket, and assessment.

Every snapshot records app version `0.4.1`, content version `2026-08-27.1`, and source revision `2026-08-27`. Compatible 0.4.0 snapshots remain accepted. Replay import validates these versions, the schema, known game identifiers, size, and text safety before restoring state. Imported and loaded timers remain paused until the next timed action. Turning Study mode or No timer off starts a fresh window for the current timed step. Draft reasoning is autosaved before commitment and is private session content.

## Staged Learning Lifecycle

Each contested attack follows the same sequence:

1. The game presents the fact pattern and issue.
2. The learner commits a predicted result and reasoning before the ruling.
3. A mechanical check identifies the response task without revealing the result.
4. The learner chooses a responsive motion or intentionally uses no response.
5. The Rule Judge resolves the attack through traceable authority IDs.
6. The learner revises the analysis and predicts an altered-fact result.
7. The round debrief preserves the initial answer, ruling, revision, governing sources, missed doctrines, and review topics.

## Instructor Assessment and Playtest Signals

Every completed round records doctrines triggered, committed predictions, revisions, altered-fact predictions, wrong motions or discovery tools, dismissed or trial-ready outcome, missing proof items, governing authority IDs, attack results, budget failures, and drawn versus played cards.

The browser then aggregates local-only signals for classroom tuning:

- Average round length.
- Attack success rate.
- Plaintiff and defense budget failures.
- Cases that have never reached trial readiness.
- Cards drawn but never played.

These statistics remain in the current browser, retain at most 200 completed rounds, and can be cleared from the classroom panel. They are not transmitted or included in source imports.

Balance history stores only numeric outcomes and canonical game labels/identifiers; it drops learner writing, custom seeds, and timestamps, including on migration of legacy stats. Full saves and replay files still contain writing. Use **Clear local game data** to remove the game's saved sessions, drafts, and stats from a shared browser; remove downloaded replays separately. Store actual observation sheets outside this public repository. Clear stats between comparable pilot runs because the panel combines stored rounds.

## Pilot Guides and Printing

- [Searchable guide library](public/guides/index.html)
- [Instructor guide](public/guides/instructor-guide.html)
- [Student quickstart](public/guides/student-quickstart.html)
- [Sample lesson plans](public/guides/lesson-plans.html)

The lesson plans map all 15 scenario packs to suggested class sequences and debrief targets. The app's `Print cards` control prints only the cases and cards in the active pack, together with that pack's title, seed, schedule, and objectives.

The library covers jurisdiction, pleading, joinder, Erie, discovery, summary judgment, class actions, and exam writing. Every guide separates governing text, cases, course framing, exam strategy, hypotheticals, mnemonics, and self-checks.

## Portable Public Build

```sh
npm run build
```

`dist/client` is the only approved deployable artifact. The build copies an explicit 22-file allowlist from `public/`, excludes `public/rule-tests.js`, and then rejects unexpected files, hidden paths, symlinks, private path names, likely secrets, local absolute paths, and unapproved external hosts. Artifact tests confirm that `.env`, `.env.example`, `data/`, `ops/`, `scripts/`, `tests/`, `.git`, and `.github` cannot ship.

`public/_headers` supplies a static-host security policy. `deploy/nginx.conf.example` provides the equivalent direct Nginx contract with private-path gates. These files do not authorize or perform a live deployment.

Release identity is three-part: package/app version `0.4.1`, content version `2026-08-27.1`, and source revision `2026-08-27`. A version tag is created only after `npm run audit` and `npm run check` pass from the locked dependency tree.

## Privacy and Public Boundary

The public site has no account, analytics, or server submission endpoint. Autosave, manual save, replay state, and playtest signals remain in the current browser unless the learner exports a JSON file. Provider credentials, caches, allowlists, candidate material, operator scripts, and tests remain outside `dist/client`.

## Legal Source Imports

The app now has a legal-source ingestion layer. It does not need API credentials to run; the default source catalog is generated from public doctrine/source metadata and blank credential placeholders.

```sh
npm run sources
```

That command writes:

- `data/legal-sources/source-manifest.json`: provider registry, doctrine source links, and live-probe configuration.
- `public/legal-sources.generated.js`: browser-safe authority and reference records used by the Rule Judge and guide library.

`npm run sources` intentionally ignores local credentials so the checked-in catalog stays stable and safe to commit.

To probe live APIs and public endpoints, copy `.env.example` to `.env`, add real credentials locally, and run:

```sh
npm run sources:live
```

That writes `data/legal-sources/live-source-manifest.local.json`, which is ignored by git. Use `npm run sources:live:restricted` to include restricted account checks such as PACER credential presence. Direct PACER network access is not performed by the public source refresh path.

`.env` is local-only and ignored by git. `.env.example` is the tracked template. Current placeholders are `GOVINFO_API_KEY`, `COURTLISTENER_API_TOKEN`, `CONGRESS_API_KEY`, `OPENSTATES_API_KEY`, `PACER_USERNAME`, `PACER_PASSWORD`, `PACER_CLIENT_CODE`, `PACER_OTP_CODE`, `PACER_REDACT_FLAG`, `PACER_DIRECT_ENABLED`, `PACER_DIRECT_ENV`, `PACER_DIRECT_ALLOW_PRODUCTION`, `LEGAL_SOURCE_CACHE_DIR`, and `LEGAL_PRIVATE_CACHE_DIR`.

Ruling traceability follows `result -> source ID -> pinpoint -> supported proposition -> official source`. Only primary rules, statutes, and cases active for the present ruling appear as governing authority. Cornell links are labeled readable explanations. Provider/API records and reviewed ingestion lanes are reference metadata. The August 2026 proposed-amendments package is labeled future, non-governing material and never drives current evaluator logic.

Source coverage includes the official U.S. Courts current-rules page, official House U.S. Code pages, official U.S. Reports PDFs from the Library of Congress, readable Cornell LII pages, CourtListener, govinfo, FederalRegister.gov, eCFR, Congress.gov, Open States, and a restricted PACER/RECAP path. CourtListener/RECAP remains the default provider lane for docket and opinion material. Direct PACER use must stay server-side and optional because it can require account credentials and may incur fees.

## Direct PACER Imports

Direct PACER access is import-only. It is not used by the browser app, `npm run sources`, `npm run sources:live`, `npm run sources:live:restricted`, or the reviewed-artifact build. The guarded entrypoint is:

```sh
npm run pacer:import:dry-run
```

The dry run reads `ops/legal-sources/pacer-import-allowlist.json`, makes no PACER requests, and writes an ignored manifest under `ops/legal-sources/cache/pacer-direct/`. Actual direct access requires all of these:

- A specific allowlist entry with `enabled: true`, `reviewed: true`, and exact `caseNumberFull` criteria.
- Local `.env` credentials: `PACER_USERNAME` and `PACER_PASSWORD`; optionally `PACER_CLIENT_CODE`, `PACER_OTP_CODE`, and `PACER_REDACT_FLAG`.
- `PACER_DIRECT_ENABLED=true`.
- The explicit operator command `npm run pacer:import`.

Production access has an additional guard: set `PACER_DIRECT_ENV=production` and `PACER_DIRECT_ALLOW_PRODUCTION=true`. The default is `PACER_DIRECT_ENV=qa`. Cached PACER artifacts are written only under the ignored `ops/legal-sources/cache/pacer-direct/` directory, include provenance and retrieval timestamps, and redact credential/token/account fields.

## Reviewed Game Artifacts

Live API output is never imported straight into gameplay. Use the build-time artifact pipeline:

```sh
npm run artifacts:candidates
npm run artifacts:build
```

`artifacts:candidates` writes ignored provider candidates to `ops/legal-sources/provider-candidates.local.json`. Review and fictionalize useful candidates into `data/reviewed-game-artifacts.json`, then run `artifacts:build` to regenerate `public/game-artifacts.generated.js`. Only reviewed artifacts are compiled into the static app. Current reviewed artifacts add playable source-backed case cards plus source cards that explain which provider lanes support them.

## What Is Playable

- File a case and choose the defendant.
- Use an actual defense attack hand and plaintiff motion/discovery hand.
- Draw cards, discard used cards, and spend limited litigation budget.
- Play threshold attacks for personal jurisdiction, subject-matter jurisdiction, service, venue, removal, joinder, supplemental jurisdiction, Erie preview, Rule 12(b)(6), and class certification preview.
- Use timed or untimed motion responses.
- Collect discovery proof with depositions, requests for production, requests for admission, expert proof, motions to compel, narrowing, and privilege-log responses.
- Close discovery and use Rule 56 if the proof checklist is incomplete.
- Score trial-ready claims and rotate roles.

## Study Modes

The professor panel supports:

- Jurisdiction-only preset.
- Discovery-only preset.
- Topic toggles for jurisdiction/removal, service, joinder, supplemental jurisdiction, discovery/Rule 56, Erie preview, and class actions preview.
- No-timer mode.
- Exam mode, which hides the Rule Judge analysis until revealed.
- Explanation toggle.
- Guided tutorial mode.
- Validated curriculum packs for three class lengths.
- Custom topic mode for instructor-created combinations.

## Print Cards

Apply a scenario pack, then use `Print cards` in the app. The active pack determines the exact printable case, attack, motion, and discovery subset so the physical deck, lesson plan, and digital session stay aligned.

## File Structure

- `public/`: static web root served by `npm run serve`.
- `public/classroom.js`: seeded randomization, snapshot and replay validation, assessment construction, and local playtest aggregation.
- `public/data.js`: case cards, attack cards, motion/discovery cards, topic modules, sources, tutorial steps.
- `public/scenario-packs.generated.js`: generated browser-safe scenario packs.
- `public/guides/`: searchable doctrine library plus printable instructor guide, student quickstart, and lesson plans.
- `public/legal-sources.generated.js`: generated browser-safe source module used by `data.js`.
- `data/scenario-packs.json`: validated source catalog for the 15 classroom packs.
- `data/reviewed-game-artifacts.json`: human-reviewed game artifacts promoted from provider candidate lanes.
- `ops/legal-sources/`: operator-reviewed allowlists and ignored server-side source-ingestion output; not part of the public web root.
- `public/game-artifacts.generated.js`: generated reviewed gameplay/source artifacts used by `data.js`.
- `public/rules.js`: rule evaluation and shared helpers.
- `public/app.js`: UI state, turns, rendering, classroom controls, replay, assessment, balance statistics, tutorial, and printing.
- `public/learning-cycle.js`: pure committed-prediction, ruling, revision, and altered-fact state transitions.
- `public/safe-html.js`: centralized escaping and safe-link helpers for generated and imported text.
- `public/rule-tests.js`: developer-only reusable rule assertions; excluded from `dist/client`.
- `scripts/`: scenario-pack generation, legal-source configuration, environment loading, private ingestion, and source-manifest generation.
- `tests/`: unit, artifact, rendered accessibility, and keyboard-flow checks.
- `dist/client/`: generated and ignored portable public artifact.
- `public/styles.css`: game UI and print-card styling.

## Doctrine Boundary

This is a learning game, not a legal expert system or legal advice. It intentionally abstracts doctrine into teachable game states. Each resolved doctrine branch is mapped to reviewed rules, statutes, or cases, but users should confirm the governing text and follow course-specific instruction. Sources were reviewed through August 27, 2026; proposed amendments remain visibly separate from governing evaluator logic.
