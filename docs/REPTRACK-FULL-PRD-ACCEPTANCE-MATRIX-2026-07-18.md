# RepTrack full PRD acceptance matrix — 2026-07-18

**Canonical completion branch:** `feat/complete-prd-design`

**Base:** `origin/main@c08c53416d0584d91ee5fbedec3aaeb00fa9af44`

**Purpose:** prevent a phased release candidate from being represented as the complete combined RepTrack overhaul. A row may be marked complete only when its code, automated tests, required manual evidence, and documentation all exist on the same frozen commit.

## Governing inputs

1. `docs/REPTRACK-ACTIVE-UPGRADE-PRD-2026-07-13.md`, Parts I and II.
2. `docs/REPTRACK-CANONICAL-FEATURE-PRESERVATION-MANIFEST-2026-07-15.md`.
3. `docs/modal-ux-prd.md`.
4. `docs/PRD-persistent-timer.md`.
5. Existing working behavior and user data in the merged application.

## Status vocabulary

- **Done:** implementation and evidence satisfy the canonical requirement.
- **Partial:** useful implementation exists, but at least one normative acceptance criterion is absent.
- **Missing:** required behavior/artifact is absent.
- **Approval-gated:** code can be prepared, but production mutation, secret configuration, push, merge, or deployment requires Lloyd's exact approval.

No deployment is permitted while any P0/P1 row is Partial or Missing. P2 rows are also required for this completion branch because Lloyd explicitly requested the entire PRD, added features, UI overhaul, and design elements—not a phased subset.

## Functional requirements R1–R37

