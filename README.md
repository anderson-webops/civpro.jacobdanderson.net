# Civ Pro: Trial Ready

`Civ Pro: Trial Ready` is a dependency-light browser game for formative 1L Civil Procedure practice. Version 0.3 is an instructor-ready classroom pilot with validated lesson packs, reproducible seeded play, exact save and replay, post-round assessment evidence, local-only balance statistics, printable deck subsets, and classroom guides.

This repository is `anderson-webops/civpro.jacobdanderson.net`, with its local checkout at `~/Sites/civpro.jacobdanderson.net`.

## Run

Because the app is split into browser modules, run it from the explicit public web root:

```sh
npm run serve
```

Then open `http://localhost:4173`.

## Test

```sh
npm run scenarios:build
npm test
npm run check
```

The test suite covers rule-engine doctrine branches and edge cases, playable card and deck integrity, all 15 scenario packs, deterministic play and replay, assessment and playtest aggregation, generated legal-source data, source generator and environment parsing, secret redaction, classroom documentation, the static HTML-to-app DOM contract, and a dependency-free app boot smoke test.

## Classroom Pilot

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
- Export a portable JSON replay containing the seed, exact state, structured docket events, and completed assessments.
- Import that replay to restore the precise phase, hands, budgets, case state, docket, and assessment.

Replay import validates the schema, known game identifiers, size, and text safety before restoring state. Imported and loaded timers remain paused until the next timed action.

## Instructor Assessment and Playtest Signals

Every completed round records doctrines triggered, wrong motions or discovery tools, dismissed or trial-ready outcome, missing proof items, source hooks, attack results, budget failures, and drawn versus played cards.

The browser then aggregates local-only signals for classroom tuning:

- Average round length.
- Attack success rate.
- Plaintiff and defense budget failures.
- Cases that have never reached trial readiness.
- Cards drawn but never played.

These statistics remain in the current browser, retain at most 200 completed rounds, and can be cleared from the classroom panel. They are not transmitted or included in source imports.

## Pilot Guides and Printing

- [Instructor guide](public/guides/instructor-guide.html)
- [Student quickstart](public/guides/student-quickstart.html)
- [Sample lesson plans](public/guides/lesson-plans.html)

The lesson plans map all 15 scenario packs to suggested class sequences and debrief targets. The app's `Print cards` control prints only the cases and cards in the active pack, together with that pack's title, seed, schedule, and objectives.

## Legal Source Imports

The app now has a legal-source ingestion layer. It does not need API credentials to run; the default source catalog is generated from public doctrine/source metadata and blank credential placeholders.

```sh
npm run sources
```

That command writes:

- `data/legal-sources/source-manifest.json`: provider registry, doctrine source links, and live-probe configuration.
- `public/legal-sources.generated.js`: browser-safe source cards used by the in-game Rule Judge.

`npm run sources` intentionally ignores local credentials so the checked-in catalog stays stable and safe to commit.

To probe live APIs and public endpoints, copy `.env.example` to `.env`, add real credentials locally, and run:

```sh
npm run sources:live
```

That writes `data/legal-sources/live-source-manifest.local.json`, which is ignored by git. Use `npm run sources:live:restricted` to include restricted account checks such as PACER credential presence. Direct PACER network access is not performed by the public source refresh path.

`.env` is local-only and ignored by git. `.env.example` is the tracked template. Current placeholders are `GOVINFO_API_KEY`, `COURTLISTENER_API_TOKEN`, `CONGRESS_API_KEY`, `OPENSTATES_API_KEY`, `PACER_USERNAME`, `PACER_PASSWORD`, `PACER_CLIENT_CODE`, `PACER_OTP_CODE`, `PACER_REDACT_FLAG`, `PACER_DIRECT_ENABLED`, `PACER_DIRECT_ENV`, `PACER_DIRECT_ALLOW_PRODUCTION`, `LEGAL_SOURCE_CACHE_DIR`, and `LEGAL_PRIVATE_CACHE_DIR`.

Source coverage currently includes U.S. Courts FRCP materials, Cornell LII rule/statute pages, CourtListener, govinfo, FederalRegister.gov, eCFR, Congress.gov, Open States, and a restricted PACER/RECAP path. CourtListener/RECAP remains the default path for docket and opinion material. Direct PACER use must stay server-side and optional because it can require account credentials and may incur fees.

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
- `public/guides/`: printable instructor guide, student quickstart, and lesson plans.
- `public/legal-sources.generated.js`: generated browser-safe source module used by `data.js`.
- `data/scenario-packs.json`: validated source catalog for the 15 classroom packs.
- `data/reviewed-game-artifacts.json`: human-reviewed game artifacts promoted from provider candidate lanes.
- `ops/legal-sources/`: operator-reviewed allowlists and ignored server-side source-ingestion output; not part of the public web root.
- `public/game-artifacts.generated.js`: generated reviewed gameplay/source artifacts used by `data.js`.
- `public/rules.js`: rule evaluation and shared helpers.
- `public/app.js`: UI state, turns, rendering, classroom controls, replay, assessment, balance statistics, tutorial, and printing.
- `public/rule-tests.js`: reusable test assertions.
- `scripts/`: scenario-pack generation, legal-source configuration, environment loading, private ingestion, and source-manifest generation.
- `tests/`: Node test runners for doctrine logic, classroom sessions, pilot documents, and source ingestion.
- `public/styles.css`: game UI and print-card styling.

## Doctrine Boundary

This is a learning game, not a legal expert system or legal advice. It intentionally abstracts doctrine into teachable game states. The source hooks are grounded in core 1L procedure materials, including FRCP 4, 8, 12-15, 18-20, 23, 26/30/34/36/37, 56, and 28 U.S.C. 1331, 1332, 1367, 1391, 1441, and 1446.
