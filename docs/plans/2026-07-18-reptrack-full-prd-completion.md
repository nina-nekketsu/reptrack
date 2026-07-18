# RepTrack full PRD and unified design completion implementation plan

> **For Hermes:** Use subagent-driven-development to execute this plan task-by-task with strict RED–GREEN–REFACTOR and frozen-snapshot specification/quality review.

**Goal:** Deliver the complete combined RepTrack product described by the main PRD, Part II design specification, feature-preservation manifest, modal UX PRD and persistent timer PRD—then verify it as one coherent production candidate without deploying before Lloyd's exact approval.

**Architecture:** Preserve the current local-first React/Supabase architecture and dedicated active-session lifecycle row. Extend the durable outbox and owner-scoped schema instead of introducing a second data model. Replace legacy visual islands incrementally behind shared Gym Floor primitives, with truthful real-data surfaces and a minimal service worker whose cache policy respects GitHub Pages build provenance.

**Tech stack:** React 18, React Router 6, CRA/react-scripts, Supabase JS, Jest/Testing Library, GitHub Pages/GitHub Actions, Playwright/CDP browser QA, plain CSS and local SVG icons.

**Canonical matrix:** `docs/REPTRACK-FULL-PRD-ACCEPTANCE-MATRIX-2026-07-18.md`

**Branch/worktree:** `feat/complete-prd-design` at `/Volumes/Sanctum/Boman/reptrack-prd-completion`

**Hard safety gates:** no production Supabase mutation, secret configuration, push, merge or deployment without Lloyd's exact approval for that action. Never print `.env` values. Preserve existing user data and working added features.

---

## Lane and overlap rules

- **Lane A — integrity/sync/schema:** `src/lib/*`, sync-related tests, `supabase/*`, import/export helpers.
- **Lane B — product surfaces:** page data models and pages; coordinate shared components through the integration owner.
- **Lane C — design primitives:** `src/components/ui/*`, icons, Sheet/Dialog, token files; migrates one surface at a time.
- **Lane D — PWA/release/QA:** `public/*`, service worker registration, workflow/scripts/docs.
- `App.js`, `index.css`, `package.json`, global test setup and shared docs are integration-owner files; parallel workers may propose changes but do not edit them simultaneously.

Each implementation slice follows:
1. Add one focused failing behavioral test.
2. Run it and record the expected failure.
3. Implement the smallest complete vertical behavior.
4. Run focused tests, then all tests affected by the slice.
5. Refactor only while green.
6. Commit with requirement IDs in the message/body.
7. Freeze the commit and obtain specification review; fix/re-review until PASS.
8. Obtain code-quality/security review; fix/re-review until APPROVED.

## Task 1 — Lock baseline and executable requirement gates

**Files**
- Create: `docs/REPTRACK-FULL-PRD-ACCEPTANCE-MATRIX-2026-07-18.md`
- Create: `docs/plans/2026-07-18-reptrack-full-prd-completion.md`
- Create: `scripts/check-prd-static-contracts.js`
- Modify: `package.json`
- Test: `scripts/check-prd-static-contracts.test.js`

**TDD behavior**
- Static gate fails when fake routes, functional emoji, forbidden legacy colors/gradients, missing `schema_current.sql`, missing QA checklist, or a deploy script without clean-tree precondition exists.
- Allowlist only token declarations, nonfunctional prose emoji if explicitly approved, and SVG source colors that map to currentColor.

**Commands**
- RED/GREEN: `node --test scripts/check-prd-static-contracts.test.js`
- Gate: `npm run check:prd`
- Baseline: `CI=true npm test -- --runInBand && npm run build`

## Task 2 — Cross-plan session conflict and tombstone completion (R3/R6)

**Files**
- Modify: `src/pages/Workouts.js`, `src/pages/ActiveWorkout.js`
- Modify: `src/lib/activeWorkoutSession.js`, `src/lib/activeWorkoutSessionSync.js`
- Test: `src/pages/Workouts.sessionConflict.test.js`
- Test: `src/lib/activeWorkoutSession.test.js`, `src/lib/activeWorkoutSessionSync.test.js`

