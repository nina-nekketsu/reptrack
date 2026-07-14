# RepTrack — Active Current-State Audit

**Date:** 2026-07-13
**Repository audited:** `/Volumes/Sanctum/Hayato/reptrack-online` (local clone of `https://github.com/nina-nekketsu/reptrack.git`)
**Live app:** `https://nina-nekketsu.github.io/reptrack/`
**Audit authority:** handoff `20260713-044244-12ab7576` (agent-bridge). Read-only audit; no builds, tests, deployments, credential access, or private workout data were touched.

## Evidence labels

- **[VERIFIED]** — read directly from local source, git metadata, or repo SQL.
- **[OBSERVED LIVE]** — observed via public HTTP GET against the deployed site (build-info.json, index.html, minified bundle).
- **[INFERRED]** — a conclusion that follows from verified evidence but was not executed/observed directly (no builds or tests were run per constraints).
- **[OPEN QUESTION]** — cannot be resolved without production DB access, a fetch of remote git objects, or Lloyd's input.

---

## 1. Executive summary

RepTrack is a mobile-first, offline-first workout logger: React 19 (CRA) + HashRouter on GitHub Pages, localStorage as primary store, optional Supabase (auth + Postgres + RLS + RPC) last-write-wins sync, a read-only tokenized coach share view, a local rules-based "AI Coach," and a persistent timestamp-based workout timer. The core logging loop (plan → start session → log sets → records/graphs) is genuinely good for one-handed gym use and works without any account.

The five most consequential findings:

1. **The working tree contains an unfinished fix that currently breaks the Workouts page.** Uncommitted `src/pages/Workouts.js` calls `saveActiveSession(...)` (lines 469, 477) after the uncommitted edit deleted the local helper of that name; only `saveActiveWorkoutSession` is imported. Start/End from the Workouts page throws a `ReferenceError`. [VERIFIED]
2. **The stale active-session bug (the reported cross-device incident) is real, unfixed in production, and the in-flight fix is incomplete in a way that would make resurrection worse.** Details in §8. [VERIFIED code paths; OBSERVED LIVE that the fix is not deployed]
3. **The local clone is 5 commits behind the deployed source.** Remote `main` = `131e4944` (2026-03-23, deployed 2026-07-02); local HEAD = `f7ce3aa` (2026-02-25). The uncommitted local work was written on a stale base and overlaps files changed remotely. [VERIFIED via `git ls-remote` + GitHub API + live build-info.json]
4. **The repo's SQL cannot provision the database the app actually uses.** `sync.js` reads/writes `exercise_logs`, `user_settings`, `workout_timer_state`; `supabase/schema.sql` defines a different, normalized schema (`exercise_sessions`, `exercise_sets`, `plan_exercises`) that the app never writes — but which both coach RPCs read. Production state is therefore not reproducible from the repo, and the coach share view reads tables the current app does not populate. [VERIFIED at source level]
5. **Half the app's routes are placeholder screens with hard-coded fake data** (Dashboard — the default landing route — Home, Workout, History, Progress). [VERIFIED]

None of this requires a rebuild. The data model, sync skeleton, timer architecture, and coach engine are sound foundations; the problems are lifecycle correctness, repo hygiene, and unfinished surface area.

---

## 2. Repository, stack, and runtime inventory

### 2.1 Stack [VERIFIED — `package.json`]

| Concern | Choice |
|---|---|
| UI | React 19.2.4, Create React App (`react-scripts` 5.0.1), no TypeScript |
| Routing | `react-router-dom` 7.13.0, `HashRouter` (GitHub Pages compatible) — `src/App.js:89` |
| Backend | `@supabase/supabase-js` 2.97.0 (auth, Postgres, RLS, RPC) — client is `null` when env vars absent (`src/lib/supabase.js`) |
| Persistence | localStorage primary; Supabase secondary (last-write-wins) — `src/lib/sync.js:1-7` |
| Deploy | `gh-pages` 6.3.0, `npm run deploy` → `gh-pages -d build --no-history` |
| Tests | Jest + React Testing Library (present but effectively unused, §14) |
| Analytics | `web-vitals` wired to a no-op (`src/index.js:17`, `reportWebVitals()` with no callback) |

### 2.2 Source layout [VERIFIED]

- `src/pages/` — 16 pages (Workouts, ActiveWorkout, Exercises, Coach, CoachOnboarding, CoachSettings, CoachView, Profile + 5 placeholder pages + CSS).
- `src/components/` — 15 components (ExerciseLogModal, ExerciseHistoryModal, SetTimer, WorkoutSummary, CoachFeedback, RestAdvisor, RecordBadges, VolumeGraph, PRBlock, ProgressGraphBlock, AuthScreen, SetupScreen, SyncIndicator, UpdateBanner, BottomNav).
- `src/context/` — AuthContext, TimerContext, CoachContext.
- `src/lib/` — supabase, sync, coachShare, coachEngine.
- `src/data/` — exerciseLibrary (~157 lines), trainingPlans (12 templates, 523 lines), models.js (dead scaffold, imported nowhere).
- `src/utils/` — exerciseHelpers, timer, buildInfo.
- `supabase/` — schema.sql, coach_share.sql, hayato_coach_rpc.sql, migration_delete_policies.sql, workout_timer_state.sql.
- `.planning/`, `docs/` — PRDs and GSD planning docs (partly stale, §16).
- Total `src/` ≈ 12.9k lines including CSS (measured with `wc -l`).

