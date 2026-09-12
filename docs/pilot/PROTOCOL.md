# Instructor and student pilot protocol

Status: prepared on 2026-09-12. Human sessions have not been conducted. Participants are currently unavailable. Start with application 0.4.1 and the existing scenario packs; source review remains 2026-08-27.

## Purpose and evidence

Test whether an instructor can set up a lesson, students can explain procedural choices and finish a round, and the assessment supports a useful debrief. Observe pacing, instructions, keyboard/touch access, and card/budget balance. Winning alone is not evidence of learning.

Keep three evidence categories distinct: human observation, facilitator interpretation, and synthetic application rehearsal. Only the first supports statements about student experience. The [interim evaluation](EVALUATION.md) records the preparation findings; use the [blank observation sheet](OBSERVATION-SHEET.md) for actual sessions.

## Before inviting a session

- Identify a facilitator and available instructor/student roles. A small first run can use one instructor and two students sharing a device; record actual role counts, not an assumed sample. A person testing both roles is one participant and must be described that way.
- Arrange the session directly with participants. This protocol does not authorize unsolicited messages or public disclosure of their work.
- Explain: participation is voluntary, the activity is formative, and stopping or using an alternative input method is allowed. Do not collect names, contact details, student IDs, grades, disability/diagnosis details, or audio/video recordings.
- Use a dedicated browser profile or private window on the validated build. Check local storage works before play. The app has no submission endpoint. Hosting the build for other devices needs a separately approved delivery route.
- Read the existing instructor guide and student quickstart. Check the content is suitable for the course; Erie and class actions remain previews.
- Before each comparable run, clear local stats. They otherwise mix rounds from different packs, seeds, modes, and versions. Manually label only the run, pack, application/content version, seed, input method, and timer choice in the private observation sheet. Do not use a person's name as a custom seed.

## First instructor setup and student round

Use `jurisdiction-removal-30`, recommended seed `jurisdiction-removal-30-v1`. Apply the pack and verify 30 minutes, one round, 5/3 budgets, and the 5-minute briefing / 18-minute play / 7-minute debrief. Start in Study mode. These are planning allocations, not measured completion times.

| Task | Facilitator prompt | Observe without giving the answer |
| --- | --- | --- |
| Instructor setup | Choose the track and duration, apply the pack, find the objectives, and explain the schedule. | Setup minutes; wrong pack or preview/active confusion; prompts needed. |
| Student orientation | Find the quickstart. Explain the roles and what finishes a round. | Whether the student distinguishes a forum change from the round outcome. |
| File and choose | File a case and select a defendant. State the relevant facts. | Time to first choice; visible facts used; any navigation trouble. |
| Threshold response | Defense chooses a supported attack. Plaintiff predicts, explains, then responds or chooses no response. | Reading time, form clarity, uncertainty, timed versus intentional nonresponse. |
| Reflection | Compare the ruling, revise, and explain one altered fact. | Whether initial/revised answers remain distinct; need for facilitator explanation. |
| Discovery | Build the required proof. Use an exchange if a needed tool is absent. | Missing cards, exchanges, budget remaining, mistaken tools, dead ends. |
| Assessment | Read the outcome, missing proof, wrong moves, and governing sources. | Whether the assessment matches the observed sequence and helps the debrief. |
| Recovery/privacy | Save, reload, and resume. Then clear local game data. | Restored draft/phase; timer behavior; removal of saved writing. |

Give students time to attempt each task. If stuck, first ask which phase and fact matter; then point to the quickstart; finally demonstrate a control if necessary. Record help level 0 (none), 1 (neutral prompt), 2 (guide/control pointer), or 3 (demonstration). Do not count a demonstrated task as independent completion. The app's minimum explanation length is not a quality score.

In one follow-up run, close discovery early and use Rule 56 so the missing-proof assessment is observed. The first 30-minute pack has one round: repeat it with roles exchanged to compare roles. Keep the same seed initially. A second, different seed checks whether a problem is specific to the deal.

## Pacing and accessibility passes

- Record briefing, actual play, written reflection, debrief, and interruption minutes separately using a clock. App round duration includes discussion and writing; it is not an active-work timer. Automated runtime is not classroom pacing evidence.
- Start untimed. Only try a timed repeat when participants are ready. Turning Study mode or No timer off starts a fresh full window for the current timed step. Predictions and revisions remain untimed. Note any unintended expiry and whether the student could find the pause control.
- Ask a willing participant to complete a prediction and revision using only the keyboard. Check focus location, visible focus, labels, form errors, and access to exchanged cards. Observe touch/mobile and zoom where those are actual teaching conditions.
- Offer an untimed or facilitator-operated alternative if timing or controls impede participation. Ask about the control that caused difficulty, not personal medical information. Automated accessibility checks do not substitute for assistive-technology use.

## Coverage and change decisions

After the first round, try the other four existing tracks at 30 minutes: Rule 12, Discovery/Rule 56, Joinder/Supplemental, and Erie/Class Actions Preview. Use the existing lesson-plan rows and recommended seeds. Extend selected tracks to 50/75 minutes to test role rotation and the longer schedule; record untested combinations explicitly.

Collect independent instructor and student feedback: the first confusing instruction, an example of a useful assessment item, whether exchanges helped or displaced reasoning, and one proposed change. Record paraphrased themes without quoting learner writing. Report counts with denominators, including incomplete tasks and sessions stopped early.

Treat a lost answer, inaccessible essential control, inaccurate assessment, or unavoidable no-progress state as a blocker. Reproduce and fix it before the next session. For pacing and balance, compare the same pack/seed, roles, mode, and duration before changing one variable. Do not tune budgets from one loss or claim balance from cooperative scripted wins. Track free exchanges as a provisional rule: do they resolve unavailable tools, or encourage repeated searching instead of reasoning? If repeated comparable observations warrant a limit or cost, test that change separately without making required tools inaccessible again.

Budget misses in the app count attempted actions rejected by the engine. Disabled unaffordable cards do not produce attempts, so record those situations manually. Likewise, an unused card is a hypothesis for review, not proof that it is useless. Stored balance counts combine sessions and should not be compared without the observation sheet's context.

## Privacy and closing the pilot

Keep completed observation sheets in facilitator-controlled private storage outside this public repository. Do not commit raw sheets, browser storage, saved sessions, screenshots of written answers, or replay files. Save/replay contains writing and exact session state. Prefer a synthetic replay of a reproduced bug over distributing a learner replay.

At session end, clear local game data, remove any downloads, and close the dedicated profile/window. Do not promise deletion from browser backups or other copies. Retain only reviewed aggregate outcomes and paraphrased, nonidentifying issues for the public evaluation. Agree a retention period before the session; a proposed default is to delete raw notes within 30 days after facilitator review unless the institution requires otherwise.

Complete the final evaluation only after actual sessions and follow-up checks. Include participant-role counts, tested/untested packs, task completion and help levels, actual minutes, accessibility observations, changes tied to observations, retest results, and unresolved issues. State the limits of the sample and whether the next classroom pilot is supported. Publish any validated application increment using the repository's checks and delivery policy. Human feedback and the final evaluation remain outstanding until those sessions happen.
