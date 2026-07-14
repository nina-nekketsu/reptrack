# RepTrack — Upgrade PRD (Active App)

**Date:** 2026-07-13
**Companion:** `docs/REPTRACK-ACTIVE-CURRENT-STATE-AUDIT-2026-07-13.md` (all `D*`/`F-*`/`Q*` references resolve there)
**Status:** Proposal — no implementation without Lloyd's approval. This PRD deliberately builds on the existing codebase; a rebuild is an explicit non-goal.

---

## 1. Vision

RepTrack should be the fastest possible way for one lifter to capture a set with a sweaty thumb, trust that the number is safe on every device forever, and see — at a glance — whether today beat last time. Everything else (coach, graphs, sharing) exists to serve those three promises: **fast capture, durable data, honest progress.**

## 2. Product principles

1. **The gym is the design context.** Glanceable type, bottom-anchored actions, one-handed reach, high contrast, tolerance for sweat/fatigue/interrupted attention. Decoration loses to legibility every time.
2. **localStorage first, cloud second — but never silently divergent.** Offline writes are instant; sync is eventually consistent; *the user can always see whether they are consistent*.
3. **State that can end must be able to say so.** Any synced lifecycle state (active session, timer) carries explicit status + timestamps; deletion/ending is a fact that propagates, never an absence.
4. **Ship from main, only from main.** Production must be reproducible from a commit; the database must be reproducible from the repo.
5. **Preserve, don't migrate-big-bang.** Every change must keep existing localStorage keys and Supabase rows readable. Additive schema evolution only.
6. **Honest surfaces.** No fake data, no placeholder screens in the tab bar, no "AI" labels on rules unless a model is actually involved.

## 3. Users and jobs-to-be-done

Primary user: Lloyd (single-user personal app; secondary viewer: his coach via share link; tertiary consumer: the Hayato agent via RPC).

| JTBD | Today | Target |
|---|---|---|
| "Mid-set rest, log 12×80 in under 3 seconds" | Good (modal + pre-populate), but re-save duplicates sets (D6) | One-tap set append, no duplication, ≤2 taps from exercise row |
| "Pick up my phone at the squat rack and resume exactly where I was — on any device" | Broken across devices (D2/D3); crash risk (D1) | Session state converges on all devices ≤ one sync cycle, ended stays ended |
| "Did I beat last time?" | Per-exercise modal only | Previous-session targets inline while logging; PR flags at save |
| "Is my data safe?" | Implicit; silent divergence possible (D10) | Visible sync truth + export + verifiable RLS |
| "Coach checks my week" | Share link likely renders stale/empty data (D7) | Share view reads the real tables |

## 4. Success metrics

Measured via lightweight self-hosted event counts (§17) and manual QA; no third-party analytics.

- **M1 — Session-state convergence:** 0 stale active-session banners after ending a workout, across 2 devices, within one sync cycle (target: 100% of QA runs; today: fails).
- **M2 — Log latency:** exercise row → set saved ≤ 2 taps + numeric entry; p95 modal-open-to-save < 15 s in real use.
- **M3 — Data durability:** 0 known-silent divergences; "pending changes" counter reaches 0 after reconnect in 100% of QA runs.
- **M4 — Duplicate sessions:** 0 overlapping same-workout session rows created by the re-open flow (today: reproducible).
- **M5 — Update adoption:** deployed build id visible in-app; stale-bundle sessions detect update within 24 h without manual reload.
- **M6 — A11y floor:** all interactive elements reachable by keyboard, dialogs trap focus, flashing has a reduced-motion path; axe smoke pass on the 4 core screens.
- **M7 — Release safety:** 100% of deploys from clean CI builds of `main`; `build-info.json` commit always exists on `origin/main`.

## 5. Non-goals

- No rebuild/framework migration (stay on CRA until it actually blocks work; a Vite move is a separate later decision).
- No multi-user/social features; no public accounts beyond the existing single user.
- No LLM-backed coaching in this cycle (rules engine stays; naming becomes honest).
- No native apps; PWA installability only.
- No nutrition, body-comp, wearable, or HRV integrations.
- No weakening of RLS, token sharing, or the anon-key security model (handoff constraint).
- No CRDTs — LWW with explicit tombstones/status is sufficient at this scale.

## 6. Information architecture (target)

Tab bar (5): **Today** (replaces Dashboard) · **Workouts** · **Coach** · **Exercises** · **Profile**.

- **Today `/`** — real data only: active-session resume card (if any), this-week sessions + volume + streak, last workout summary, cardio ring, latest PRs. Empty state: "No sessions yet — start one" → Workouts.
- **Workouts `/workouts`** — unchanged role; plan management + start/resume.
- **Active Workout `/workout/:planId`** — unchanged role; hardened lifecycle (§8.3).
- **History `/history`** — NEW real screen (reachable from Today, not necessarily the tab bar): reverse-chronological workout sessions (grouped per day from `exerciseLogs` + session metadata), tap → day detail with all exercises/sets, edit/delete via existing modal.
- **Coach / Exercises / Profile** — unchanged roles; Profile gains Export & Sync-health sections.
- **Removed routes:** `/home`, `/workout` (static demo), placeholder `/history`, `/progress` — deleted or redirected; their fake data must not ship (D12). Progress content folds into Today + per-exercise views until a dedicated Progress screen earns its place (P2).
- `/coach/:token` unchanged (outside auth guard).

## 7. Design direction — purposeful in-workout UI

> **Note (2026-07-13 revision):** this section states the direction at principle level. The complete, implementation-ready design specification — tokens, components, screen-by-screen changes, microcopy, design backlog, and visual QA — is **Part II (§16–§24)** below. Where Part II refines a value stated here (e.g. final palette hexes), Part II wins.

**Direction: "Chalk & Signal."** A quiet, matte base (the existing warm cream surface family) with one high-signal accent per semantic: progress/confirm = deep teal, rest/warning = mustard, danger/regression = terracotta — i.e., commit to the token palette already in `index.css` and delete the legacy indigo/dark remnants (D16). Rationale: in a gym you glance for *state*, not read; one accent per meaning survives sweat-blurred, sun-glared, 0.5-second glances.

In-workout rules (the "sweat spec"):

- **Glanceable:** current exercise name + next target ("last time: 12×80 · beat it") in ≥1.25rem/700; timers in tabular numerals ≥2rem; session progress as the header bar only.
- **One-handed:** all mutating actions in the bottom 40% of the viewport; End Workout moves into a bottom sheet (long-press or two-tap, never one accidental tap); modals slide from bottom with drag-to-dismiss affordance later (P2).
- **Low-tap:** "＋ Same as last set" one-tap append; numeric steppers (±2.5 kg / ±1 rep) beside inputs; rest auto-starts on set save when auto-start is on.
- **High-contrast:** all text ≥4.5:1 on its surface (validated per token pair, replacing `#9999b3`-on-light offenders); active timer block gets an outline, not just a hue shift.
- **Fatigue-tolerant:** destructive actions always confirm; every field-level tap target ≥44×44 px; inputs `inputmode="decimal"`/`"numeric"`; no hover-dependent affordances.
- **Motion:** rest-alert flash replaced by a ≤1 Hz pulse + beep + vibration, with `prefers-reduced-motion` falling back to static color + sound (D26/F-TMR-2).

## 8. Detailed requirements by flow

Priorities: **P0** = must (safety/correctness), **P1** = should (core value), **P2** = could (polish). Each requirement lists acceptance criteria (AC).

### 8.1 Working-tree repair & repo hygiene (P0 — precedes everything)

- **R1 (P0)** Reconcile with `origin/main` *with Lloyd present*: fetch, review the 5 remote commits, rebase-or-merge the uncommitted `sync.js`/`Workouts.js` work onto `131e4944`. Nothing force-pushed; nothing discarded without his call.
  **AC:** local `main` == `origin/main` ancestor chain; uncommitted work either committed on a branch or intentionally dropped; `ActiveWorkout.js.backup` resolved (content salvaged or deleted) by Lloyd's decision.
- **R2 (P0)** Fix D1: `Workouts.js` uses `saveActiveWorkoutSession(session, user?.id)` everywhere; no undefined identifiers.
  **AC:** `eslint --max-warnings 0` passes; Start/End from Workouts works logged-in and logged-out.

### 8.2 Active-session lifecycle & cross-device sync (P0 — the incident fix)

Data contract (additive; key stays `activeWorkoutSession`):

```json
{
  "planId": "legs-biceps-day",
  "planName": "Legs & Biceps Day",
  "startedAt": "2026-07-13T09:00:00.000Z",
  "updatedAt": "2026-07-13T09:41:02.000Z",
  "status": "active" | "ended",
  "endedAt": "2026-07-13T10:02:11.000Z | null",
  "deviceId": "uuid-v4 per browser (localStorage)"
}
```

- **R3 (P0)** Ending a workout writes `status:'ended', endedAt, updatedAt` (a tombstone), persists locally, and pushes; the record is pruned only after the push is confirmed **and** ≥24 h old (or immediately superseded by a newer `active` session). Merge rule: newest `updatedAt` wins; an `ended` record beats an `active` record with an older `updatedAt`. UI treats `status !== 'active'` as no session.
  **AC (incident regression test):** Device A starts, logs, ends → device B pulls → B shows no active session; B goes offline mid-session, A ends, B reconnects → converges to ended; A ends offline, syncs later → still converges. Zero resurrection in all three QA scripts.
- **R4 (P0)** All session mutations go through the single `saveActiveWorkoutSession` API — `ActiveWorkout.js` local helpers deleted (D2). Every mutation stamps `updatedAt`.
  **AC:** `grep` finds exactly one writer of the localStorage key.
- **R5 (P0)** `pushSettings` must not re-upload session state as a side effect of unrelated settings writes (D3): session state moves to its own settings sub-key written only by R4's API, or (preferred) its own `active_sessions` row keyed `user_id` with `updated_at` — decided at implementation with Lloyd; either way whole-blob clobber ends.
  **AC:** changing current plan on a device with a stale local session does not overwrite a newer remote session state.
- **R6 (P1)** Resume affordance: Today + Workouts show the active-session card with elapsed time computed defensively (clamp negatives to 0:00, D3/F-AW-3); tapping another plan's Start while a different session is active asks "End & start new / Resume existing" instead of silently clobbering (D19).
- **R7 (P1)** Sync trust surface: SyncIndicator gains a pending-changes count and a tap-to-retry; reconnect (`online` event) triggers a flush of the outbox (R9).