**TDD behaviors**
- Starting the same plan resumes.
- Starting a different plan opens one accessible decision sheet.
- Resume existing leaves lifecycle state untouched and navigates to the existing plan.
- End/start writes and pushes an ended tombstone before creating the new active session.
- Failed end push does not silently create an unreconciled second active session.
- Confirmed tombstones older than 24 hours prune; unconfirmed/newer tombstones remain.
- Device A/B offline/online merge cases converge without resurrection.

## Task 3 — Complete durable outbox and unified failure reporter (R7/R9/R24)

**Files**
- Modify: `src/lib/mutationOutbox.js`, `src/lib/sync.js`, `src/lib/clientDiagnosticsRuntime.js`
- Modify callers in exercise/log/plan/settings/coach-state mutation paths.
- Test: `src/lib/mutationOutbox.test.js`, new `src/lib/sync.fullOutbox.test.js`
- Modify: `src/components/SyncIndicator.js`; retire duplicate `SyncBar` usage in `src/App.js`.

**TDD behaviors**
- FIFO/idempotent insert/update/delete for logs; exercise, plan, settings and coach-state mutations.
- Insert dedupe by `(user_id, exercise_id, date)`; updates/deletes use stable remote identity.
- Newer coalesced payload survives an older in-flight success.
- Login, online event and manual retry share one single-flight flush.
- Auth-expired pauses queue and presents re-login; server failures back off; offline stays queued.
- Every background failure routes through the central reporter and diagnostics.

## Task 4 — Canonical schema, migrations and coach RPC contracts (R13–R16)

**Files**
- Create: `supabase/schema_current.sql`
- Move/deprecate: `supabase/schema.sql` → `supabase/legacy/schema.sql`
- Create additive migrations for `coach_state`/RPC corrections/key rotation only where absent.
- Modify: `src/components/SetupScreen.js`, `README.md`
- Create: `docs/operations/coach-share-key-rotation.md`
- Test: `scripts/validate-schema.js`, `scripts/validate-schema.test.js`

**TDD/static behaviors**
- Snapshot contains every table/RPC used by source and full owner RLS.
- RPCs use `exercise_logs` JSONB as single source of truth.
- Explicit user selection replaces `auth.users limit 1`.
- Setup scripts never print secrets; generated key material targets an ignored owner-only file.
- Fresh-project bootstrap and anon negative-test procedure are executable.

**Approval gate:** run production read-only schema comparison first. Applying SQL or rotating a key requires Lloyd to approve the exact statements/target immediately beforehand.

## Task 5 — Complete import/export and coach-state sync (R17/R18)

**Files**
- Create/refactor: `src/lib/dataTransfer.js`, `src/lib/coachStateSync.js`
- Modify: `src/pages/Profile.js`, `src/context/CoachContext.js`, `src/lib/sync.js`
- Test: `src/lib/dataTransfer.test.js`, `src/lib/coachStateSync.test.js`, `src/pages/Profile.test.js`

**TDD behaviors**
- Export is versioned and includes exercises/plans/logs/settings/coach state without auth secrets.
- Import always parses/validates and displays a dry-run diff before additive confirmation.
- Malformed/future versions cannot mutate local data.
- Coach state merges at sub-key level and survives Device A→B without overwriting unrelated settings.

## Task 6 — Truthful route model and fake-surface removal (DS-3/R25)

**Files**
- Modify: `src/App.js`, `src/components/BottomNav.js`
- Delete or convert to redirects: `src/pages/Home.js`, `src/pages/Workout.js`
- Rebuild truthful pages rather than placeholders: Today, History, Progress.
- Test: `src/App.routes.test.js`, `src/pages/productSurfaces.test.js`