### 2.3 Git state at audit time [VERIFIED]

- Branch `main` at `f7ce3aa` (2026-02-25), tracking `origin/main` (stale remote-tracking ref, also `f7ce3aa`).
- Dirty working tree: modified `src/lib/sync.js` (+78 lines), modified `src/pages/Workouts.js` (+92/−20), untracked `src/pages/ActiveWorkout.js.backup`.
- `src/pages/ActiveWorkout.js.backup` contains **unresolved merge-conflict markers** (`<<<<<<< HEAD` … `>>>>>>> f7ce3aa8…`) — it is a leftover conflicted copy, not a usable file. [VERIFIED via diff]
- No `.github/workflows/` directory — deploys are manual from a workstation. [VERIFIED]

### 2.4 Local ↔ remote ↔ live parity [VERIFIED / OBSERVED LIVE]

| Ref | Commit | Date | Note |
|---|---|---|---|
| Local HEAD / local `origin/main` | `f7ce3aa` | 2026-02-25 | audit target base |
| GitHub `main` (via `git ls-remote` + API) | `131e4944` | 2026-03-23 | 5 commits ahead of local |
| Deployed build (`build-info.json`) | `131e4944`, buildId `131e4944` | built 2026-07-02 | bundle `static/js/main.5011fa57.js`, ~587 KB minified |
| Local `public/build-info.json` (gitignored) | `f7ce3aa8` | built 2026-05-03 | stale local artifact |

Commits on remote `main` that the local clone does **not** have (from GitHub API):

- `7237d999` — fix: done badge only turns green after all prescribed sets are logged
- `996275ca` — feat: configurable default rest time + quick-select buttons
- `202dcbd2` — fix: add Timer Defaults UI section to Profile tab
- `c97c0b26` — ui: compact timer for mobile
- `131e4944` — fix(auth+load): add forgot-password flow and harden startup when storage is blocked

Parity consequences:

- Everything in this audit describing local-only behavior of the timer UI, done-badge logic, Profile settings, and auth screen **may differ from the live app** in those five areas. Findings below are labeled accordingly.
- The deployed `src/lib/sync.js` (fetched from raw.githubusercontent at `131e4944`) does **not** contain the active-session sync helpers; the live bundle has **zero** occurrences of the new `activeWorkoutSessionChanged` event string. The stale-session fix is local-only and undeployed. [OBSERVED LIVE]
- The local uncommitted edits to `Workouts.js` sit on the pre-`7237d999` base; the remote done-badge fix plausibly touches the same or adjacent files. **Merge risk is high; nothing must be reset or rebased without Lloyd.** [INFERRED]

---

## 3. Architecture and data flow [VERIFIED]

```
localStorage (source of truth)
  exercises            [{id, name, muscleGroup, type}]
  workoutPlans         [{id, name, createdAt, exercises:[{exerciseId, prescribedSets, prescribedReps}]}]
  exerciseLogs         { [exerciseId]: [{date, sets:[{reps,weight,intensity?,rir?}], bestSet, totalReps, totalVolume, remoteId?}] }
  activeWorkoutSession {planId, planName, startedAt}            ← the incident-prone key
  workoutTimerState    {phase, exerciseId, exerciseStartedAt, restEndAt, …}
  currentPlanId, timerRestDefaults, timerAutoStart
  coach_profile, coach_metadata, coach_cardio                    (localStorage only — never synced)

Supabase (when configured + authenticated)
  exercises            (upsert onConflict id,user_id — text client ids)
  workout_plans        (upsert; exercises stored as jsonb column)
  exercise_logs        (flat: one row per logged session; insert-once, update via remoteId)
  user_settings        (single jsonb blob per user; + activeWorkoutSession in the uncommitted code)
  workout_timer_state  (single jsonb row per user, upserted on phase transitions)
  coach_shares + get_coach_data RPC        (tokenized read-only coach view)
  coach_api_config + get_coach_workout_data RPC (external coach agent access, static key)
```

Flow: `AuthContext` on login runs `pullAll` (merge remote→local; remote wins by id, logs deduped per exercise by exact `date` string) then `pushAll` (local→remote; logs are insert-only for rows lacking `remoteId`). Individual UI actions fire single-entity pushes (`pushPlan`, `pushExercise`, `pushSession`, `updateRemoteSession`) fire-and-forget with `console.warn` on failure. There is **no retry queue, no offline outbox, no conflict detection beyond last-write-wins**. (`src/lib/sync.js`, `src/context/AuthContext.js:31-44`)

The coach feature ("AI Coach") is a **local rules engine** (`src/lib/coachEngine.js` — overload lever detection via Epley-scored best previous set, rest tables, progression/RIR tables, message generation). No LLM call, no Edge Function invocation exists anywhere in `src/`. [VERIFIED] The handoff described "Edge Function-backed coaching" — no `supabase/functions/` directory exists in this repo. [OPEN QUESTION — see §17-Q5]

---

## 4. Information architecture and navigation

**Bottom nav (5 tabs):** Dashboard `/`, Workouts `/workouts`, Coach `/coach`, Exercises `/exercises`, Profile `/profile` (`src/components/BottomNav.js:5-11`). Coach share view `/coach/:token` renders outside the auth guard (`src/App.js:93`).

