# RepTrack PRD Execution Implementation Plan

> **For Hermes:** Use subagent-driven-development task-by-task, strict TDD, spec review before quality review, and keep the original dirty checkout untouched.

**Goal:** Execute the approved RepTrack upgrade/design PRD in dependency order, beginning with data/session correctness and ending with verified visual redesign and release readiness.

**Architecture:** Work from fetched `origin/main` in the isolated Sanctum worktree. Extract testable pure lifecycle/comparison logic, route persistence through single APIs, then layer the Chalk & Signal design system and screen changes on proven state semantics. Preserve localStorage compatibility and make cloud/schema changes only additively and behind separate approval gates.

**Tech Stack:** React 19, Create React App/Jest/Testing Library, JavaScript, CSS, localStorage, Supabase, GitHub Pages.

---

## Global gates

- **Pre-flight gate:** original dirty checkout remains unchanged; execution branch starts from `origin/main` `131e494`.
- **Revision gate:** every code slice follows RED → GREEN → full tests/build.
- **Safety gate:** no deploy, production DB write/migration, force operation, or deletion without Lloyd’s exact approval.
- **Review gate:** spec compliance passes before code quality; critical/important findings block progression.
- **Visual gate:** UI slices require real browser smoke tests, responsive screenshots, contrast/touch/keyboard/reduced-motion checks.

## Phase 0 — Baseline and stop-the-bleeding correctness

### Task 0.1: Establish reproducible baseline

**Files:** no production changes.

1. Install exact dependencies with `npm ci` in the execution worktree.
2. Run current Jest suite non-interactively and record baseline failures.
3. Run `npm run build` and record baseline warnings/failures.
4. Confirm the original checkout status is unchanged.

### Task 0.2: Active-session lifecycle pure contract (R3/R4)

**Create:**
- `src/lib/activeWorkoutSession.js`
- `src/lib/activeWorkoutSession.test.js`

**Behavior:** normalize legacy sessions; create active sessions; create ended tombstones; merge by `updatedAt`; `ended` wins timestamp ties; malformed/absent timestamps are deterministic; only `status: active` is visible as active.

**TDD:** write focused tests first and observe failure; implement only enough to pass; run full suite.

### Task 0.3: Single local active-session store API (R4)

**Modify:**
- `src/lib/activeWorkoutSession.js`
- tests

**Behavior:** safe read, write, end, and event dispatch around `activeWorkoutSession`; pages no longer read/write the key directly.

### Task 0.4: Route Workouts and ActiveWorkout through the API (R2/R4)

**Modify:**
- `src/pages/Workouts.js`
- `src/pages/ActiveWorkout.js`
- focused component tests

**Behavior:** start stamps lifecycle fields; end writes tombstone; no undefined helper; elapsed time clamps to zero; a non-active tombstone never resumes.

### Task 0.5: Prevent duplicate exercise sessions (R8)

**Modify:**
- `src/components/ExerciseLogModal.js`
- `src/utils/exerciseHelpers.js` if required
- focused tests

**Behavior:** current-workout reopen sets `editingSession`, retains `date`/`remoteId`, and updates one session; explicit new-session action is the only duplication path.

### Task 0.6: Preserve remote identity (R8/R9 prerequisite)

**Modify:**
- sync/session helper files and tests

**Behavior:** successful inserts persist `remoteId`; subsequent saves use update; duplicate-safe matching is deterministic.

## Phase 1 — Trustworthy sync and release integrity

### Task 1.1: Dedicated active-session sync semantics (R3–R5)

Implement lifecycle sync without allowing unrelated settings pushes to clobber session state. Add merge/tombstone cross-device tests. Production schema choice/migration remains a separate approval gate.

### Task 1.2: Idempotent offline outbox (R9)

Add queued insert/update/delete operations, deterministic IDs/dedupe, reconnect/manual flush, pending-count API, and tests for replay/idempotency.

### Task 1.3: Sync truth surfaces (R7/R24/DS-14)