### 8.3 Set logging integrity & speed

- **R8 (P0)** Fix duplication (D6): during an active workout, re-opening an already-logged exercise loads that session **in edit mode** (`editingSession` set, `remoteId` preserved); saving updates the existing row locally and remotely. Creating a genuinely new session in the same workout requires an explicit "Log as new session" action.
  **AC:** log 3 sets → reopen → add 1 set → Done ⇒ exactly one session with 4 sets locally and remotely; BottomNav today-volume counts each set once.
- **R9 (P1)** Offline outbox (D10): failed `pushSession`/`updateRemoteSession`/`deleteRemoteSession`/settings pushes enqueue `{op, entity, payload, queuedAt}` in localStorage; flushed on reconnect/login/manual sync, FIFO, idempotent (updates keyed by `remoteId`, inserts deduped by `(exercise_id,date)`).
  **AC:** airplane-mode edit of a synced session → reconnect → remote row updated without user action; queue empties; M3 met.
- **R10 (P1)** Rapid-entry affordances: "same as last set" append button; ±steppers; auto-focus weight after reps; previous-session sets shown as ghost targets inline (per §7). Numeric keyboards via `inputmode`.
- **R10a (P1, added 2026-07-14)** Immediate set-by-set rep feedback: after a set is confirmed, compare its reps with the corresponding set number from the most recent previous completed session for the same exercise. Only judge the result when the recorded weight is exactly the same in both sets. More reps marks the reps/weight input area green; fewer reps marks it with the danger/red treatment; the same reps stays neutral. Any weight increase or decrease stays neutral, regardless of the rep change. A set with no corresponding previous set also stays neutral. Feedback appears immediately after confirmation, not while the user is still typing, and must include a non-color cue (icon plus accessible label such as “More reps than last time” or “Fewer reps than last time”).
  **AC:** at the same weight, 11 reps versus the previous 10 turns green and 9 versus 10 turns red; 10 versus 10 stays neutral. If either comparison uses a different weight, or the prior session has no matching set number, the result stays neutral. Reopening the logged exercise reproduces the same feedback from saved data. Automated tests cover all five outcomes and verify that the status is not conveyed by color alone.
- **R11 (P2)** Set annotations: warm-up flag and superset group tag on a set (additive fields, ignored by old code); dropset = consecutive sets tagged `drop`. Warm-up sets excluded from PR/overload comparisons in `coachEngine` (D22).
- **R12 (P2)** Per-set rest integration: saving a set can auto-start the rest timer with the exercise's default; RestAdvisor range shown on the timer block.

### 8.4 Data provisioning, RLS, migrations (P0/P1)

- **R13 (P0)** Author `supabase/schema_current.sql` — a complete, verified DDL snapshot of what the app actually uses (`exercise_logs`, `user_settings`, `workout_timer_state`, `exercises`, `workout_plans`, `coach_shares`, RPCs), each with full RLS policies (`auth.uid() = user_id` for select/insert/update/delete). Verified read-only against production (with Lloyd running the check) to close Q2. `SetupScreen`/README point to it (D5, F-AUTH-2). Legacy `schema.sql` moves to `supabase/legacy/` with a deprecation header.
  **AC:** a fresh Supabase project + `schema_current.sql` + env vars yields a fully working sync install; RLS verified by an anon-key negative test (select returns 0 rows).
- **R14 (P1)** Adopt migration discipline: `supabase/migrations/NNN_*.sql`, applied only with Lloyd, never destructive; every future schema change lands as a migration file in the same PR as the code.
- **R15 (P1)** Coach-share data fix (D7, Q1): after confirming production state, either (a) point `get_coach_data`/`get_coach_workout_data` at `exercise_logs` (jsonb sets), or (b) add a trigger/writer maintaining the normalized tables. Option (a) preferred — one source of truth. Token model, RLS, and SECURITY DEFINER pattern unchanged (handoff constraint).
  **AC:** a fresh share token renders current real data in CoachView; invalid/disabled token still returns the denial screen.
- **R16 (P1)** Harden `get_coach_workout_data` (D8): key becomes rotatable (rotation SQL + doc), function resolves the user by explicit `user_id` config rather than `auth.users limit 1`, setup script stops printing the key inline (writes to a local file the operator handles). No behavioral change for the Hayato agent besides the new key.
- **R17 (P1)** Backup/export (D18): Profile → "Export data" downloads a JSON snapshot (exercises, plans, logs, settings, coach state) with schema version; "Import" restores additively with dry-run preview. Documented restore path = rollback story for localStorage.
- **R18 (P2)** Sync coach profile/cardio via a `coach_state` sub-key of user settings (additive), so onboarding survives device changes (F-COACH-1).

### 8.5 Today / History / Progress (P1)

- **R19 (P1)** Today screen per §6 computed from real logs: sessions this week, 7-day volume, streak (consecutive training days with ≥1 session, rest-day tolerant definition agreed with Lloyd), last workout card, active-session resume, cardio ring, 3 latest PRs.
  **AC:** numbers reconcile with manual counts from `exerciseLogs`; loads <100 ms with 1 year of data (memoized single pass).
- **R20 (P1)** History screen per §6 (day-grouped sessions, detail view, edit/delete reusing existing modal + delete plumbing).
- **R21 (P2)** PR engine upgrade: track e1RM (Epley — already computed in `coachEngine`), flag PRs at save time with a subtle celebration (reduced-motion aware), all-time PR list per exercise.
- **R22 (P2)** Per-muscle-group weekly volume bars on Today (uses existing muscleGroup data).

### 8.6 Reliability, error, empty states (P0/P1)

- **R23 (P0)** Global `ErrorBoundary` around the router with a "something broke — reload / export data" card; storage-access guarded at startup (align with remote `131e4944` hardening after R1).
- **R24 (P1)** Error taxonomy in sync status: `offline` / `auth-expired` (prompt re-login) / `server` (retry w/ backoff); SyncBar messages differentiate; all fire-and-forget catches route through one reporter (feeds §17 counters).
- **R25 (P1)** Every screen keeps an intentional empty state (most already exist — preserve).

### 8.7 Accessibility (P1)