**TDD behaviors**
- `/home` redirects to `/today`; `/workout` redirects to `/workouts` unless a concrete plan route exists.
- No reachable route contains fabricated workout names, goals, streaks or dates.
- Every route has loading, empty, error and real-data states.

## Task 7 — Today, Progress and analytics completion (R19/R21/R22/DS-12)

**Files**
- Modify/create: `src/pages/Today.js`, `src/pages/Progress.js`, `src/pages/productSurfaceData.js`
- Create: `src/lib/trainingAnalytics.js`
- Modify save path to record e1RM/PR metadata without duplicating source data.
- Test: `src/lib/trainingAnalytics.test.js`, `src/pages/Today.test.js`, `src/pages/Progress.test.js`

**TDD behaviors**
- Weekly sessions, volume, agreed training-day streak, last workout, resume, cardio, latest PRs.
- Epley e1RM all-time PRs; warmups excluded; tied/noisy values deterministic.
- Muscle-group weekly bars from real metadata.
- One-year fixture computes under 100 ms and rendering stays bounded.
- PR celebration is nonblocking and reduced-motion aware.

## Task 8 — Timer and workout-flow completion (R11/R12, timer PRD, preservation gates)

**Files**
- Modify: `src/context/TimerContext.js`, `src/components/SetTimer.js`, `src/utils/timer.js`
- Modify: `src/components/ExerciseLogModal.js`, `src/pages/ActiveWorkout.js`
- Test: timer reducer/restore/component/active-workout tests.

**TDD behaviors**
- Timestamp-derived source of truth; no interval-derived elapsed state.
- Start/pause/reset, exercise/rest transitions, per-exercise rest and optional auto-start after save.
- Persists navigation/background/refresh/browser and converges cross-device.
- Superset A→rest→B uses one global timer.
- Remove unused 400 ms flash loop; default pulse ≤1 Hz; reduced-motion is static.
- Preserve set identity, previous prefill, done state, dropset children, compact modal and immediate rep feedback.

## Task 9 — Accessible shared primitives and complete overlay migration (R26/DS-4/DS-7)

**Files**
- Create/complete: `src/components/ui/Button.js`, `Input.js`, `Chip.js`, `Row.js`, `Badge.js`, `Dialog.js`
- Modify: `src/components/Sheet.js/.css`
- Migrate every modal/overlay/confirm across pages/components.
- Test: primitive tests plus `src/accessibility.dialogs.test.js`.

**TDD behaviors**
- `role=dialog`, `aria-modal`, initial focus, Tab/Shift-Tab trap, Escape close, trigger focus return, body scroll lock.
- Nested interaction cannot close accidentally; destructive copy identifies impact.
- All controls ≥44 px; inputs ≥16 px; rows keyboard operable.
- No `window.confirm` remains.

## Task 10 — Gym Floor token and icon migration (R27/R28/DS-1/2/6/16)

**Files**
- Modify: `src/index.css`, `src/App.css`, all page/component CSS.
- Create/complete: `src/components/icons/*`, `src/components/ui/*` styles.
- Update: `docs/design-system.md`.
- Verify via `scripts/check-prd-static-contracts.js`.

**TDD/static behaviors**
- Single token source; no legacy palette/gradient refs outside token declarations.
- No functional emoji in JSX; SVG icons use `currentColor` and accessible labeling.
- Typography, spacing, radii, motion and state semantics match Part II.
- Locale/date/lang rule documented and applied consistently.

## Task 11 — Surface-by-surface unified redesign (DS-8–DS-23)

**Sequence**
1. Bottom navigation and app status.
2. ActiveWorkout and logging modal.
3. Workouts/plan editor.
4. Today, History and Progress.
5. Profile/Data & Privacy/Diagnostics.
6. Coach, Coach settings/onboarding/feedback and CoachView.
7. Workout summary/share text and sheet gestures.

**Files**
- Corresponding page/component JSX and CSS; shared primitives only.
- Add focused component tests per migrated behavior.