Findings:

- **F-IA-1 [VERIFIED, P1]** The default route `/` is `Dashboard` — four stat cards all rendering `—` placeholders (`src/pages/Dashboard.js`). The first screen of every visit is dead. Real activity lives in Workouts/Exercises.
- **F-IA-2 [VERIFIED, P1]** Four routed pages contain hard-coded fake data: `Home.js` ("🔥 5 days" streak, "Yesterday — Legs"), `Workout.js` (static exercise list + non-functional "Start Workout" button), `History.js` (fictional February sessions), `Progress.js` (empty promise text). Home/Workout/History/Progress are not in the nav but are reachable by URL and by guessing; they present fabricated data as if real.
- **F-IA-3 [VERIFIED, P1]** There is no real workout-session history view anywhere: past *workouts* (as opposed to per-exercise logs) are not queryable. History exists only per exercise inside modals (`ExerciseLogModal` Overview tab, `ExerciseHistoryModal`). Consistency/streak/frequency are not computable by the user.
- **F-IA-4 [VERIFIED, P2]** Two parallel "plan" systems coexist and never touch: user `workoutPlans` (localStorage, what you actually run) and the 12 coach `trainingPlans` templates (`src/data/trainingPlans.js`, selected in CoachOnboarding/CoachSettings but never instantiated into a runnable workout). Selecting a coach plan changes dashboard copy only.
- **F-IA-5 [VERIFIED, P2]** `src/data/models.js` is dead scaffolding imported by nothing.

---

## 5. Onboarding, auth, setup

- Flow: unconfigured → `SetupScreen` (skippable, per-load state `src/App.js:34`); configured+logged-out → `AuthScreen` (email/password sign-in/up); logged-in → app. [VERIFIED]
- **F-AUTH-1 [VERIFIED local / OBSERVED LIVE differs]** Local `AuthScreen.js` has no password-reset path. The live build (`131e4944`) includes a forgot-password flow (commit message + "Forgot" strings in the live bundle). Local source is behind.
- **F-AUTH-2 [VERIFIED, P1]** `SetupScreen.js:34` and `README.md` instruct new installs to run `supabase/schema.sql` — which provisions the *wrong* (normalized) schema. A fresh install following the docs gets a database missing `exercise_logs`, `user_settings`, and `workout_timer_state`; every log/settings sync call would fail (fire-and-forget console errors). The documented setup path does not produce a working sync install. [INFERRED consequence of verified drift]
- **F-AUTH-3 [VERIFIED, P2]** No sign-in rate feedback beyond Supabase error text; no OAuth/magic-link; acceptable for a single-user app.
- **F-AUTH-4 [OBSERVED LIVE parity note]** Startup hardening for blocked storage (private-mode Safari etc.) exists only in the undeployed-locally remote commit `131e4944`; local code calls `localStorage` unguarded at module scope in several `useState(loadX)` initializers — a storage-blocked browser crashes the app before render. Local gap, live fixed. [INFERRED from commit message; local code paths VERIFIED]

---

## 6. Workout planning (Workouts page)

`src/pages/Workouts.js` [VERIFIED, uncommitted version]:

- Plan picker (native `<select>`), + New plan modal, edit mode (prescription editor modal, remove exercise), Add Exercise modal (search + inline create), seed plans/exercises merged idempotently into localStorage at load (`loadPlans`, `loadAndMergeExercises`).
- The uncommitted diff adds a third seed plan (`upper-body-volume-day`), reorders one exercise, and hardens seed insertion indices; it also splices `ub-cubw` into an existing user copy of the volume plan.
- **F-PLAN-1 [VERIFIED, P0 — working tree]** `handleStart` (line 469) and `handleEndSession` (line 477) call `saveActiveSession(...)`, which no longer exists in this file and is not imported (the committed version defines it at HEAD line 145; the uncommitted edit removed it). Any Start/End tap on this page throws `ReferenceError: saveActiveSession is not defined`. CRA's `no-undef` lint would also fail a CI build. This code must not ship as-is.
- **F-PLAN-2 [VERIFIED, P2]** Edit mode shows a drag handle (`⋮⋮`, line 663) but no drag-and-drop is implemented — exercises cannot be reordered at all.
- **F-PLAN-3 [VERIFIED, P2]** Seed-plan mutation logic writes to localStorage during `useState` initialization (render phase side effect); on a brand-new device this races with a concurrent `pullAll` merge (both write `workoutPlans`). Last writer wins; seeds can duplicate user intent or resurrect deleted seed plans forever (a user who deletes "Legs & Biceps Day" gets it re-seeded every visit). [VERIFIED logic; resurrection INFERRED]
- **F-PLAN-4 [VERIFIED, P2]** New-exercise creation inside AddExerciseModal hard-codes `muscleGroup: 'Legs'` (line 306) with no way to choose.

---

## 7. Active workout and session state

`src/pages/ActiveWorkout.js` [VERIFIED]:

- Header (plan name, elapsed, x/y exercises, progress bar), exercise rows opening `ExerciseLogModal`, warm-up cardio banner (coach), completion banner, end-confirmation overlay, coach summary modal.
- Session auto-creation: if no active session **or the active session belongs to another plan**, visiting `/workout/:planId` silently replaces it (`lines 118-126`) — no confirmation, the other plan's in-progress session is destroyed locally. **F-AW-1 [VERIFIED, P1]**
- "Done" per exercise = *any* log with `date >= startedAt` (`isLoggedThisSession`, lines 145-151). Remote commit `7237d999` (not in local clone) changes this to all-prescribed-sets; live behavior differs from local source. [OBSERVED LIVE parity caveat]
- **F-AW-2 [VERIFIED, P1 — data integrity]** Re-opening an already-logged exercise during the active session pre-populates the previous sets plus a blank row (`ExerciseLogModal.js:55-92`), but saving **always creates a new session row** (`saveSession`, lines 218-232 — `editingSession` is reset to null on open). Logging 3 sets, reopening to add a 4th, and pressing Done stores two overlapping sessions (3 sets + 4 sets = 7 sets counted). Today-volume in BottomNav, exercise "Last:" lines, records, and pushed `exercise_logs` rows all double-count. The workout summary partially masks this by reading only the latest session (`ActiveWorkout.js:174`).
- **F-AW-3 [VERIFIED, P2]** `formatElapsed` trusts device clock vs stored ISO string; cross-device clock skew or timezone-shifted resume shows negative/garbled elapsed. Cosmetic but visible in the incident scenario.
- No pause, no per-set rest auto-trigger from the plan, no notes, no RPE-free quick mode toggle. Dropsets, warm-up set flagging, and supersets are **not representable** in the logging model (`sets` are flat `{reps, weight, intensity?, rir?}`), despite the coach templates modeling `warmupSets`/`superset` groups (`src/data/trainingPlans.js:8-14`). **F-AW-4 [VERIFIED, P2 scope gap]**

---

## 8. Cross-device sync, offline behavior, and the stale active-session incident

### 8.1 Baseline sync behavior [VERIFIED]

- Pull merges: exercises/plans by id (remote wins), logs per exercise deduped by exact `date` string equality (`sync.js:163-175`), settings blob restored key-by-key, timer state applied only if local is idle (`sync.js:203-212`).
- Push: logs are insert-only for rows without `remoteId`; `pushLogs` then back-annotates `remoteId` matching on `(date, !remoteId)` (`sync.js:286-296`) — fragile if two sessions share a date string.
- **F-SYNC-1 [VERIFIED, P1]** Edits to an already-pushed session go through `updateRemoteSession` exactly once, fire-and-forget, at save time (`ExerciseLogModal.js:210-217`). If the device is offline at that moment, the local edit is permanent but the remote row is never updated — `pushAll` skips rows that have a `remoteId`. Silent divergence with no retry and no indication.
- **F-SYNC-2 [VERIFIED, P2]** Deletes of never-synced sessions are local-only (correct), but a session pushed by device A and deleted on device B before B ever pulled would survive remotely and re-appear. Delete propagation relies on `remoteId` presence on the deleting device.
- **F-SYNC-3 [VERIFIED, P2]** `pullAll` downloads the full `exercise_logs` table for the user on every login/sync — unbounded growth, no pagination or since-cursor.
- Status surfacing: `SyncIndicator` (✓/↻/⚠/⚡ offline) and `SyncBar` exist; errors collapse to "Sync failed" with no retry affordance except Profile → "Sync now". [VERIFIED]

### 8.2 The stale active-session incident (handoff: "stale active workout state across devices while logs stored fine")

Root cause chain, as of the **deployed** build [OBSERVED LIVE + VERIFIED against `131e4944` sources]:

1. `activeWorkoutSession` lives only in localStorage; it is not in the settings blob in the deployed `sync.js`. Each device has its own independent copy.
2. Logged *sets* sync fine through `exercise_logs` — matching the incident report (logs stored, session state stale).
3. Ending a workout on device A clears only A's localStorage. Device B keeps showing "Session active · tap to resume" forever (Workouts banner), with elapsed time growing unboundedly.

The **uncommitted local fix** (in `sync.js` + `Workouts.js`) syncs `activeWorkoutSession` through `user_settings.settings` with newest-timestamp-wins (`chooseNewestActiveWorkoutSession`, `sync.js:40-46`) and a `activeWorkoutSessionChanged` window event. It is incomplete and currently *worsens* the failure mode:

- **F-SYNC-4 [VERIFIED, P0]** `ActiveWorkout.js` still uses its own localStorage-only `saveActiveSession` (lines 54-60) for both session creation (line 125) and session end (lines 204, 211). Ending a workout from the Active Workout page — the normal path — never clears the remote copy. The next `pullAll` on *any* device (including the one that just ended) sees `local == null`, `remote == stale session` and **resurrects the ended session** (`sync.js:193-200`: null local loses to any remote). The only code path that clears remote state is `Workouts.handleEndSession` — which crashes (F-PLAN-1).
- **F-SYNC-5 [VERIFIED, P0 — design]** Clearing is modeled as *absence*, so "ended" can never win a newest-wins merge against a surviving copy. The merge needs an explicit tombstone (e.g. `{endedAt}` retained in settings) or a monotonic `updatedAt` on a `status: 'ended'` record. Additionally, sessions created by `ActiveWorkout.js` have no `updatedAt` at all, so `activeSessionTimestamp` falls back to `startedAt` — a device that merely *re-saves* a stale copy (any `pushSettings` call: plan switch at `Workouts.js:486`, timer default change, etc.) uploads the stale session as part of the settings blob (`sync.js:321`) and can overwrite a newer remote state. Whole-blob settings LWW amplifies this. **[P0 combined with F-SYNC-4]**
- **F-SYNC-6 [VERIFIED, P2]** `saveActiveWorkoutSession` awaits a full `pushSettings` round-trip before dispatching the change event (`sync.js:48-65`); offline it still resolves (guarded `if (!supabase || !userId) return`), but a slow network delays UI updates listening to the event.