Unify offline/syncing/pending/error UI with actionable retry/detail states and non-blocking workout flow.

### Task 1.4: Release integrity and diagnostics (R23/R32/R33)

Add error boundary, diagnostics, clean-tree deploy gate, CI build/test pipeline, and build-id verification. Do not deploy.

## Phase 2 — Design-system foundation

### Task 2.1: Token foundation and legacy palette purge (DS-1/DS-2)

Create Chalk & Signal semantic tokens; remove body conflict; migrate hard-coded colors/gradients with screenshot evidence and contrast checks.

### Task 2.2: Accessible dialog/sheet and reduced motion (DS-4/DS-5)

Build focus-trapped sheet/modal primitive, migrate destructive confirmations, replace rapid timer flash, and test keyboard/reduced-motion behavior.

### Task 2.3: SVG icons and UI primitives (DS-6/DS-7)

Implement local SVG icons plus Button/Input/Chip/Row/Badge primitives with all required states and 44×44 targets.

### Task 2.4: App shell and bottom navigation (DS-8)

Implement Today/Workouts/Coach/Exercises/Profile navigation, active indicator, badges, and active-session dot.

## Phase 3 — Gym logging experience

### Task 3.1: ActiveWorkout anatomy (DS-9)

Calm sticky header, next-up states, bottom action bar, three-tap end flow, safe areas, and responsive behavior.

### Task 3.2: Set-row steppers, ghosts, undo, and validation (DS-10)

Implement exact set-row grid, previous-set ghosts, rapid entry, undo, keyboard handling, and explicit invalid states.

### Task 3.3: Immediate rep feedback (R10a)

**Create/modify:** a pure comparison helper, tests, `ExerciseLogModal.js`, set-row CSS.

**Required tests:** same weight/more reps → improved; same weight/fewer → regressed; same reps → neutral; any weight change → neutral; missing match → neutral. UI feedback appears after confirmation and includes non-color text/icon/ARIA.

### Task 3.4: Timer card redesign (DS-11)

Reconcile existing remote timer changes, implement one dominant phase, quick-select sheet, advisor placement, sound/haptic settings, and reduced-motion checks.

## Phase 4 — Honest product surfaces

### Task 4.1: Remove fake routes and create Today shell (DS-3)

Delete/redirect fake Home/Workout/Progress and replace Dashboard with no-fake-data Today shell.

### Task 4.2: Real Today metrics (DS-12)

Implement tested real-log calculations, resume card, week stats, last workout, PRs, cardio, skeleton/empty states.

### Task 4.3: Real History and detail (DS-13)

Implement grouped real sessions, detail/edit/delete, empty state, bounded performance, and tests.

### Task 4.4: Profile/Data & privacy/PWA identity (DS-15/DS-17)

Add export/import dry-run UI, storage explanation, diagnostics, real manifest/title/icons, and installability checks.

## Phase 5 — Coach and P2 completion

Implement warm-up/drop/superset behavior, coach restyle/content honesty, CoachView freshness, real plan reorder, haptic/sound toggles, PR celebration, and remaining sheet/share polish (DS-18–DS-23), each as a separate TDD/reviewed slice.

## Final integration and release-readiness review

1. Full Jest suite passes with no watch mode.
2. Production build passes; warnings triaged.
3. Browser walkthrough covers auth/setup, Workouts, ActiveWorkout, logging, timer, Today, History, Coach, Exercises, Profile, offline/error/empty/loading states.
4. Screenshot matrix covers 320×568, 360×800, 390×844, 428×926, and 844×390.
5. Accessibility checks cover focus order/traps, labels, contrast, touch targets, reduced motion, safe areas, and keyboard obscuration.
6. Verify no fabricated data, direct active-session key writers, unsafe deployment changes, secrets, or private workout data were introduced.
7. Independent final integration review returns PASS.
8. Present commits, test/build evidence, screenshots, migration/deploy plan, and exact release action to Lloyd for separate approval.