- **R26 (P1)** Interactive rows become `<button>`/`role="button"` + keyboard handling; modals get `role="dialog"`, `aria-modal`, focus trap, Escape-to-close, focus return; icons get `aria-label`s or `aria-hidden` + text; `lang` attribute matches rendered locale (pick `en` UI with explicit `nl-NL` date option, or localize — Lloyd's call); `prefers-reduced-motion` honored (timer per §7); contrast pass on token pairs.
  **AC:** M6 (axe smoke + keyboard walkthrough of Workouts, ActiveWorkout, LogModal, Profile).

### 8.8 Design system & responsive (P1)

- **R27 (P1)** One palette: migrate all 96 hard-coded legacy hex references to the `--c-*` tokens (extend the token set with semantic aliases: `--surface-raised`, `--text-muted`, `--accent-rest`, `--accent-danger`, `--success`); delete the conflicting `body` rule in `App.css`; eliminate inline style objects in favor of classes (D16).
- **R28 (P1)** Component inventory doc (`docs/design-system.md`): buttons (primary/secondary/danger/chip), inputs, modal/sheet, card, badge, timer block, list row — each with states (default/active/disabled/focus) and token mapping. New work uses only inventory components.
- **R29 (P2)** Responsive audit beyond `Exercises.css`: 360/420 breakpoints applied to Workouts/Coach/Profile; landscape sanity pass.
- **R30 (P2)** PWA identity (D23): real title, description, manifest name/short_name "RepTrack", themed colors, icons; apple-touch meta.

### 8.9 Offline shell (P1)

- **R31 (P1)** Service worker with precached app shell (Workbox or hand-rolled ≤100 lines): cache-first for hashed assets, network-first for `build-info.json` and `index.html`. Update flow integrates with UpdateBanner (SW `waiting` → banner → skipWaiting on reload). Explicitly reverses the old "no SW" scoping decision — justified by the cold-offline-start risk (D13); kept minimal to respect the cache-busting playbook.
  **AC:** airplane mode, cold start after one prior visit → app loads and logging works; deploying a new build shows the banner within 24 h (M5) and reload activates it.

### 8.10 Deployment, CI, observability (P0/P1)

- **R32 (P0)** Commit the GitHub Actions workflow (README already drafts it): `npm ci` → lint → tests → build (secrets from repo settings) → deploy Pages on push to `main`. Manual `npm run deploy` re-gains the clean-tree gate (`scripts/check-clean.js` rewired into `predeploy`) and becomes the emergency path only (D14).
  **AC:** M7; a dirty tree cannot deploy; `build-info.json` commit always on `origin/main`.
- **R33 (P1)** Observability without third parties: window `error`/`unhandledrejection` handlers + sync-failure counters stored locally, surfaced in Profile → "Diagnostics" (last 20 errors, queue depth, last sync time, build id); optional later: POST to a private Supabase `client_events` table (RLS owner-only).
- **R34 (P2)** UpdateBanner re-checks on `visibilitychange` + 6-hourly interval (D22/F-DEP-3 — subsumed by R31's SW flow if built).

### 8.11 Testing (P0/P1)

- **R35 (P0)** Delete the vestigial CRA test; add unit tests for the incident surface: session merge/tombstone rules (R3), `chooseNewest…` cases, outbox idempotency (R9), duplication fix (R8), `calcTotals`/`bestSet`/`getRecords`, timer reducer transitions incl. restore paths.
- **R36 (P1)** Component tests: LogModal save/edit/delete flows, Workouts start/resume/end, coach gating. Target: the D-register regressions each have a named test.
- **R37 (P1)** QA scripts (manual, documented in `docs/qa-checklists.md`): two-device session lifecycle, airplane-mode matrix, share-link render, update-banner cycle. Run before every release (release gate §12).

## 9. Non-functional requirements

- **Performance budgets:** initial JS ≤ 600 KB minified (current 587 KB — hold the line; code-split coach data/templates first if breached); interaction-to-paint on set save < 100 ms; Today computation single pass over logs, memoized.
- **Compatibility:** iOS Safari (primary), Android Chrome; last 2 major versions.
- **Data scale:** assume 5 years of daily logging (~10-15k sessions) — all list renders windowed or bounded; sync payload growth addressed by since-cursor pull when >2 MB (P2, D24).
- **Privacy:** no third-party requests beyond Supabase + GitHub Pages; workout data never leaves those; share/RPC surfaces unchanged in exposure, improved in rotation.
- **Security:** RLS on every user table (verified, R13); SECURITY DEFINER functions minimal and token/key-gated; no secrets in repo or build metadata.

## 10. Offline/sync conflict semantics (normative summary)

- Entities (exercises, plans): id-keyed LWW, remote-wins-on-pull (unchanged).
- Log sessions: insert-once + `remoteId`-keyed updates; outbox guarantees eventual delivery; dedupe key `(exercise_id, date)`; edits merge by whole-session replacement (no per-set merge).
- Settings: sub-key-level writes (no whole-blob clobber for session/coach state).
- Active session & timer: newest-`updatedAt`-wins **with tombstones**; `ended`/`idle` are explicit states that propagate; devices never infer "still running" from absence of news.
- Clock skew: all comparisons tolerate ±5 min skew (prefer server `updated_at` where a row exists); UI clamps negative durations.

## 11. Risks & dependencies

| Risk | Mitigation |
|---|---|
| Reconciling local uncommitted work with the 5 remote commits produces conflicts (Q3) | R1 done interactively with Lloyd; branch-first; nothing deleted |
| Production schema differs from assumptions (Q1/Q2) | R13 verification step gates R15/R16; read-only checks first |
| SW caching fights GH Pages caching | Minimal SW, network-first HTML/build-info, kill-switch (unregister path) shipped with it |
| Tombstone change misreads old-format sessions | Merge treats records without `status` as `active` (backward compatible); QA matrix covers old⇄new device pairs |
| Single maintainer bandwidth | Phases are independently shippable; each ends in a releasable state |
| Supabase free-tier limits (row counts, RPC) | Current scale is trivial; since-cursor pull (P2) before it matters |

Dependencies: Lloyd's approval + presence for R1/R13/R15/R16 (git reconcile, prod DB verification, RPC changes, key rotation); GitHub repo secrets for R32; no new paid services.

## 12. Release gates (every release)

1. CI green (lint, unit, build) on `main`.
2. QA checklist (R37) executed — two-device lifecycle + offline matrix pass.
3. `build-info.json` commit is on `origin/main`.
4. Post-deploy: live `build-info.json` matches, UpdateBanner fires on a stale client, one real workout logged end-to-end on phone.
5. Rollback ready: previous build's commit noted; `gh-pages` redeploy of it verified once as a drill (M0).

## 13. Prioritized backlog (MoSCoW)

**Must (P0):** R1, R2, R3, R4, R5, R8, R13, R23, R32, R35 — plus D25 hygiene (resolve `.backup`, delete dead demo pages' fake data from nav-reachable surface).
**Should (P1):** R6, R7, R9, R10, R10a, R14, R15, R16, R17, R19, R20, R24, R25, R26, R27, R28, R31, R33, R36, R37.
**Could (P2):** R11, R12, R18, R21, R22, R29, R30, R34, since-cursor sync, bottom-sheet modals, plan reordering (D21), seed-plan tombstones (D20), honest "Coach" naming pass (F-COACH-2).
**Won't (this cycle):** §5 non-goals.

## 14. Phased roadmap

### M0 — "Stop the bleeding" (the safest first milestone; ~1 short cycle)
Strictly repair + verify; zero feature surface change; every step reversible.

1. R1 git reconcile (with Lloyd) → working branch.
2. R2 fix the undefined-function crash.
3. R3/R4/R5 complete the active-session fix with tombstone semantics.
4. R8 fix set duplication.
5. R23 error boundary; R35 tests for exactly the above; R32 CI + restored deploy gate.
6. R13 schema snapshot authored + verified read-only (no DB writes yet — provisioning fixes ship in M1 if Q1/Q2 require them).
7. Release via gates (§12), including the two-device incident regression script.

*Why safest:* it touches only files already in flight, fixes only verified defects, adds tests before behavior changes, and establishes CI so nothing after it can regress silently. Existing data and workflows are untouched; old clients keep working (tombstone format is backward compatible).

### M1 — "Trustworthy sync & honest surfaces"
R9 outbox, R7 sync trust UI, R24 error taxonomy, R15/R16 coach-data + RPC hardening (pending Q1/Q2), R17 export/import, R19 Today, R20 History, D12 removal of fake pages, R30 PWA identity.

### M2 — "Built for the gym"
§7 design direction: R27/R28 token unification + component inventory, R10 rapid entry, R26 a11y, R31 offline shell, R6 resume protection, R12 rest integration, R33 diagnostics.

### M3 — "Progress you can feel"
R21 PR engine, R22 muscle-group volume, R11 warm-up/superset/dropset annotations, R18 coach-state sync, R29 responsive audit, P2 backlog by appetite.

R10a ships with the M2 logging work so the feedback is available while the set is still fresh, not only in later progress views.

## 15. Acceptance criteria — milestone M0 (explicit)

- [ ] `git status` clean on a branch whose base is `origin/main@131e4944`; Lloyd has signed off on the reconciliation of his uncommitted work and the `.backup` file.
- [ ] Start/End workout from Workouts and ActiveWorkout pages: no console errors, logged-in and logged-out.
- [ ] Two-device script (§8.2 R3 AC) passes 3/3 variants — no resurrected sessions.
- [ ] Re-open-and-add-set flow produces exactly one session row (local + Supabase).
- [ ] `npm test` green in CI; suite includes merge-rule, duplication, and timer-restore tests; lint zero warnings.
- [ ] Deploy performed by CI from `main`; live `build-info.json` commit verifiable on GitHub; rollback drill documented.
- [ ] No change to any existing localStorage key format except additive fields; a pre-M0 export/copy of localStorage loads unchanged.

---

---

# PART II — Implementation-ready design specification (added 2026-07-13 per Lloyd's request)

**Evidence basis and honesty note.** Every BEFORE statement in Part II is labeled **[VERIFIED]** and derives from reading the source and stylesheets of the local working tree (`src/**/*.css`, component JSX) — **no screenshots were rendered or visually inspected during this audit** (no build/run was permitted). Where live production may differ (the 5 unfetched remote commits — audit §2.4), it is flagged. Everything labeled **[REC]** is a recommendation, not current behavior. Part II changes visual/interaction surface only; it depends on, and must not ship before, the Part I P0 correctness work (R1–R5, R8).

---

## 16. Current visual-language diagnosis

What the stylesheets actually contain today [VERIFIED]:

1. **Four unreconciled palettes.**
   - A warm teal/cream token set in `index.css` (`--c-bg:#225D65`, `--c-surface:#E3D8C6`, `--c-accent:#D39932`, `--c-danger:#AE5238`) — declared, but almost no component consumes it.
   - An indigo light theme in `Page.css`/`Exercises.css`/`Workouts.css` (`.btn-primary` `#4c4cff`, plan-header gradient `#4c4cff→#7b7bff`, dashed `#b0b0ff` add-set button) on white cards, text `#1a1a2e`, muted `#7777a0`/`#9999b3`.
   - A dark navy/violet island for auth and nav (`.auth-screen` `#0d0d1a`, `.auth-card` `#16162a`, submit `#7c6af7`; `.bottom-nav` `#1a1a2e` with **red** active state `#e94560`).
   - A green gradient world inside the active workout (`.aw-header` `#00aa44→#22dd66` with a decorative circle overlay; `#00cc55` banners/buttons), plus a fifth accent in `UpdateBanner` (`#4338ca` on `#eff2ff`).
   `App.css` sets `body{background:#ffffff;color:#1a1a2e}` while `index.css` sets `body{background:var(--c-bg)}` — the winner is import-order luck (audit D16).
2. **Emoji as the entire icon system** [VERIFIED]: nav tabs (🏠🏋️🧠📋👤), muscle-group thumbs, record chips (🏋️🔁📈), buttons (🗑, ✏️, ⟳, 💤, ▶), status glyphs (✓ ↻ ⚠ ⚡). Emoji render differently per OS, can't be tinted to match state, carry no accessible names, and read as toy-like against a "serious training" positioning.
3. **Typography is ad-hoc**: sizes sampled across files range 10–24 px plus rem values (0.55rem nav badge → 1.3rem nav icon), weights 500–800 with no scale; timers do not use tabular numerals, so digits jitter as they tick.
4. **Spacing/radius are close to coherent by accident** (radius 8/10/12/16/20 all occur; paddings mix px and rem) but nothing is tokenized.
5. **Signals collide**: green means "active session" *and* "start success" *and* the whole workout header; red means both "danger" and "current nav tab". The one screen that needs calm (Active Workout) is the loudest (saturated gradient + decorative blob).
6. **Interaction affordances are inconsistent**: list rows are clickable `div`s with no pressed state; some buttons scale on `:active` (`.plan-start-btn`), most don't; focus styles exist on only 11 selectors.

**Diagnosis in one line:** the app has four half-design-systems and an emoji icon set; nothing is broken visually, but nothing is *decided*. The redesign is mostly an act of deciding once and deleting three of the four systems.

---

## 17. Target art direction — "Chalk & Signal (Dark)"

**[REC — decision]** RepTrack becomes a **single dark theme** ("Gym Floor graphite") with warm chalk-white text and exactly three signal hues. Rationale:

- Gym context: dark surfaces reduce glare and full-brightness blowout on OLED phones held at odd angles; strong contrast survives sweat-blurred half-second glances.
- The app's most-polished existing surfaces (auth card, bottom nav) are already dark — this converges on them instead of repainting everything twice.
- One theme halves the token/QA matrix for a solo maintainer. A light theme remains possible later because everything routes through tokens (§18.1), but it is explicitly **P2/won't-do-now**.
- Personality: matte graphite + warm chalk + restrained brass/amber reads *premium-athletic* (chalk dust, iron, gym floor) and avoids both generic neon-gradient "AI app" styling and sterile grayscale. The warm-cream heritage of the current token file survives in the ink color.

Mood keywords for the designer: **matte, engraved, chalk-on-slate, calm until it matters.** Color is *earned*: neutral by default; green appears only for progress/beating-last-time; amber only for rest/attention; terracotta only for danger/regression. No gradients except a single subtle top-light on the active-workout header; no decorative shapes; depth via layered surface tones + hairlines, not drop-shadow soup.

---

## 18. Global design system

All values below are **[REC]** unless marked otherwise. Implementation home: extend `src/index.css` `:root` (replacing the current warm block), delete competing rules from `App.css`, and migrate components file-by-file (backlog §22).

### 18.1 Color tokens (semantic, with contrast intent)

Contrast ratios below are design intent computed for the stated pairs; the **visual QA gate (§23) re-verifies each pair with a contrast checker** before merge — treat any pair failing 4.5:1 (text) / 3:1 (large text, UI graphics) as a build blocker.

**Neutrals (surfaces & ink):**

| Token | Hex | Role | Contrast intent |
|---|---|---|---|
| `--bg-0` | `#0F1216` | App background | base |
| `--bg-1` | `#161B22` | Cards, list rows, nav | vs bg-0: hairline-separated, not contrast-reliant |
| `--bg-2` | `#1E252E` | Sheets, modals, inputs | — |
| `--bg-3` | `#273039` | Pressed/hover fill, chips | — |
| `--line` | `#2C3540` | Hairline borders, dividers | ≥3:1 vs bg-1 not required (decorative); interactive outlines use `--line-strong` |
| `--line-strong` | `#46525F` | Input borders, toggles off-state | ≥3:1 vs `--bg-2` |
| `--ink-hi` | `#F3EFE6` | Primary text (warm chalk) | ≥14:1 vs bg-0/1/2 |
| `--ink-mid` | `#BCC3CC` | Secondary text | ≥8:1 vs bg-0/1 |
| `--ink-low` | `#8D97A3` | Tertiary/meta text | ≥4.5:1 vs bg-0/1 (validate on bg-2) |
| `--ink-on-accent` | `#0F1216` | Text/icons on filled accent buttons | ≥8:1 vs each accent fill |

**Signals (exactly three hues + one celebration metal):**

| Token | Hex | Role |
|---|---|---|
| `--go` | `#3BD07F` | Primary action, progress, "beat last time", synced ✓ |
| `--go-dim` | `#1E4634` | Go-tinted fills (done rows, progress track fill bg) — ink stays `--ink-hi` |
| `--rest` | `#E3A83B` | Rest timer, warnings, attention, offline |
| `--rest-dim` | `#4A3A1B` | Rest-tinted fills |
| `--danger` | `#E4633F` | Destructive actions, regression, sync error |
| `--danger-dim` | `#4A281E` | Danger-tinted fills |
| `--record` | `#E8C15A` | PR/record moments only (badges, one-off flashes) — never for buttons |
| `--focus` | `#8FD8B2` | Focus rings only |

Rules: filled buttons use accent fill + `--ink-on-accent` (dark text on green/amber — both ≥8:1); *tinted* states use the `-dim` fill with `--ink-hi` text so long-lived states (a completed row) stay calm while momentary actions (a button) are vivid. Never place `--ink-low` on `--bg-3` (fails intent). The old `#e94560` red nav accent, `#4c4cff` indigo family, `#7c6af7` violet, and all five gradients are **deleted** (mapped in §22 backlog DS-2).

### 18.2 Typography

**Families [REC]:** system stack only — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`; numeric surfaces add `font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum"`. **No web fonts, no CDN** (privacy/perf requirement — matches current behavior [VERIFIED: no font imports exist]). Monospace only in Setup instructions (`ui-monospace, SFMono-Regular, Menlo, monospace`).

**Scale (mobile-first, px / line-height / weight):**

| Token | Size | Use |
|---|---|---|
| `type-timer` | 40/44 · 800 · tabular | Rest & exercise timers |
| `type-display` | 32/38 · 800 · tabular | Today hero numbers, summary volume |
| `type-title1` | 24/30 · 800 | Page headings (matches current 24px [VERIFIED]) |
| `type-title2` | 20/26 · 700 | Card titles, modal titles, plan name |
| `type-headline` | 17/24 · 700 | Row primary text, button labels |
| `type-body` | 15/22 · 500 | Default copy |
| `type-label` | 13/18 · 600 | Meta rows, input labels, chips |
| `type-caption` | 11/16 · 700 · uppercase · letter-spacing 0.06em | Overlines ("ACTIVE WORKOUT"), nav labels, badges |

Nothing below 11 px ever (current 0.55rem ≈ 8.8 px nav badge [VERIFIED] is retired). Weights: 500/600/700/800 only. Numbers users compare (weights, reps, volume) are always tabular.

### 18.3 Space, grid, radius, border, elevation

- **Spacing scale (4-pt):** `2, 4, 8, 12, 16, 20, 24, 32, 40, 56`. Screen gutter 16; card padding 16; section gap 20; related-element gap 8.
- **Layout grid:** single column, `max-width: 560px` centered (replaces current 600 [VERIFIED] for tighter line lengths); content never touches viewport edges (16 px gutters at all widths).
- **Radius:** `--r-sm: 8` (chips, inputs), `--r-md: 12` (buttons, rows), `--r-lg: 16` (cards), `--r-xl: 20` (sheets/modals, top corners only for bottom sheets), `--r-full: 999` (pills, dots).
- **Borders:** 1 px `--line` on raised surfaces; 1.5 px `--line-strong` on inputs; 2 px `--focus` focus ring with `outline-offset: 2px`.
- **Elevation (dark-theme rule: lighter surface = higher):** `e0` bg-1 + hairline (cards); `e1` bg-2 + hairline + `0 1px 2px rgba(0,0,0,.4)` (sticky bars); `e2` bg-2 + `0 12px 32px rgba(0,0,0,.5)` (sheets/modals); scrims `rgba(6,8,10,.6)`.

### 18.4 Iconography

**[REC]** Replace all functional emoji with a local inline-SVG set (`src/components/icons/` — one React component per icon, `currentColor` stroke 1.75 px on a 24-px grid, filled variants for nav-active). No icon font, no external package with remote assets. Required set (~22): today/house, dumbbell, brain, list, user, plus, minus, close, check, chevron-right/down, timer, moon-zzz (rest), trash, pencil, share, link, rotate, sync-arrows, bolt-offline, warning-triangle, flame (streak), trophy (PR), undo, download (export). Emoji remain **only** as celebratory content inside summary copy (🎉-class moments), never as controls. Every icon-only control gets `aria-label`; decorative icons get `aria-hidden="true"`.

### 18.5 Touch targets, safe areas, viewport

- Minimum interactive target **44×44 px** (48×48 for in-workout primary actions); adjacent targets ≥8 px apart. Known current violations to fix: `.remove-set-btn` (~22 px [VERIFIED]), session-card Edit/🗑, nav badge overlap, `.aw-end-btn`.
- Safe areas: keep `env(safe-area-inset-bottom)` on nav [VERIFIED it exists]; add `env(safe-area-inset-top)` padding to sticky headers and sheet top bars; bottom action bars pad `max(16px, env(safe-area-inset-bottom))`.
- Viewport: switch layout heights to `100dvh` (current `100vh` on `.auth-screen`/`.app` [VERIFIED] causes URL-bar jump); modals use `max-height: min(92dvh, 720px)`.
- Keyboard: see §20.9.

### 18.6 Responsive breakpoints & density

- **320 px** — minimum supported; everything must fit with no horizontal scroll (QA gate).
- **360 px** — small Android reference; current `Exercises.css` 360 tweaks generalize into tokens.
- **390 px** — primary design reference (iPhone 15/16 class).
- **428+ px** — large phones; type scale unchanged, gutters grow to 20.
- **≥560 px** — content column caps and centers; bottom nav stays full-width.
One density only; the Active Workout screen uses the larger in-workout variants (row height 64, timer scale) rather than a global density switch.

### 18.7 Interactive states (uniform contract)

Every interactive component implements all of: **default → pressed** (`--bg-3` overlay or 0.97 scale, 120 ms) → **focus-visible** (2 px `--focus` ring, never removed) → **disabled** (40% opacity, `pointer-events: none`, retains layout) → **error** (1.5 px `--danger` border + 13 px `--danger` caption below, `aria-describedby`) → **success** (transient `--go` check, 1.5 s, then settles) → **loading** (label swaps to 16 px inline spinner + retains width; whole-screen loads use skeletons §19.14, never spinners-in-space).

### 18.8 Haptics & sound

- Set saved: `navigator.vibrate(30)` tick. PR detected: `[30,60,30]`. Rest end: keep existing `[200,100,200,100,400]` + triple beep [VERIFIED in `utils/timer.js`]. Destructive confirm open: no haptic (avoid training reflex-confirm).
- New Profile toggles: "Sound" and "Vibration" (both on by default), stored in `timer`-adjacent settings and respected by `playBeep`/`vibrate` wrappers.

### 18.9 Motion

- Durations: 120 ms (state), 180 ms (reveals, sheet content), 240 ms (sheet/modal in; out = 180). Easing `cubic-bezier(0.2, 0, 0, 1)`; sheets may use a light spring.
- The rest-alert flash (currently white/green/black at 400 ms ≈ 2.5 Hz [VERIFIED `SetTimer.js:12`, `TimerContext.js:240`]) is **replaced** by: timer block background pulsing `--rest-dim → --rest` at ≤1 Hz for the final 5 s + count digits switching to `--rest` + beep/vibration.
- `prefers-reduced-motion: reduce`: all transforms/pulses disabled; state changes are instant color/text swaps; sheet animations become fades ≤120 ms; skeleton shimmer becomes static blocks; sound/haptics unaffected (they are the reduced-motion channel).

---

## 19. Component redesign specifications

Format per component: **BEFORE [VERIFIED]** → **AFTER [REC]** (visual, dimensions, states, interaction, a11y, rationale). Shared state contract §18.7 applies everywhere and is not repeated.

### 19.1 App shell & header
- **BEFORE:** `body` background contested (#fff vs teal token); `.app-main` pad 1.5rem/1rem, bottom 5rem; page heading 24 px + `.page-sub` 14 px `#7777a0`; no sticky header; build id only in Profile/modal.
- **AFTER:** `--bg-0` app background; per-screen header block = overline caption (screen context, e.g. "MONDAY 13 JUL") + `type-title1` heading + optional `type-body` sub in `--ink-mid`; header scrolls away except on ActiveWorkout (sticky, §20). Main column 560 px, gutter 16, `padding-bottom: calc(72px + env(safe-area-inset-bottom))` clearing the nav.
- **Rationale:** one background truth ends the import-order bug (D16); date-as-overline gives the "which day am I looking at" glance for free.

### 19.2 Bottom navigation
- **BEFORE:** fixed bar `#1a1a2e`, hairline `#2a2a4a`, emoji icons 1.3rem, uppercase 0.65rem labels, active = red `#e94560`, volume badge on Exercises tab (0.55rem), hover-only affordance.
- **AFTER:** height 56 + safe-area pad; `--bg-1` + top hairline `--line`; 5 tabs (Today, Workouts, Coach, Exercises, Profile) each ≥64 px wide; SVG icon 24 px outline / filled when active; label `type-caption` (11 px); active = `--go` icon+label + 3×20 px rounded indicator bar above icon; pressed = `--bg-3` circle behind icon. Volume badge → 16 px-high pill, `type-caption`, `--go-dim` bg `--ink-hi` text, offset so it never overlaps the icon; `aria-label="Exercises, 1.2 t logged today"`. During an active session the Workouts tab shows a 6 px `--go` dot (pulse, reduced-motion: static).
- **A11y:** `<nav aria-label="Main">`, `aria-current="page"` on active `NavLink` (react-router provides), visible focus ring inset.
- **Rationale:** red-as-active contradicts red-as-danger; a filled/indicator pattern reads faster than hue alone (color-blind safe).

### 19.3 Buttons
- **BEFORE:** `.btn-primary` indigo #4c4cff, radius 12, pad 16, full-width; `.btn-secondary` transparent + 2 px indigo border; `.btn-danger` (confirm dialogs); assorted one-off buttons (`.aw-end-btn` translucent black on gradient, `.plan-start-btn` white-on-gradient, coach violet inline styles).
- **AFTER (four variants, one component):**
  - **Primary:** `--go` fill, `--ink-on-accent` text, `type-headline`, height 52, radius `--r-md`, full-width in action bars.
  - **Secondary:** `--bg-2` fill + 1 px `--line-strong`, `--ink-hi` text, height 48.
  - **Danger:** `--danger` fill + `--ink-on-accent` (confirm sheets only); **danger-ghost** (row-level deletes): transparent, `--danger` text/icon.
  - **Quiet:** text-only `--ink-mid`, min-height 44 (replaces link-ish `.auth-toggle`, "Back to top").
  Pressed = 0.97 scale + darker fill; loading = inline spinner replacing label (width preserved).
- **A11y:** real `<button>`s everywhere (several current CTAs already are [VERIFIED]); icon+label preferred over icon-only.
- **Rationale:** every screen currently invents its own CTA; four variants cover 100% of audited use sites.

### 19.4 Icon buttons
- **BEFORE:** `.icon-btn` (＋ / 🗑) in exercise rows; `.remove-set-btn` ✕ 14 px text ~22 px target; `.session-edit-btn`/`.session-delete-btn` small text buttons; `.coach-copy-btn` etc.
- **AFTER:** 44×44 hit area always (visual glyph 20–24 px may sit in a 32 px `--bg-3` circle); variants: neutral (`--ink-mid`, hover/press `--bg-3`), danger (`--danger`), on-accent. Mandatory `aria-label`. Destructive icon buttons never act instantly — they open the confirm sheet (already true for deletes [VERIFIED], keep).
- **Rationale:** the smallest current targets are in the highest-fatigue context (set rows).

### 19.5 Inputs & numeric steppers
- **BEFORE:** `.set-input` 16 px, pad 10, border 1.5 px `#d0d0e8`, bg `#f8f8fd`, `type="number"` with spinners suppressed nowhere; shrinks to 14 px at ≤360 px [VERIFIED `Exercises.css:1606`] — reintroducing iOS zoom; text inputs (`.plan-name-input`, search, auth) similar family.
- **AFTER:** field = `--bg-2` fill, 1.5 px `--line-strong` border, radius `--r-sm`, height 48, `type-headline` value, `--ink-low` placeholder; label above in `type-label`; **never below 16 px font at any breakpoint** (iOS zoom rule — width, not font, shrinks). Numeric fields: `inputmode="decimal"` (weight) / `"numeric"` (reps), `enterkeyhint="next"`, select-all on focus. **Stepper wrap [REC-new]:** 44×44 − / + buttons flanking the field (weight ±2.5 kg default, long-press ±10; reps ±1); stepper writes through the same controlled value; hidden for screen readers in favor of the labeled input (`aria-hidden`, since the input remains editable).
  - Error state per §18.7; validation message slot reserved (no layout shift).
- **Rationale:** steppers cut the dominant gym interaction (adjust last set slightly) from keyboard-round-trip to one tap; R10 dependency.

### 19.6 Chips & filters
- **BEFORE:** `.filter-chip` muscle groups (Exercises), `.intensity-chip` (coach), FAQ toggles — light-theme pills, active = indigo.
- **AFTER:** height 36 (44 hit area via margin), radius `--r-full`, `type-label`; default `--bg-2` + `--line`; selected `--go-dim` fill + `--go` 1 px border + `--ink-hi`; disabled 40%. Single-select rows are `role="radiogroup"` (`aria-checked`), scrollable horizontally with 16 px edge fade, no scrollbar.
- **Rationale:** selected-state today is hue-only; dim-fill + border survives color-blindness.

### 19.7 Cards & list rows
- **BEFORE:** white cards radius 12–16 assorted shadows; rows are clickable `div`s (plan-exercise-row, exercise-card, session-card) with no pressed/focus state; meta text `#9999b3`.
- **AFTER:** card = `--bg-1`, radius `--r-lg`, 1 px `--line`, pad 16, no shadow at rest. Row = min-height 56 (64 in-workout), 12 px vertical pad, grid: [40 px leading icon] [content: `type-headline` + `type-label` meta in `--ink-mid`] [trailing value/chevron]. Rows that navigate get a chevron; rows that open actions get explicit buttons. All rows become `<button>`/`role="button"` + Enter/Space (R26). Pressed = `--bg-3`.
- Muscle-group leading icon: 32 px rounded square `--bg-3` with tinted SVG glyph per group (replaces emoji thumbs).

### 19.8 Badges & status pills
- **BEFORE:** `.overload-badge` ▲/▼, `.record-chip` emoji chips, "Logged" text badge, `.nav-badge`, `.cv-readonly-badge`.
- **AFTER:** one pill primitive: height 20–24, radius full, `type-caption`, dim-fill + matching ink: progress `--go-dim`/`--go` (▲ +120 kg), regression `--danger-dim`/`--danger` (▼), PR `--record` outline pill with trophy icon, neutral `--bg-3`/`--ink-mid`. Arrows keep direction glyphs (not color-only).

### 19.9 Progress & charts
- **BEFORE:** inline SVG VolumeGraph/MiniVolumeGraph (indigo line on dark-ish greys), cardio progress div-bar, aw progress bar (white on gradient).
- **AFTER:** chart ink `--go` line 2 px, area fill 12%→0 gradient of `--go`, gridlines `--line` dashed, axis text `type-caption` `--ink-low`, dot markers only for ≤12 points; PR points marked `--record`. Bars (weekly volume): 8 px rounded, `--go` current period vs `--bg-3` past. All charts get `role="img"` + generated `aria-label` ("Volume last 10 sessions, trending up, best 2.4 t"). Progress bars: track `--bg-3` 8 px, fill `--go`, no text inside the bar.

### 19.10 Set rows (the money component — full spec in §20.4)
See §20.4; visual summary: 56 px grid `[28 set#] [stepper+reps] [stepper+weight] [44 remove]`, prior-session ghost line, done/active/invalid states.

### 19.11 Timers (SetTimer block)
- **BEFORE:** two stacked blocks (Exercise / Rest) with label + `M:SS`, start/rest/reset buttons, rest-duration number input + auto-start toggle; alert = full-block flash overlay cycling 3 colors; live app has a more compact variant [OBSERVED LIVE parity — remote `c97c0b26` not read].
- **AFTER:** single card `--bg-2` radius `--r-lg`: left = active phase (`type-timer` 40 px tabular digits + caption EXERCISE/REST/READY), right = the inactive phase small (`type-label`). Rest running: digits `--rest`, thin circular or linear countdown track (`--rest` on `--bg-3`). Final 5 s: §18.9 pulse. Controls: 48 px buttons — [Start set] (primary), [Rest 90s] (secondary, long-press opens quick-select 60/90/120/180 + custom — supersedes the number input; the input remains in an expandable "Rest settings" row with the auto-start toggle). Auto-start toggle becomes a proper switch (44 px track) with `role="switch"` (already present [VERIFIED]) + visible label.
- **A11y:** timer digits `aria-live="off"` (no chatter) but phase changes announce via a polite live region ("Rest started, 90 seconds").
- **Rationale:** the two-block layout spends the sticky zone's pixels on the *idle* timer; one dominant phase matches how lifters actually glance. Must be reconciled with the live compact-timer commit during R1.

### 19.12 Modals & bottom sheets
- **BEFORE:** `.modal-overlay` bottom-aligned sheet radius 20/20/0/0, `slideUp 0.22s`; `modal--log` centered 92vh full-bleed variant; confirm dialogs centered cards; overlay-click closes; no focus trap/Escape/`role`.
- **AFTER:** two primitives.
  - **Sheet** (default for pickers, confirms, edit prescription, add exercise, end-workout): bottom-anchored, `--bg-2`, radius `--r-xl` top, 32×4 px `--line-strong` grabber, pad 20, `max-height 92dvh`, scrim `rgba(6,8,10,.6)`; actions stacked full-width at bottom with safe-area pad; in 240 ms, out 180.
  - **Full log modal**: near-fullscreen sheet (`top: max(12px, safe-top)`), sticky top zone (timer+tabs, `e1`), scrollable body, sticky bottom action bar (§20.6).
  Both: `role="dialog" aria-modal="true"`, labelled by title, focus trapped, Escape + scrim-tap + grabber-swipe (P2) close non-destructive dialogs; destructive confirms require an explicit button. Focus returns to the invoker on close (R26).

### 19.13 Banners & toasts
- **BEFORE:** UpdateBanner (indigo/light block), SyncBar text bar, active-session banner (solid `#00cc55`), warm-up banner, completion banner 🎉, editing banner.
- **AFTER:** one **banner** primitive (in-flow, under header): radius `--r-md`, dim-fill by semantic (info `--bg-2`, attention `--rest-dim`, success `--go-dim`, error `--danger-dim`), 20 px leading icon, `type-body` message, optional trailing quiet-button action, optional dismiss ✕ (44 px). Update banner → info variant "New version available · Reload". Active-session banner → success variant with live elapsed (tabular) + trailing "Resume" primary-ghost; whole banner tappable, End moved *out* (§20.1).
  One **toast** primitive [REC-new] for transient confirmations ("Set saved · Undo", §20.7): bottom-anchored above the action bar, `--bg-3` + `e2`, auto-dismiss 4 s (pauses on touch), max 1 on screen, `aria-live="polite"`, never used for errors that require action.

### 19.14 Skeletons, empty, error, offline & sync states
- **Skeletons [REC-new]:** `--bg-3` blocks (radius matching target), 1.2 s shimmer (reduced-motion: static), used on Today/History first paint and CoachView load; content-shaped (3 stat blocks + list), never full-screen spinners. Auth "Loading…" card keeps but restyled.
- **Empty states:** icon (24 px, `--ink-low`) + `type-headline` one-liner + `type-body` hint + optional primary action. Copy per §21. Preserve every screen's existing intentional empty state (R25).
- **Error states:** banner primitive (error variant) + retry action; error boundary screen (R23) = centered card: warning icon, "Something broke", body "Your data is safe on this device.", [Reload] primary + [Export data] secondary.
- **Offline/sync:** SyncIndicator floating pill → status pill in the header row, cycling per state: ✓ Synced (`--go`, fades after 2 s), ↻ Syncing (`--ink-mid`, rotating icon), ⚠ n pending (`--rest`, tap = retry/detail sheet per R7), ⚡ Offline (`--rest`, persistent, "changes saved on this phone"). Never red for offline — offline is normal, not an error (principle #2).

### 19.15 Exercise cards (Exercises page rows)
- **BEFORE:** white rows with name, group, "Last: reps · vol", ▲/▼ badge, ＋ and 🗑 icon buttons; tap row = history modal.
- **AFTER:** row primitive (§19.7) with muscle icon; primary line = name; meta = group · sessions count; trailing = last-session compact stat (tabular) + overload pill; ＋ becomes trailing 44 px "Log" icon-button (primary-ghost); delete moves *into* the history modal's overflow (reduces accidental destructive taps on the list — danger stays one level deeper). Filter chips per §19.6.

---

## 20. Active-workout usability redesign (exhaustive)

Everything here is **[REC]** built on the verified current flow (audit §7) and depends on Part I R3–R5 (session lifecycle) and R8 (duplication fix).

### 20.1 Screen anatomy & thumb zones
```
┌─ sticky header (e1, safe-top) ──────────────┐
│ ACTIVE · Legs & Biceps      ⏱ 41:02 (tab.)  │  ← calm bar: --bg-1, hairline;
│ ▓▓▓▓▓▓▓▓░░░░ 7/11 exercises                 │    NO gradient, NO decorative blob
└──────────────────────────────────────────────┘
   scrollable exercise list (rows 64px)
   … next-up exercise auto-highlighted …
┌─ bottom action bar (e1, safe-bottom) ───────┐
│ [ ▷ Log next: Hack Squats  (primary 52px) ] │
│ [ Rest 90s ]                [ ⋯ End/menu ]  │
└──────────────────────────────────────────────┘
```
- All mutating actions live in the bottom bar or in sheets rising from it (thumb zone). The current top-right `aw-end-btn` is removed; **End workout** moves into the bottom `⋯` overflow → confirm sheet. One extra tap for a rare action buys accidental-end protection.
- Header: elapsed in tabular numerals, negative durations clamped to 0:00 (F-AW-3); progress bar = `--go` on `--bg-3`.
- The green gradient header + white decorative circle [VERIFIED] are deleted; "active" is communicated by the sticky bar + nav dot, not by shouting.

### 20.2 Exercise rows (in-workout)
- 64 px rows; states:
  - **Next up:** 1.5 px `--go` border + "NEXT" caption; auto-assigned to the first incomplete row (scroll restored to it on re-entry).
  - **Default (todo):** standard row; trailing "Log" primary-ghost + prescription `3×12` tabular.
  - **In-progress** (some sets logged, < prescribed): `--go-dim` leading number chip, trailing `2/3 sets`.
  - **Done:** row bg `--go-dim` at 40%, name stays `--ink-hi` (no strikethrough — re-reading a done exercise matters), trailing ✓ pill "4 sets · 380 kg". Done rows remain tappable (opens editor per R8, not a duplicate session).
  - **Invalid/missing exercise** (id not found — currently silently skipped [VERIFIED `ActiveWorkout.js:302`]): render a muted row "Unknown exercise (removed?)" with an "Edit plan" quiet action instead of vanishing (data honesty).
- Row tap target = whole row; no nested small targets besides the trailing button.

### 20.3 Entry sequence & tap budget
Target tap counts (excluding numeral typing):
- Log a set identical to last set: **1 tap** ("＋ Same as last set").
- Log a set = last set + 2.5 kg: **2 taps** (same-as-last, weight `+` stepper).
- First set of an exercise from the list: **2 taps** to a ready keyboard (row → reps field auto-focused).
- End workout: **3 taps** (⋯ → End workout → confirm End & save) — intentionally ≥3.
Field order per row: **reps → weight** (matches current column order [VERIFIED]); `enterkeyhint="next"` hops reps→weight→next row's reps; weight field pre-filled from ghost (below) so typing is usually only reps.

### 20.4 Set rows & previous-set ghosts
```
SET  REPS          WEIGHT(kg)        ✕
 1   [−][ 12 ][+]  [−][ 80  ][+]    (done: row settles to --go-dim tint)
 ghost: last time 12 × 80 · beat it        ← type-label, --ink-low
 2   [−][    ][+]  [−][ 80* ][+]          ← *carried from set 1
 [＋ Same as last set]   [＋ Empty set]
```
- **Ghosts:** under each set index, the corresponding set from the *previous session* (from `getPreviousSets`, already computed for the coach [VERIFIED]) renders as `12 × 80` in `--ink-low`; if the current entry beats it, the ghost gains a small ▲ `--go`. Tapping a ghost copies it into the row (1-tap match-last-time).
- **Row states:** active (focused) = `--line-strong`→`--focus` border; **valid-complete** (reps>0) = set number chip turns `--go-dim`; **invalid** (weight without reps, or non-numeric) = `--danger` border + caption "Add reps" — Done button stays enabled but invalid rows are excluded with a toast note (current behavior silently filters [VERIFIED `saveSession`]; the redesign makes the filtering visible).
- Remove ✕ = 44 px danger-ghost icon button; removing a non-empty row shows the Undo toast instead of a confirm (fast, reversible).
- **Warm-up flag (R11):** long-press the set number (or tap the "W" chip in the row's overflow) marks the set warm-up → number chip renders `W` in `--rest-dim`; excluded from PR/overload comparisons. **Dropset:** "＋ Drop" appears after a completed set (pre-fills reps empty / weight −20%), rendered indented with a ↳ glyph. **Superset:** plan-level pairing tag (Workouts edit mode, P2); during the workout, paired exercises render as one grouped card alternating rows, rest advisor switches to the superset range (engine support already exists [VERIFIED `getRecommendedRest(...,isSuperset)`]).
- Live totals pills (reps/volume) stay [VERIFIED, keep] restyled per §19.8, plus a "vs last time" delta pill.

### 20.5 Rest presentation in-flow
- Saving a set with auto-start on: rest starts automatically (R12) and the sticky timer flips to REST with the countdown; a slim inline strip also appears under the just-saved set ("Rest 1:30 · skip") so the user doesn't need to look up.
- RestAdvisor's range (goal×intensity) renders inside the quick-select sheet ("suggested 2–4 min for hard · hypertrophy") instead of a separate card — advice at the moment of choice.

### 20.6 The log modal (until it becomes a full screen — see decision)
**Decision point for Lloyd:** keep the near-fullscreen modal (lower risk, current architecture [VERIFIED]) or promote logging to a route (`/workout/:planId/log/:exerciseId`) for back-button ergonomics. **Recommendation: keep the modal in this cycle** (back-button/router work is orthogonal risk), but implement it as the §19.12 full sheet with: sticky top = exercise name + build tag removed to overflow (the build id chip in a gym-critical header [VERIFIED `ExerciseLogModal.js:258`] is developer chrome — relocate to Profile only), timer card, tabs (Log / Overview); sticky bottom = [Done — save n sets] primary + [Cancel] quiet. Body scrolls between them; "Back to timer" button becomes unnecessary (timer is sticky) and is removed.

### 20.7 Undo & accidental-tap prevention
- **Undo toast** after: set row removal, session save ("Saved 4 sets · Undo" — undo re-opens editor state), session delete from Overview (undo restores locally; remote delete deferred until toast expiry), plan-exercise removal. 4 s window.
- Confirm **sheets** (not window.confirm — replaces the `window.confirm` in token rotation [VERIFIED `Profile.js:66`]) reserved for: End workout, delete exercise (+ its N sessions), delete session (kept [VERIFIED], restyled), rotate share token, reset coach.
- End workout button placement per §20.1; End & Save is the *right-hand* action, Keep going is left/secondary (current overlay [VERIFIED] already orders this way — keep).
- Starting a different plan while one is active: choice sheet per R6 (never silent clobber, D19).

### 20.8 Session recovery & sync messaging in-workout
- On entering ActiveWorkout with a restored session (from tombstone-aware sync, R3): banner "Resumed session started 09:12 on iPhone · looks right?" with [Keep going] / [End that session] — surfaces the cross-device case instead of silently trusting it.
- Offline during a workout: status pill switches to ⚡ "Saving on this phone" once, no modal, no red; the workout flow is *identical* offline (principle #2). Pending count visible in the pill; flushed on reconnect (R9).
- If a set save's remote push fails, nothing blocks; the pill increments. No per-set error toasts (would train users to ignore toasts).

### 20.9 Keyboard, scroll & focus behavior
- Focused input scrolls into view above the keyboard: `scroll-margin-bottom: 220px` on set inputs + `visualViewport` listener keeps the sticky bottom action bar above the keyboard (falls back gracefully; QA gate §23).
- Opening the modal focuses nothing by default (prevents keyboard flash while glancing); tapping a row focuses reps. `autofocus` is removed from search/name inputs on touch devices for the same reason, kept on desktop widths.
- Body scroll locks under sheets/modals (currently the background can scroll [VERIFIED: no scroll-lock code exists]); scroll position restored on close.
- After Done: modal closes → exercise list scrolls the *next-up* row into view.

### 20.10 End-workout confirmation & summary
- Confirm sheet: title "End workout?", meta "7/11 exercises · 41:02 · 3.2 t", [Keep going] secondary + [End & save] primary; a skipped-exercises note when <100% ("4 exercises not logged — they'll stay in the plan").
- Summary (WorkoutSummary restyled): hero volume `type-display` tabular, stat trio (sets / volume / duration), overload wins list with ▲ pills, regressions with calm `--danger-dim` pills and coach line, PR moments with `--record` trophy pills, cardio ring if onboarded, next-day preview, one closing message (existing rotation [VERIFIED], tone rules §21). Primary action [Done] returns to Workouts; secondary [Share as text] (P2 — copies a plain-text recap; no images, no network).

---

## 21. Content design & microcopy

**Voice:** terse gym partner — direct, concrete, zero fluff, encouraging without exclamation-mark inflation. Numbers do the motivating.

Rules:
1. **Sentence case everywhere** (buttons, titles, labels); ALL-CAPS only for `type-caption` overlines.
2. **Buttons start with verbs** and name the object when destructive: "End & save", "Delete 12 sessions", "Rotate link".
3. **Numbers first** in feedback: "＋2.5 kg on last time" beats "Great improvement!".
4. **Never blame the user**: "Couldn't reach the server — changes are saved on this phone" not "Sync failed".
5. **Destructive copy states the blast radius**: "Delete Hack Squats and its 37 logged sessions? This can't be undone."
6. **Empty states teach the next action**: History → "No workouts yet. Start one from Workouts and it'll show up here."
7. **No fake urgency, no streak-shaming**; a broken streak renders as neutral fact.

**Language & formats (decision points for Lloyd, with recommendations):**
- **UI language: English** (current UI is English with Dutch-formatted dates [VERIFIED — `nl-NL` in 6 files vs `<html lang="en">`]). Recommendation: keep English UI, format **dates and numbers with the device locale** (`toLocaleDateString(undefined, …)`), and set `lang` dynamically only if full localization ever happens. Alternative (if Lloyd prefers Dutch dates everywhere): keep `nl-NL` but set `<html lang>` per-element correctly. One decision, applied everywhere — mixed as-is fails screen-reader pronunciation.
- **Units: kg only**, suffix always spaced ("80 kg"), one decimal max ("82.5 kg"), volume in t above 1000 ("1.2 t"), tabular numerals wherever compared.
- **Times:** durations `M:SS` / `H:MM:SS` (current [VERIFIED], keep); timestamps per device locale, relative labels for <7 days ("Yesterday", "Tue").
- Examples (BEFORE → AFTER): "⚠ Sync error: Sync failed" → "Couldn't sync — will retry. 3 changes pending."; "📭 No history yet on this device/site — log a session…" → "No history yet. Log a session to see records and trends."; "Rotating the token will invalidate the current link. Continue?" (window.confirm) → sheet: "Rotate coach link? The old link stops working immediately." [Cancel]/[Rotate link]; nav "Dashboard" → "Today".

---

## 22. Screen-by-screen BEFORE → AFTER inventory

Every active route/surface. BEFORE = [VERIFIED from source]; AFTER = [REC]. IA changes from Part I §6 are restated where they bind.

| # | Surface | BEFORE (verified) | AFTER (recommended) | Removed / merged / retained |
|---|---|---|---|---|
| S1 | **AuthScreen** | Dark violet card on `#0d0d1a`; 💪 logo; email+password; toggle sign-in/up; no reset locally (live has one) | Same structure on `--bg-0`/`--bg-2` tokens; dumbbell SVG mark; inputs §19.5; submit primary; add "Forgot password?" quiet link **after R1 reconcile** (feature exists remotely — do not re-implement); error/info as §19.13 banners | Retain flow; merge remote forgot-password; remove violet palette |
| S2 | **SetupScreen** | Card with skip + instructions; points to wrong `schema.sql` | Restyle to tokens; instructions reference `schema_current.sql` (R13); steps in numbered list with mono block | Retain; fix doc target (P0 text fix) |
| S3 | **Workouts** | Heading; green active-session banner w/ End; native select + "+ New"; indigo gradient plan header w/ Start/Edit; rows w/ ✏️ prescription modal, ✕ remove, fake drag handle; dashed add button | Header block §19.1; banner → success banner + Resume (End moves into ActiveWorkout only — one place to end); plan picker = row opening a **sheet** (radio list + "New plan…") replacing native select; plan card `--bg-1` (no gradient) with Start primary / Edit quiet; rows §19.7 with prescription trailing; edit mode gains real reorder (P2) or hides handle until then; add-exercise = sheet | Remove gradient, drag-handle illusion, native select; retain seed plans, modals→sheets |
| S4 | **ActiveWorkout** | Green gradient header + blob; elapsed+count stats; warm-up banner; rows w/ Logged badge; completion banner; end overlay | Full §20 redesign: calm sticky header, next-up logic, bottom action bar, ghost targets, undo, recovery banner | Remove gradient/blob & top-right End; retain warm-up prompt (as §19.13 banner), completion state, confirm-before-end |
| S5 | **ExerciseLogModal (Log tab)** | Sticky timer+tabs; set rows w/ small ✕; add-set dashed; live totals; coach intensity chips + RIR + RestAdvisor + feedback; Done/Cancel bottom | §20.4–20.6: steppers, ghosts, warm-up/drop flags, sticky action bar, undo toast; coach block collapses to a single "Coach" expandable card after set 1 (less scroll); build-id chip removed to Profile | Retain tabs, totals, coach features; remove "Back to timer" button, build chip |
| S6 | **ExerciseLogModal (Overview tab)** | Records chips, volume SVG, last-session table, last-5 cards w/ Edit/🗑, confirm delete | Pills §19.8, chart §19.9, session cards §19.7 with 44 px actions; delete keeps confirm sheet + gains Undo | Retain all content; restyle |
| S7 | **WorkoutSummary** | Stat trio, overload list, closing message, plan preview | §20.10 | Retain; restyle; add PR pills |
| S8 | **Today (replaces Dashboard `/`)** | 4 stat cards all "—" | R19 real screen: resume card, week stats (sessions/volume/streak), last workout, cardio ring, recent PRs; skeleton on first paint | **Remove placeholder Dashboard entirely** |
| S9 | **History (`/history`) + day detail** | Hard-coded fake February sessions | R20 real screen: day-grouped list (date, plan name, exercises, sets, volume), tap → day detail listing exercise sessions with edit/delete via S5/S6 machinery; empty state per §21 | **Fake page deleted**; route becomes real |
| S10 | **Home `/home`, Workout `/workout`, Progress `/progress`** | Static demo pages w/ fake data | **Deleted** (routes removed or redirect to `/` / `/workouts`); Progress content folds into Today + per-exercise views (P2 dedicated screen only if Today outgrows) | Removed |
| S11 | **Exercises** | Filter chips; rows w/ last-session line + badges; add-exercise inline form; history modal | Chips §19.6; rows §19.15; inline add form → sheet with name + muscle-group select (fixes hidden 'Legs' default D21 — group is explicit); history modal restyled | Retain everything functionally; delete moves into history modal overflow |
| S12 | **ExerciseHistoryModal** | Per-exercise records/graph/sessions (not fully re-read this pass — structure verified via imports) | Same content on §19 primitives; entry point for exercise delete (confirm sheet with session count) | Retain |
| S13 | **Coach dashboard** | Plan card, stat trio, cardio bar, deload card, philosophy, days list, FAQ accordion, settings button | Tokens + §19 primitives; FAQ accordion gets chevron rotation + `aria-expanded` [currently plain buttons — VERIFIED]; "AI Coach" heading → "Coach" (honesty, F-COACH-2); deload card uses `--rest-dim` | Retain all; rename |
| S14 | **CoachOnboarding** | 7-step wizard w/ progress bar, option cards (CSS not fully audited) | Option cards → §19.6/19.7 selected states; progress = §19.9 bar; Back quiet / Next primary in bottom bar; each step one decision per screen | Retain flow |
| S15 | **CoachSettings** | Plan switcher, personality options, reset w/ confirm | Primitives; reset = danger confirm sheet stating what resets (profile+metadata+cardio, not logs) | Retain |
| S16 | **CoachFeedback / RestAdvisor (in-modal)** | Text cards after save; rest range card | Feedback = compact banner w/ semantic tint by overload type (▲ go / ▬ neutral / ▼ danger-dim), one line + expandable detail (frequency setting respected); RestAdvisor folds into rest quick-select sheet §20.5 | Retain engine; relocate advisor |
| S17 | **CoachView (share link)** | Standalone dark-ish page: header, read-only badge, exercise grid, last session, PRs, volume graph | Same layout on tokens (it's already closest to the target look); add skeleton while loading; add "Data updated …" freshness line; **content correctness gated on R15** | Retain; restyle lightly |
| S18 | **Profile** | Avatar emoji, email, sync status text, Sync now (inline styles), coach-share block w/ toggle/copy/rotate, sign-out, build footer; live adds Timer Defaults [OBSERVED LIVE] | Sectioned list rows: Account (email, sign out), Sync (status pill §19.14, Sync now, pending count, Diagnostics R33), Timers (defaults — merge remote work), Coach sharing (toggle switch, link row w/ copy, rotate = danger-ghost + sheet), **Data & privacy** (Export/Import R17, "what's stored where" explainer, build id + version) | Retain all; add Data section; window.confirm removed |
| S19 | **SyncIndicator / SyncBar / UpdateBanner** | Floating ✓/↻/⚠/⚡ pill; top text bar; indigo banner | Unified header status pill + banner primitives §19.14/19.13; SyncBar retired (its states fold into the pill + banners) | Merge three patterns into two primitives |
| S20 | **Dialogs/overlays** (delete confirms, end-workout, token rotate, plan-conflict R6) | Mix of centered cards + window.confirm | All become §19.12 sheets with §18.7 states and §21 copy | Merge into one primitive |
| S21 | **BottomNav** | §19.2 BEFORE | §19.2 AFTER; "Dashboard"→"Today" label | Retain 5 tabs |
| S22 | **index.html / manifest** | CRA defaults ("React App") | Title "RepTrack", real description, manifest name/short_name, `theme_color #0F1216`, `background_color #0F1216`, real icons (dumbbell mark, 192/512 + maskable), apple-touch-icon (R30/D23) | Replace defaults |

---

## 23. Visual QA checklist (release gate for every design PR)

**Viewports (portrait unless noted):** 320×568, 360×800, 375×667, 390×844 (primary), 428×926, 844×390 landscape sanity (no layout explosion; content scrolls). At 320: **zero horizontal overflow** on every screen (gate: `document.documentElement.scrollWidth <= innerWidth`).

**Device/safe-area cases:** notch device (390×844 with top inset 59/bottom 34) — sticky header content below the notch, bottom bar above the home indicator; no-inset Android — no dead spacer visible; PWA standalone mode — status-bar area readable against `--bg-0`.

**Contrast (checker-verified, not eyeballed):** every §18.1 ink/surface pair ≥4.5:1 (text) or ≥3:1 (≥18 px bold text, icons, focus ring vs adjacent); accent-fill buttons: label vs fill ≥4.5:1; charts: line vs bg ≥3:1. Record any waived pair in the PR description with justification.

**Touch targets:** DevTools audit of every interactive element ≥44×44 effective (padding counts); adjacent targets ≥8 px gap; set-row ✕, nav tabs, stepper buttons, session-card actions explicitly measured.

**Keyboard-obscuration gates (real devices, iOS Safari + Android Chrome):** focusing any set input keeps the input AND the sticky Done bar visible; auth form submit reachable with keyboard open; no input ever renders <16 px (triggers iOS zoom).

**States sweep per component:** default/pressed/focus-visible/disabled/error/loading rendered and photographed; focus ring visible on `--bg-0`, `--bg-2`, and accent fills; reduced-motion mode exercised for: sheet open, rest final-5s, skeletons, PR celebration.

**Screenshot comparison protocol:** during implementation (not before — **no baseline screenshots exist as of this document**), capture per-screen before/after pairs at 390×844 into `docs/design-qa/<screen>/{before,after}.png`, committed with the PR; each backlog item's AC references its pair. Dark-room glance test: after-screenshot legible at 50% brightness from arm's length (subjective, two reviewers).

**Regression guards:** timer digits don't shift layout while ticking (tabular check); long exercise names (40+ chars) ellipsize, never wrap the trailing column; 0-data, 1-item, and 500-item list renders; Dutch-length strings if the locale decision goes that way.

---

## 24. Design-change backlog (mapped, dependency-ordered)

Priorities align with Part I (§13). "Dep" = must land after. Files listed are the audited touch points.

| ID | Pri | Change | Dep | Affected files/components | Acceptance criteria |
|---|---|---|---|---|---|
| DS-1 | P0 | Token foundation: new `:root` palette/type/space/radius/motion tokens; delete `App.css` body conflict; document in `docs/design-system.md` | R1 | `src/index.css`, `src/App.css`, new doc | Tokens defined once; app renders on `--bg-0`; no `body` rule outside index.css; contrast table checked per §23 |
| DS-2 | P0 | Legacy-color purge: migrate all hard-coded hexes (≈96 refs) + 5 gradients to tokens; remove inline style objects in `App.js`, `Workouts.js`, `Profile.js` | DS-1 | every `.css`, `App.js`, `Workouts.js`, `Profile.js`, `CoachView.js` (SVG colors) | `grep -E '#[0-9a-fA-F]{3,8}' src --include='*.js' -r` → 0 outside token file/icons; screens visually coherent per screenshots |
| DS-3 | P0 | Fake-surface removal: delete Home/Workout/placeholder History/Progress routes & files; Dashboard → Today shell (even if stats land in DS-12) | R2 | `App.js`, `pages/Home.js`, `pages/Workout.js`, `pages/History.js`, `pages/Progress.js`, `pages/Dashboard.js`, `BottomNav.js` | No route renders fabricated data; nav label "Today"; redirects in place |
| DS-4 | P0 | Dialog semantics: sheet/modal primitive w/ `role="dialog"`, focus trap, Escape, scroll-lock, focus return; migrate all overlays incl. `window.confirm` sites | DS-1 | new `components/Sheet.js`, `ExerciseLogModal`, `Workouts` modals, `Exercises` confirms, `Profile.js:66`, `ActiveWorkout` end overlay | Keyboard walkthrough passes; axe: no dialog violations; background never scrolls under an open sheet |
| DS-5 | P0 | Reduced-motion + rest-alert replacement (≤1 Hz pulse; kill 3-color 400 ms flash) | DS-1 | `SetTimer.js`, `TimerContext.js`, `Exercises.css` timer styles | With `prefers-reduced-motion`: zero animated transforms/flashes; alert still audible/haptic; default pulse ≤1 Hz measured |
| DS-6 | P1 | Icon system: SVG set + replace all functional emoji; aria-labels | DS-1 | new `components/icons/*`, `BottomNav`, `Exercises`, `ExerciseLogModal`, `Profile`, `SyncIndicator`, `RecordBadges`, group thumbs | No emoji in interactive elements (`grep` emoji ranges in JSX); every icon-only button labeled; nav renders identical glyphs iOS/Android |
| DS-7 | P1 | Button/input/chip/row/badge primitives + migration | DS-1, DS-6 | new `components/ui/*`, all pages | Four button variants cover all CTAs; inputs never <16 px at any width (Exercises.css 360px override removed); rows are focusable buttons; states per §18.7 photographed |
| DS-8 | P1 | Bottom nav redesign (indicator, badge fix, active-session dot) | DS-6, DS-7 | `BottomNav.js/.css` | Active ≠ color-only; badge ≥11 px & non-overlapping; dot appears iff session active (uses R4 event) |
| DS-9 | P1 | ActiveWorkout restructure: calm sticky header, bottom action bar, End relocation, next-up logic, row states | R3–R5, R8, DS-7 | `ActiveWorkout.js/.css` | §20.1 anatomy matches; End = 3 taps; tap budgets of §20.3 measured; gradient/blob absent |
| DS-10 | P1 | Set-row upgrade: steppers, ghosts, undo toast, keyboard/scroll behavior, invalid-state visibility | R8, DS-7 | `ExerciseLogModal.js`, `Exercises.css`, new `Toast.js` | 1-tap same-as-last works; ghost shows previous session; removing a set is undoable 4 s; keyboard gates §23 pass |
| DS-11 | P1 | Timer card redesign + quick-select rest sheet (reconcile with remote compact-timer/quick-select commits first) | R1, DS-7 | `SetTimer.js`, timer styles | One dominant phase; quick-select ≤2 taps to change rest; advisor text appears in sheet; auto-start switch labeled |
| DS-12 | P1 | Today screen (real stats) + skeletons | R19, DS-3, DS-7 | `pages/Today.js` (new), helpers | §22-S8 AC + M2 perf note; numbers reconcile with logs |
| DS-13 | P1 | History + day detail | R20, DS-7 | `pages/History.js` (rebuilt) | §22-S9; edit/delete round-trips through existing modal machinery |
| DS-14 | P1 | Status/sync surface unification (pill + banners; retire SyncBar; pending count) | R7/R9, DS-7 | `SyncIndicator.js`, `App.js` SyncBar, `UpdateBanner.js` | One status pattern app-wide; offline is amber not red; tap → retry sheet |
| DS-15 | P1 | Profile restructure + Data & privacy section (export/import UI) | R17, DS-7 | `Profile.js` | §22-S18; export produces versioned JSON; copy per §21 |
| DS-16 | P1 | Microcopy pass (all §21 rules + examples; locale/date decision applied once Lloyd decides) | DS-3 | all pages | No ALL-CAPS sentences; destructive copy states blast radius; date formatting consistent w/ one documented locale rule; `lang` consistent |
| DS-17 | P1 | PWA identity (title/manifest/icons/theme-color) | — | `public/index.html`, `manifest.json`, icons | Installs as "RepTrack" w/ correct icon; Lighthouse installability pass |
| DS-18 | P2 | Warm-up/dropset flags UI + superset grouped card | R11, DS-10 | `ExerciseLogModal`, `coachEngine` (exclusion), plan editor | W-sets excluded from PR/ghost comparisons; drop rows indent; superset rest range applied |
| DS-19 | P2 | Coach surfaces restyle + "Coach" rename + feedback banner form | DS-7 | `Coach*.js/.css`, `CoachFeedback.js`, `RestAdvisor.js` | §22-S13–S16 |
| DS-20 | P2 | CoachView restyle + freshness line (content gated on R15) | R15, DS-1 | `CoachView.js/.css` | §22-S17 |
| DS-21 | P2 | Plan-editor reorder (real drag or up/down buttons) + explicit muscle-group on quick-create | DS-7 | `Workouts.js` | Handle only when functional; new exercise never silently 'Legs' |
| DS-22 | P2 | Haptics/sound toggles + PR celebration (record pill + `[30,60,30]`) | DS-10 | `utils/timer.js`, `Profile`, summary | Toggles persist & are respected; celebration honors reduced-motion |
| DS-23 | P2 | Sheet swipe-to-dismiss, share-as-text summary, edge-fade scroll hints | DS-4 | Sheet, WorkoutSummary | Nice-to-haves; no gesture conflicts with scroll |

**Sequencing note:** DS-1→DS-5 ride with milestone **M0/M1** (they're cheap, high-leverage, and DS-3/DS-4/DS-5 close audit defects D12/D15/D26); DS-6→DS-17 constitute milestone **M2 "Built for the gym"**; DS-18+ fold into **M3**. Nothing in Part II blocks or reorders the P0 correctness work — and DS-9/DS-10 explicitly must not start before R3–R5/R8 land, so visual changes never paper over lifecycle bugs.

---

*Prepared by the Fable 5 audit session referenced in handoff `20260713-044244-12ab7576`. All recommendations are proposals; production writes, migrations, deployments, and git mutations remain gated on Lloyd's explicit approval. Part II added 2026-07-13 at Lloyd's request: BEFORE states verified from source only (no screenshots were rendered or inspected); AFTER states are recommendations.*
