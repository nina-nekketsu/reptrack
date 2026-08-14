# Live-log upgrade QA evidence — 2026-08-14

## Scope and provenance

- PRD: `/Volumes/Sanctum/Static/RepTrack/2026-08-14-reptrack-live-training-log-prd-codex-ready.md`
- Compared range: `origin/main` (`64c69e8`) through `8214512`, `b3411ed`, and `b3084d7`.
- Review result: AC-01 through AC-24 are covered by automated unit, component, integration, and contract evidence below.
- Additional gate defect found during slice 7: `npm run check:prd` rejected inline visual styles in `ActiveWorkout.js` and `OverlayMotion.test.js`. The focused progress-bar test was changed first and failed, then the progress fill was converted to an accessible SVG transform attribute and the test fixture style was applied imperatively. The final PRD contract gate passes.
- No schema migration, destructive history rewrite, merge, or deployment was performed.

## Requirement-to-real-evidence matrix

`Automated pass` means the cited test exercised the state against production code. `Visual pending` means direct app interaction was not available in this session; it is not being claimed as a manual pass.

| AC | Status | Real evidence |
|---|---|---|
| AC-01 | Automated pass; visual pending | `ExerciseLogModal.positioning.test.js` verifies open initialization and Log-tab positioning; `ActiveWorkout.exerciseHandoff.test.js` verifies the live-workout handoff. |
| AC-02 | Automated pass; visual pending | `ExerciseLogModal.positioning.test.js` asserts the first incomplete primary row is the anchor and scroll target. |
| AC-03 | Automated pass; structural viewport pass | `getAnchorScrollTop` unit coverage plus 320×568, 390×844, and 430×932 structural Chromium screenshots/metrics. |
| AC-04 | Automated pass; visual pending | Positioning component test uses rows 1–2 done and row 3 incomplete and retains row 2 context when it fits. |
| AC-05 | Automated pass; visual pending | Positioning component/unit tests select the last completed primary row when all rows are done. |
| AC-06 | Automated pass; visual pending | Positioning component test switches squat to bench and asserts a fresh anchor and second open-only scroll. |
| AC-07 | Automated pass | Positioning component test edits reps after open and asserts no additional auto-scroll; reduced-motion branch is also exercised. |
| AC-08 | Automated pass; visual pending | `ExerciseLogModal.activeWorkout.test.js` asserts Add Set changes target 2→3 immediately; parent integration covers live badge/state input. |
| AC-09 | Automated pass | `exerciseDraftProgress.test.js` and modal integration exclude the automatic placeholder from the target. |
| AC-10 | Automated pass; visual pending | Modal integration asserts remove changes target 3→2 and Undo restores 3. |
| AC-11 | Automated pass; visual pending | Modal integration asserts check/uncheck callbacks and summary changes; parent integration asserts live badge/color consumption. |
| AC-12 | Automated pass; visual pending | Parent integration regresses a persisted done exercise to `almost` when draft target grows. |
| AC-13 | Automated pass; visual pending | Draft and parent integration cover target reduction and the authoritative progress-state machine. |
| AC-14 | Automated pass; visual pending | Draft unit/integration tests exclude warm-ups and dropset children while counting a dropset parent once. |
| AC-15 | Automated pass | Parent save/reopen integration reconstructs persisted counts without double-counting; modal session-integrity test verifies update-in-place. |
| AC-16 | Automated pass | Parent integration closes an unsaved regressed draft and restores the persisted done/Logged state. |
| AC-17 | Automated pass; visual pending | `exerciseHelpers.test.js` and `ExerciseLogModal.bestRecord.test.js` select the maximum exact exercise/set/reps weight. |
| AC-18 | Automated pass | Exact-match selector tests ignore a heavier result from another logical set number. |
| AC-19 | Automated pass | Exact-match selector/UI tests ignore another rep count and recompute on reps change. |
| AC-20 | Automated pass | Selector tests exclude warm-up, dropset child, placeholder, invalid/deleted, unsaved, and currently edited session data. |
| AC-21 | Automated pass; visual pending | Best-record component test changes reps from 8→9→blank and asserts immediate helper recomputation. |
| AC-22 | Automated pass; visual pending | Best-record component test asserts `No record for 9 reps` and `Enter reps to view best`, with stale Best removed. |
| AC-23 | Automated pass; visual pending | Best-record component tests assert intended row helpers render `Best:` and no row helper renders `Last:`. |
| AC-24 | Automated pass | Best-record component test preserves `Same as last set` and `Last Session Sets`; the complete Jest suite protects other intentional last-session surfaces. |

## Final automated gates

| Command | Result |
|---|---|
| `CI=true npm test -- --runInBand` | PASS — 60 suites, 325 tests, 0 failures, 0 snapshots. |
| `npm run lint` | PASS — 0 errors, 0 warnings (Browserslist age notice only). |
| `npm run build` | PASS — production build compiled; gzip: main JS 190.82 kB, main CSS 21.53 kB, chunk JS 1.76 kB. |
| `npm run test:prd` | PASS — 20/20 Node contract tests. |
| `npm run check:schema` | PASS — canonical schema. |
| `npm run check:prd` | PASS — PRD static contracts, release QA contracts, and build metadata. |
| `npm run qa:mobile-readability:static` | PASS — 13/13 static CSS/source verdicts. |
| `npm run qa:mobile-readability` | PASS — 8/8 Chromium viewports, 17/17 verdicts per viewport. |
| `git diff --check` | PASS. |

The build and Chromium harness both emitted only the known six-month-old Browserslist data notice; it did not fail a gate.

## Mobile evidence and inspection

Fresh structural Chromium evidence is under `docs/qa/artifacts/live-log-upgrade/`:

- `mobile-structural-320x568.png`
- `mobile-structural-390x844.png`
- `mobile-structural-430x932.png`
- `mobile-readability-qa-results.json`
- `mobile-readability-static-audit.json`
- `interaction-qa-status.md`

Visual inspection of those screenshots found no document/modal horizontal overflow, clipped set controls, light-theme leakage, control overlap, or footer/sticky collision. The harness also measured ≥44 px targets and passing contrast. These screenshots are the repository's structural fixture and still contain legacy fixture copy such as `Last:`; they do **not** prove the production component's Best helper or live state transitions. Those behaviors are proven by the cited production-component tests.

## Honest caveats and remaining QA

The in-app browser runtime connected after a corrupt macOS sidecar was moved aside, but reported no available browser backend. Therefore direct production-app interaction for first open, reopen, all-complete, add/remove/Undo colors, Best/no-record/blank reps, warm-up/dropset, Overview roundtrip, keyboard/focus, and reduced motion could not be performed in this session. Those states remain **Electa QA pending** and are explicitly not marked as manual passes. The repository's headless Chromium structural harness did run successfully at all requested viewport sizes.

NOT MERGED. NOT DEPLOYED.