### 8.3 Offline behavior [VERIFIED]

- With the bundle already loaded, everything works offline; writes accumulate in localStorage; new sessions sync on next `pushAll`. Good.
- **F-OFF-1 [VERIFIED, P1]** There is no service worker (CRA SW is not registered in `src/index.js`; PROJECT.md explicitly scoped it out). "Works fully offline" (README) holds only while the browser happens to have the hashed bundle in HTTP cache. A cold start at the gym with no signal can fail to load the app at all. For a gym app this is the single biggest offline risk.
- **F-OFF-2 [VERIFIED, P2]** Edits/deletes made offline have weaker guarantees than creates (F-SYNC-1/2). No outbox, no `navigator.onLine`-triggered flush (`SyncIndicator` observes online events but nothing re-pushes on reconnect).

---

## 9. Timers, rest, recovery [VERIFIED]

- `TimerContext` is well-designed: truth = timestamps (`exerciseStartedAt`, `restEndAt`), 100 ms display tick, survives refresh/tab-kill, 30-min auto-stop, alert phase with flash + triple beep (Web Audio) + vibration, auto-start-next-set option, per-exercise rest defaults (5–600 s), cross-device best-effort sync via `workout_timer_state` upserts on phase transitions (remote applied only when local idle).
- **F-TMR-1 [VERIFIED, P2]** Rest-expiry while the tab is closed silently discards the state on next load (`buildInitialState`, `TimerContext.js:81-87`) — no "rest ended while away" feedback; with auto-start enabled the intent is lost entirely.
- **F-TMR-2 [VERIFIED, P2]** Flash sequence cycles white/green/black at 400 ms (`SetTimer.js:12`, `TimerContext.js:236-244`) — ~2.5 Hz full-screen-element luminance flashing; borderline for photosensitivity guidance and there is no `prefers-reduced-motion` handling anywhere in the CSS. [VERIFIED absence]
- **F-TMR-3 [OBSERVED LIVE parity]** Live app additionally has quick-select rest buttons, Profile timer-defaults UI, compact mobile timer (`996275ca`, `202dcbd2`, `c97c0b26`) — none present locally.
- Recovery guidance exists via coach fatigue score + deload card (`Coach.js:89-98`) and RestAdvisor ranges. No HRV/sleep/soreness inputs; fatigue is a simple accumulator (`calculateFatigueAdjustment`).

---

## 10. History, PRs, progress, coaching UX [VERIFIED]

- Per-exercise: RecordBadges (max weight / reps / session volume), VolumeGraph (SVG, last sessions), last-session table, last-5 session cards with edit/delete + confirm dialogs. Solid.
- No estimated-1RM PR (engine computes Epley internally for comparisons but never surfaces it), no all-time PR timeline, no per-muscle-group weekly volume, no consistency calendar. Dashboard placeholders (F-IA-1) mean *zero* aggregate insight in-app.
- Coach: onboarding (7 steps, plan recommendation), per-set feedback (overload levers with directional messages, styles soft→aggressive, frequency minimal→detailed), RestAdvisor, RIR/intensity capture with guardrails (`isIntensityAllowed`, all-out gated to week ≥ 4), session summary with next-day preview, cardio 150-min weekly target with walk-minutes at 0.5 credit, FAQ. This is coherent and unusually complete for a local rules engine.
- **F-COACH-1 [VERIFIED, P2]** Coach state (`coach_profile`, `coach_metadata`, `coach_cardio`) is never synced to Supabase — a second device sees an un-onboarded coach and diverging fatigue/cardio counters. Consistent with localStorage-first, but surprising after the rest of the app syncs.
- **F-COACH-2 [VERIFIED, P2]** "AI Coach" naming implies model-backed coaching; implementation is deterministic rules. Fine for cost, worth honest labeling in UI copy or PRD scope.

---

## 11. Coach share view and external coach RPC — security/privacy

### 11.1 `coach_shares` + `get_coach_data` [VERIFIED — `supabase/coach_share.sql`]

- Design is sound: owner-only RLS on `coach_shares`, anon has no table access, SECURITY DEFINER RPC validates token+enabled and returns a fixed JSON shape, 128-bit UUID tokens, rotation = delete+insert (revokes), partial index on enabled tokens. UI warns "anyone with link can view" and offers rotate. Good.
- **F-SEC-1 [VERIFIED, P1 — functional, privacy-adjacent]** `get_coach_data` reads `exercise_sessions`/`exercise_sets`/`exercises.local_id` — the normalized schema **the current app never writes** (app writes `exercise_logs`). Unless production still contains legacy rows or another writer exists, CoachView renders empty/stale data while Profile claims sharing works. [OPEN QUESTION Q1 — needs a live token or DB check to confirm.]
- **F-SEC-2 [VERIFIED, P2]** Rotation deletes then inserts non-atomically (`coachShare.js:68-82`); a failure between the two leaves sharing disabled/no record (fail-safe direction — acceptable).