| ID | Base status | Completion definition and required evidence |
|---|---|---|
| R1 | Done/superseded | Preserve reconciled history and dirty-work backups; completion branch remains clean and based on merged main. |
| R2 | Done | Start/end paths use the canonical active-session API; lint/tests and authenticated smoke pass. |
| R3 | Partial | Tombstones, newest-update merge, 24-hour prune semantics, and all three real two-device convergence cases pass. |
| R4 | Done | Exactly one local active-session writer; every mutation stamps `updatedAt`. |
| R5 | Done | Dedicated `active_sessions` lifecycle row prevents settings clobber; regression test remains green. |
| R6 | Partial | Different-plan Start must present `End & start new` / `Resume existing`; no silent overwrite; negative elapsed clamps to zero. |
| R7 | Done/verify | Pending count, retry, reconnect flush, offline UI, and authenticated browser evidence. |
| R8 | Done/preserve | Reopen edits one session, preserves `remoteId`, and explicit “Log as new session” creates a second row. |
| R9 | Partial | Durable FIFO/idempotent outbox covers log insert/update/delete, exercise mutations, plan mutations, settings and coach state; reconnect/login/manual flush evidence. |
| R10 | Done/preserve | Same-as-last, steppers, autofocus, ghost targets, numeric keyboards, mobile QA. |
| R10a | Done/preserve | Five outcome tests, non-color cues, and reopen replay remain green. |
| R11 | Done/verify | Warm-up, superset and dropset fields/UX; warmups excluded from PR/overload; children included in totals but excluded from completion. |
| R12 | Partial | Save-set rest auto-start is configurable, per-exercise default works, advisor range is visible, and timer automation rules match timer PRD. |
| R13 | Missing | `supabase/schema_current.sql` is a fresh-project-complete DDL snapshot with all app tables/RPCs/RLS; legacy schema deprecated; README/SetupScreen updated; anon negative test documented. Production verification is approval-gated. |
| R14 | Partial | Every schema change has an additive timestamped migration; migration discipline documented; no destructive SQL. |
| R15 | Missing/approval-gated | Coach RPC reads real `exercise_logs` JSONB; valid token renders current data; invalid/disabled token denies. Applying RPC SQL to production requires Lloyd approval. |
| R16 | Missing/approval-gated | Explicit user resolution, key rotation SQL/docs, no inline secret output, Hayato-compatible handoff. Rotation/application require Lloyd approval. |
| R17 | Done/verify | Versioned full export plus additive import preview/dry-run/confirm; malformed/foreign versions rejected safely; round-trip test. |
| R18 | Missing/partial | Coach profile, metadata and cardio synchronize via owner-scoped state without whole-blob clobber; two-device test. |
| R19 | Partial | Real Today metrics: weekly sessions, 7-day volume, agreed rest-day-tolerant streak, last workout, active resume, cardio ring, latest three PRs; single-pass/memoized and <100 ms at one-year fixture. |
| R20 | Done/verify | Day-grouped History and detail/edit/delete use canonical modal/plumbing; large history bounded. |
| R21 | Partial | Epley e1RM tracked at save, all-time per-exercise PR list, subtle reduced-motion-aware celebration. |
| R22 | Missing | Weekly muscle-group volume bars derived from real exercise metadata; warmup rules consistent. |
| R23 | Done | Router ErrorBoundary, reload/export recovery, guarded startup storage access. |
| R24 | Partial | Central reporter classifies offline/auth/server, re-login prompt, backoff, and all fire-and-forget failures; diagnostics counters tested. |
| R25 | Partial/verify | Every reachable route has truthful loading/empty/error/data states; no fabricated fallback values. |
| R26 | Partial | Semantic interactive rows, complete dialog focus trap/Escape/return/scroll lock, icon labeling, locale/lang consistency, contrast and axe/keyboard evidence. |
| R27 | Partial | One token palette; legacy color/gradient purge; no conflicting body style; no ad-hoc inline visual styles; automated static gate. |
| R28 | Partial | Complete design-system inventory with primitives/states/token mappings and usage rules; source uses inventory components. |
| R29 | Partial | 320/360/390/420/428 portrait plus representative landscape QA for all primary routes; no clipping/overflow/hidden actions. |
| R30 | Done/verify | Correct title/manifest/icons/theme/apple metadata and Lighthouse installability evidence. |
| R31 | Missing | Minimal service worker: hashed assets cache-first, HTML/build-info network-first, cold offline start, waiting-update activation, kill switch, update test. |
| R32 | Partial/approval-gated | CI lint/test/build and Pages deploy from main with repository secrets; `predeploy` clean-tree gate; build commit must be on origin/main. Secret setup and deployment require Lloyd approval. |
| R33 | Done/verify | Error/rejection handlers and Profile diagnostics show last 20 errors, queue depth, last sync and build ID; no third-party telemetry. |
| R34 | Missing | Update check runs at mount, visibility return and every six hours; service-worker waiting state unifies with banner. |
| R35 | Done/extend | Preserve all incident/helper/timer tests; add tests for every repaired completion gap; remove vestigial tests. |
| R36 | Partial | Component coverage for all destructive, session, sync, coach gating, timer and modal flows; D-register defects have named regressions. |
| R37 | Missing | `docs/qa-checklists.md` contains executable two-device, offline, sharing, update, rollback, responsive, axe and phone end-to-end gates; evidence recorded per release. |

## Design specification DS-1–DS-23