**Completion evidence**
- No lost manifest behavior.
- Functional reorder and explicit muscle group.
- Haptic/sound toggles respected.
- CoachView freshness over real data.
- Sheet swipe does not conflict with scroll.
- All destructive and empty/error states truthful.

## Task 12 — PWA offline shell and update lifecycle (R30/R31/R34/DS-17)

**Files**
- Create: `public/service-worker.js` (minimal), registration/update controller under `src/lib/`.
- Modify: `src/index.js`, `src/components/UpdateBanner.js`, `public/index.html`, `public/manifest.json`.
- Test: update controller unit tests and Playwright offline/update harness.

**TDD behaviors**
- Hashed assets cache-first; HTML/build-info network-first; navigation fallback is real HTML only.
- Cold offline start works after one visit and local logging remains available.
- Waiting worker displays unified banner; Reload activates safely.
- Checks on mount, visibility return and six-hour interval.
- Kill-switch/unregister path documented and tested.

## Task 13 — CI, deployment guard and observability (R32/R33)

**Files**
- Modify: `.github/workflows/ci.yml`, `package.json`, `scripts/check-clean.js`, `scripts/write-build-info.js`.
- Extend diagnostics tests and Profile UI.
- Create: `docs/operations/github-pages-release.md`.

**TDD/static behaviors**
- `predeploy` invokes clean-tree and origin-main provenance checks.
- CI runs install, static contracts, lint, tests and build before Pages deployment job.
- Deployment job is environment-protected and requires configured repository secrets.
- Build metadata contains a commit reachable from origin/main.
- Diagnostics remain local and redact sensitive payloads.

**Approval gate:** configuring secrets, pushing workflow, merging and triggering Pages requires explicit approval.

## Task 14 — Executable QA handbook and automated browser matrices (R29/R37)

**Files**
- Create: `docs/qa-checklists.md`
- Create: `scripts/qa/` harnesses for subpath assets, authenticated routes, two-device lifecycle, offline/outbox, coach share, update cycle, responsive/axe and rollback drill.
- Store generated evidence outside source or in an explicitly named release-evidence directory.

**Required matrices**
- Primary routes at 320×568, 360×800, 390×844, 420×900, 428×926 and representative landscape.
- Signed-out and authenticated real-data states.
- Keyboard and axe smoke on Workouts, ActiveWorkout, LogModal and Profile.
- iOS Safari/Android Chrome manual confirmation for device-specific PWA/haptic behavior.
- One real two-device lifecycle with all three R3 cases, plus timer and coach-state convergence.

## Task 15 — Final gates, frozen review and release candidate

1. Run clean/status/provenance/static/security/secret checks.
2. `npm ci` from lockfile in a fresh worktree.
3. Run lint, full tests, production build and bundle budget.
4. Run schema validator/fresh bootstrap and approved production read-only checks.
5. Serve the exact commit under `/reptrack/`; execute authenticated/subpath/offline/responsive/axe matrices.
6. Record all evidence in a release audit tied to the exact SHA.
7. Freeze the snapshot and obtain independent specification review against every matrix row.
8. Fix Critical/Important findings with regression tests and rerun spec review.
9. Obtain independent code-quality/security review; fix and rerun until approved.
10. Prepare exact merge/deployment/rollback commands and show them to Lloyd.
11. Do not push, merge, alter production schema/secrets or deploy until Lloyd explicitly approves the exact action immediately beforehand.

## Definition of done

The job is complete only when:

- Every row in the full acceptance matrix is Done on one frozen commit.
- Every added behavior in the preservation manifest has a named automated regression and browser evidence where specified.
- All primary routes use the unified Gym Floor design system with no fabricated data or legacy visual island.
- Schema, RLS, coach sharing, sync, offline/PWA, timer and two-device contracts are verified.
- Full CI/build/browser/accessibility/performance/security gates pass.
- Independent spec and quality reviews approve the same snapshot.
- Lloyd receives an honest final completeness report and separately approves the exact production actions.