### 11.2 `get_coach_workout_data` (Hayato agent RPC) [VERIFIED — `supabase/hayato_coach_rpc.sql`]

- **F-SEC-3 [VERIFIED, P1]** Anon-callable SECURITY DEFINER function guarded only by a static, never-rotated API key stored in `coach_api_config`; it then serves data for `select id from auth.users limit 1` — "the first user". Issues: (a) key compromise = full historical workout data with no revocation story short of SQL; (b) the single-user assumption silently picks an arbitrary user if a second account ever exists; (c) no rate limiting; (d) the setup script prints the key as output (`line 302`) inviting it into logs/handoffs. Contained blast radius (one person's gym logs) but the pattern should be fixed before any multi-user future.
- It also reads the normalized tables (same concern as F-SEC-1).

### 11.3 App-side RLS posture

- Committed SQL enables RLS with `auth.uid() = user_id` on all *normalized* tables and `workout_timer_state`. **F-SEC-4 [VERIFIED, P1]** There is **no committed DDL at all** for `exercise_logs` or `user_settings` — the two tables carrying all real user data. Only a delete policy for `exercise_logs` appears (in `migration_delete_policies.sql`, hedged with "if exercise_logs is your active flat-log table"). Whether production `exercise_logs`/`user_settings` have correct select/insert/update policies **cannot be verified from this repo**. [OPEN QUESTION Q2]
- Anon key exposure in the bundle is by design (RLS is the boundary) — fine *if* Q2 resolves positively.
- No PII beyond email in auth; workout data is the sensitive asset; no analytics/trackers. [VERIFIED]

---

## 12. Loading / error / empty states [VERIFIED]

- Present: auth loading card, SyncBar, SyncIndicator, CoachView loading/denied states, empty-plan and no-history copy, delete confirmations, UpdateBanner.
- **F-ERR-1 [VERIFIED, P1]** No React error boundary anywhere; any render error white-screens the app (and localStorage JSON corruption is only partially guarded — `loadJSON` helpers catch, but e.g. `ActiveWorkout` trusts `plan.exercises` shape).
- **F-ERR-2 [VERIFIED, P2]** All background sync failures are `console.*` only; user-visible error is the generic bar. No distinction between auth-expired, offline, and server error; no retry.

---

## 13. Mobile ergonomics, accessibility, responsive design, visual consistency

- Good bones: `max-width: 600px` single-column shell, bottom nav with `env(safe-area-inset-bottom)`, 16 px set inputs (prevents iOS focus zoom) at ≥421 px widths, sticky timer + tabs zone in the log modal, min-height 42-44 px on key action rows in `Exercises.css`, back-to-top helpers, modal scroll bodies with `min-height: 0` fix. [VERIFIED]
- **F-A11Y-1 [VERIFIED, P1]** Accessibility is thin: 10 `aria-*` usages across the entire app; interactive rows are `div onClick` (plan rows, exercise rows, session cards) with no `role`, `tabIndex`, or key handling; modals have no `role="dialog"`, no focus trap, no Escape handling; emoji function as unlabeled icons (nav, buttons, badges); `<html lang="en">` while dates render `nl-NL` (`ExerciseLogModal.js:95`, five other files).
- **F-A11Y-2 [VERIFIED, P1]** Media-query coverage exists only in `Exercises.css` (360/420 px tweaks); no `prefers-reduced-motion`, no `prefers-color-scheme`; the flashing rest alert (F-TMR-2) has no opt-out; contrast unaudited but muted text `#9999b3` on cream/white surfaces is likely sub-4.5:1 in places. [INFERRED for contrast]
- **F-DS-1 [VERIFIED, P1]** Two design systems collide: `index.css` defines a warm teal/cream token palette (`--c-bg: #225D65`, `--c-surface: #E3D8C6`, …, 118 `var(--c-*)` usages) while ~96 hard-coded hex references from an older indigo/dark palette (`#7c6af7`, `#9999b3`, `#16162a`, `#1a1a2e`) persist across components, inline styles (`App.js:41`, `Workouts.js:336-353`, `Profile.js:113-122`), and `App.css` — which *also* sets `body { background: #ffffff; color: #1a1a2e }`, directly fighting `index.css`'s `body { background: var(--c-bg) }`. Which body rule wins depends on import order; visual consistency is accidental.
- One-handed use: primary actions (Done, Start, Rest) are bottom-anchored — good; End Workout is top-right (stretch zone); set-row ✕ targets are small. [VERIFIED]

---

## 14. Testing [VERIFIED]

- Exactly one test: `src/App.test.js` — the untouched CRA default asserting a "learn react" link that the app has not rendered since the initial commit. It fails against the real `App` (also renders Supabase-gated UI). Not executed during this audit (constraint); failure is [INFERRED] but follows directly from the source.
- No tests for `sync.js` merge logic, `coachEngine`, timer reducer, or exercise helpers — the exact places bugs were found. No CI to run them.

---

## 15. Performance [VERIFIED / OBSERVED LIVE]

- Live bundle `main.5011fa57.js` ≈ 587 KB minified (~a fifth of that is likely supabase-js + react-dom); single chunk, no code splitting; fine on wifi, sluggish first paint on gym cellular with cold cache. [OBSERVED LIVE size; judgment INFERRED]
- Render-path work is light; localStorage reads happen in `useState` initializers (once per mount) — good pattern. 100 ms timer tick only while non-idle. `BottomNav` recomputes today-volume by scanning all logs on every `exerciseLogged` event — fine at current scale, unbounded long-term (same growth issue as F-SYNC-3).
- `reportWebVitals()` discards data; no perf budget or measurement exists.

---

## 16. Deployment, cache busting, docs accuracy

- Build stamping is genuinely good: `prebuild` writes `public/build-info.json` + `.env.production.local` (commit, buildId, time); UI surfaces build id in Profile footer and log modal; `UpdateBanner` compares deployed `build-info.json` with the running bundle and offers reload. [VERIFIED]
- **F-DEP-1 [VERIFIED, P1]** The deploy safety gate was removed: `package.json` `deploy` runs `predeploy → build → gh-pages --no-history` with **no clean-tree check** (commit `d5e3672` removed it; `scripts/check-clean.js` still exists, unreferenced). README and `docs/cache-busting.md` still claim the gate is enforced. A dirty-tree deploy from a lagging clone is exactly the current risk profile (§2.4).
- **F-DEP-2 [VERIFIED, P1]** No CI/CD: README shows a recommended GitHub Actions workflow that was never committed. Deploys depend on one workstation's uncommitted state and env files — which is how prod got ahead of every clone.
- **F-DEP-3 [VERIFIED, P2]** `UpdateBanner` checks once per page load only; a phone left open at the gym for weeks never learns about updates until manually reloaded (then hash-cached HTML usually revalidates fine on Pages).
- **F-DEP-4 [VERIFIED, P2]** `public/index.html` and `manifest.json` are CRA defaults: `<title>React App</title>`, "Web site created using create-react-app", manifest name "Create React App Sample", `theme_color #000000`, default icons. Add-to-home-screen installs as "React App". Live page title confirms. [OBSERVED LIVE]
- Docs drift [VERIFIED]: README architecture table references `pullRemoteData`/`upsertPlan` (don't exist), claims five normalized tables are the live schema, claims deploy gate; `.planning/ROADMAP.md` marks all coach phases "NOT STARTED" although all three shipped (`7124cc2`); `.planning/TASK-AI-COACH.md` points at the dead `/Users/poverty/Coding/fitness-app/reptrack3/` path.

---

## 17. Data safety, backup, migration, rollback

- **F-DATA-1 [VERIFIED, P1]** No user-facing export/backup. localStorage is the primary store; browser data clearing on a device with unsynced changes = permanent loss of those changes. Supabase is the only backup and only for synced rows (coach state never syncs — F-COACH-1).
- **F-DATA-2 [VERIFIED, P1]** No migration story: production DDL is not reconstructable from the repo (F-SEC-4/F-AUTH-2), there is no migrations directory/tooling, and localStorage shapes are versionless (any future shape change must guess).
- **F-DATA-3 [VERIFIED, P2]** Rollback = redeploying an older commit; because data lives in localStorage + append-mostly tables this is mostly safe today, but nothing documents which app versions are compatible with which DB state.

---

## 18. Verified defect / risk register

| ID | Pri | Area | Finding | Evidence |
|---|---|---|---|---|
| D1 | **P0** | Working tree | Uncommitted `Workouts.js` calls undefined `saveActiveSession` → Start/End crash; would also fail CI lint | `src/pages/Workouts.js:469,477` vs imports at :5-12 [VERIFIED] |
| D2 | **P0** | Sync | Active-session fix incomplete: `ActiveWorkout` never clears remote copy; `pullAll` resurrects ended sessions (null loses to stale remote) | `ActiveWorkout.js:54-60,204,211`; `sync.js:193-200` [VERIFIED] |
| D3 | **P0** | Sync design | Session clear modeled as absence — LWW without tombstone can never propagate "ended"; whole-blob `pushSettings` re-uploads stale sessions on unrelated settings writes | `sync.js:40-46,321` [VERIFIED] |
| D4 | **P0** | Process | Local clone 5 commits behind deployed `main`; uncommitted work built on stale base; deployed source not present locally | `git ls-remote`, GitHub API, live build-info [VERIFIED/OBSERVED LIVE] |
| D5 | **P0** | Data provisioning | Repo SQL cannot provision the schema the app uses (`exercise_logs`/`user_settings`/`workout_timer_state` DDL absent or scattered); setup docs point to wrong schema | `supabase/schema.sql` vs `sync.js`; `SetupScreen.js:34` [VERIFIED] |
| D6 | **P1** | Data integrity | Re-open + save during active workout duplicates previously logged sets into a second session row (volume double-count, dup remote rows) | `ExerciseLogModal.js:55-92,218-232` [VERIFIED] |
| D7 | **P1** | Coach share | `get_coach_data` reads normalized tables the app never writes → CoachView likely empty/stale in prod | `coach_share.sql:92-162` vs `sync.js` [VERIFIED code; prod state OPEN Q1] |
| D8 | **P1** | Security | `get_coach_workout_data`: anon-callable, static non-rotating key, "first user" selection, key printed by setup script | `hayato_coach_rpc.sql:51-57,302` [VERIFIED] |
| D9 | **P1** | Security/verifiability | RLS for `exercise_logs`/`user_settings` unverifiable from repo | §11.3 [VERIFIED gap; OPEN Q2] |
| D10 | **P1** | Sync durability | Offline edits to already-synced sessions never re-pushed (one-shot update, `pushAll` skips remoteId rows); no outbox/retry/reconnect flush | `ExerciseLogModal.js:210-217`, `sync.js:264-265` [VERIFIED] |
| D11 | **P1** | Reliability | No error boundary; local code lacks the storage-blocked startup hardening that prod has | §12, §5 [VERIFIED] |
| D12 | **P1** | IA | Default route + 4 pages are placeholders with fake data; no real session history/consistency view | §4 [VERIFIED] |
| D13 | **P1** | Offline | No service worker — cold offline start fails despite "works fully offline" positioning | §8.3 [VERIFIED] |
| D14 | **P1** | Deploy | Clean-tree deploy gate removed while docs claim it; no CI; manual single-workstation deploys caused the current drift | §16 [VERIFIED] |
| D15 | **P1** | A11y | div-as-button rows, no dialog semantics/focus traps, 10 aria usages total, unlabeled emoji icons, no reduced-motion, flashing alert | §13 [VERIFIED] |
| D16 | **P1** | Design system | Dueling palettes (token teal/cream vs hard-coded indigo/dark), conflicting `body` rules across `index.css`/`App.css` | §13 F-DS-1 [VERIFIED] |
| D17 | **P1** | Testing | Single vestigial failing CRA test; zero coverage of sync/engine/timer | §14 [VERIFIED] |
| D18 | **P1** | Data safety | No export/backup; no migration tooling; coach state never leaves the device | §17 [VERIFIED] |
| D19 | **P2** | UX | Visiting another plan's URL silently destroys the active session | `ActiveWorkout.js:118-126` [VERIFIED] |
| D20 | **P2** | UX | Seed plans re-seed forever (deletion resurrects); render-phase localStorage writes race with pull | `Workouts.js:127-166` [VERIFIED] |
| D21 | **P2** | UX | New-exercise modal hard-codes muscle group 'Legs'; drag handle without drag; no plan reordering | `Workouts.js:306,663` [VERIFIED] |
| D22 | **P2** | Scope | No warm-up/dropset/superset representation in logging despite coach templates modeling them | §7 F-AW-4 [VERIFIED] |
| D23 | **P2** | PWA | CRA-default title/manifest/icons; installs as "React App" | §16 F-DEP-4 [VERIFIED/OBSERVED LIVE] |
| D24 | **P2** | Perf/scale | Full-table log pull each sync; single 587 KB chunk; web-vitals discarded | §15 [VERIFIED/OBSERVED LIVE] |
| D25 | **P2** | Hygiene | `ActiveWorkout.js.backup` with merge-conflict markers sitting untracked in `src/pages/`; `models.js`/`check-clean.js` dead; README/planning docs stale | §2.3, §16 [VERIFIED] |
| D26 | **P2** | Timer | Rest-expired-while-away state silently dropped; flash pattern lacks reduced-motion opt-out | §9 [VERIFIED] |

---

## 19. Open questions

- **Q1** — Does production Supabase still contain populated `exercise_sessions`/`exercise_sets` (feeding CoachView), or does the coach link currently render an empty dashboard? Needs one live token render or a read-only DB check (not performed — out of audit scope).
- **Q2** — What RLS policies actually exist on `exercise_logs`, `user_settings`, `workout_timer_state` in production? Repo carries no DDL for the first two beyond one delete policy.
- **Q3** — Do the five unfetched remote commits touch `Workouts.js`/`ActiveWorkout.js` in ways that conflict with the local uncommitted work? (Likely for `7237d999`; requires fetching, which this audit deliberately did not do.)
- **Q4** — Is `get_coach_workout_data` (and its static key) deployed and in active use by the Hayato agent? Determines urgency of D8.
- **Q5** — The handoff mentions "Edge Function-backed coaching"; no Edge Function exists in this repo. Is there a function deployed out-of-repo, or is the handoff description stale?
- **Q6** — Was the 2026-07-02 deploy made from commit `131e4944` exactly, or from a dirty tree on the deploying machine? (`build-info.json` records the commit but not tree cleanliness; the gate that would have guaranteed it was removed.)

---

## 20. What is working well (worth preserving)

- Offline-first localStorage architecture with instant UI writes and background push.
- Timestamp-truth timer design (survives refresh, tab kill, throttling) with sensible cross-device semantics.
- The logging modal's flow (sticky timer, tabs, pre-populate intent, live totals, records, per-session edit/delete with confirms).
- Coach rules engine: overload-lever detection, RIR guardrails, rest ranges, tone settings — cheap, offline, coherent philosophy.
- Coach share security model (`coach_shares` + SECURITY DEFINER token RPC + rotation).
- Build stamping + update banner + documented cache-busting playbook.
- Honest single-purpose scope: no trackers, no bloat dependencies.

**Companion document:** `docs/REPTRACK-ACTIVE-UPGRADE-PRD-2026-07-13.md` — requirements, design direction, and a phased, data-preserving upgrade plan built on these findings.