| ID | Base status | Completion definition and required evidence |
|---|---|---|
| DS-1 | Partial | Single graphite Gym Floor token foundation and documented contrast table; one body rule. |
| DS-2 | Missing/partial | Zero non-token legacy hex/gradient references outside approved token/icon files; no inline style objects in named surfaces. |
| DS-3 | Missing | Delete/redirect fake Home/Workout/placeholder routes; every reachable surface derives from real data. |
| DS-4 | Partial | One accessible Sheet/Dialog primitive; migrate every overlay and `window.confirm`; focus/scroll tests. |
| DS-5 | Done/clean up | ≤1 Hz visual pulse, reduced-motion static fallback, sound/haptic behavior; remove dead 400 ms flash interval. |
| DS-6 | Partial | Replace all functional emoji with local SVG icons; label icon-only controls; static no-emoji gate. |
| DS-7 | Partial | Shared Button/Input/Chip/Row/Badge primitives and complete migration; 16 px inputs; ≥44 px targets. |
| DS-8 | Done/verify | Bottom-nav non-color active indicator, legible badge, active-session dot and responsive proof. |
| DS-9 | Done/verify | Calm ActiveWorkout structure, sticky header/action bar, safe end flow, row/next-up states, measured tap budget. |
| DS-10 | Done/preserve | Steppers, ghosts, undo, keyboard behavior, validation visibility and tests. |
| DS-11 | Done/extend | Dominant timer phase, quick rest ≤2 taps, advisor, labeled auto-start, pause/reset contract. |
| DS-12 | Partial | Complete Today data and truthful skeleton/loading/empty/error states. |
| DS-13 | Done/verify | History/day detail and edit/delete round trip. |
| DS-14 | Partial | One sync/status pattern; retire duplicate SyncBar; pending/retry detail; offline amber. |
| DS-15 | Partial | Complete Profile hierarchy and Data & Privacy import/export/diagnostics sections. |
| DS-16 | Partial | Global microcopy/locale/date pass; destructive blast-radius language; no inappropriate all-caps sentences. |
| DS-17 | Done/verify | Installable identity and Lighthouse evidence. |
| DS-18 | Done/verify | Warm-up/drop/superset visual semantics and analytics exclusions. |
| DS-19 | Partial | Unified Coach restyle/naming/feedback surfaces. |
| DS-20 | Partial/depends R15 | CoachView design and freshness line over real RPC data. |
| DS-21 | Done/verify | Functional reorder controls and explicit muscle group on quick-create; no decorative dead drag handle. |
| DS-22 | Partial | Sound/haptic toggles persist and are respected; PR celebration pattern and reduced-motion behavior. |
| DS-23 | Partial | Swipe-to-dismiss without scroll conflict, share-as-text summary and edge-fade hints. |

## Added-feature preservation gates

The following behaviors are non-negotiable regression gates:

- Atomic active-session sync and ended-tombstone tie rules.
- Duplicate-session prevention and explicit new-session action.
- Per-set done state and explicit exercise completion progress.
- Previous-training prefill without copied remote/session identity.
- Dropset children: generated weights, totals inclusion, completion exclusion.
- Stable `clientSetId`, `setIndex` and fingerprint across edits.
- Live cloud coaching lifecycle, idempotency, exact-log/set feedback and deterministic local fallback.
- Compact mobile log modal.
- Immediate same-weight rep feedback with non-color cues.
- Sticky modal tabs/actions, direct past-session edit, always-visible history graph.
- Global timer persistence across navigation/background/refresh/browser/device, superset-safe source-of-truth timestamps, start/pause/reset and configurable per-exercise rest.

## Completion gates

A final completion verdict requires all of the following on one frozen commit:

1. Every matrix row above is Done or explicitly superseded by a documented, user-approved contract.
2. Clean branch; no untracked release inputs; exact base and diff recorded.
3. Lint zero warnings, all unit/component/integration tests green, production build green.
4. Fresh-project schema bootstrap and RLS negative-test evidence; production RPC/schema changes separately approved and verified.
5. Real two-device lifecycle, coach-state and timer convergence checks.
6. Offline mutation and cold-start service-worker matrix.
7. Authenticated route matrix with real seeded data, destructive round trips and no console/network failures.
8. Responsive and landscape screenshots for all primary routes; axe and keyboard walkthrough.
9. Performance, bundle-size, privacy and secret scans pass.
10. Independent specification review followed by independent code-quality/security review; Critical/Important findings closed and re-reviewed.
11. CI main deployment mechanism configured but not triggered until Lloyd sees and approves the exact target, source SHA and action.
12. Rollback commit and drill procedure documented.
