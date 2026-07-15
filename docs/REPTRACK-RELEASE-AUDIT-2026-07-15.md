# RepTrack release audit — 2026-07-15

Scope: commits `ff29037`, `efc4baa`, and the July 15 release fixes. This is a release-slice audit, not a claim that the full upgrade PRD is complete.

## Requirement matrix

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| R1 | Partial | Execution branch is based on reviewed `origin/main`; canonical dirty worktree remains preserved and its `.backup` file is intentionally untouched. |
| R2 | Implemented | Workouts start/end use the single lifecycle API; production compile passes without warnings after cleanup. |
| R3 | Partial | Tombstones, timestamps, atomic LWW merge, ended tie priority, pull/push and UI hiding implemented. 24-hour pruning and real two-device production exercise remain pending. |
| R4 | Implemented | One local writer in `activeWorkoutSession.js`; consumers use its API. |
| R5 | Implemented | Dedicated `active_sessions` row and atomic RPC; unrelated settings writes cannot carry session state. |
| R6 | Partial | Defensive elapsed-time clamp and Workouts resume card exist; cross-plan confirmation/Today surface pending. |
| R7 | Pending | Pending count, retry action and reconnect/outbox surface not built. |
| R8 | Implemented | Reopen enters edit mode, preserves `remoteId`, updates one session; explicit “Log as new session” action; component regression tests. |
| R9 | Pending | Offline mutation outbox not built. |
| R10 | Pending | Rapid-entry controls and ghost targets not built. |
| R10a | Implemented | Same-weight set-number comparison, positive/negative/neutral states, non-color labels/icons, saved-data replay and tests. |
| R11–R12 | Pending | Annotation model and per-set rest integration remain future work. |
| R13 | Pending | Complete verified `schema_current.sql` and production RLS inventory are not done. |
| R14 | Partial | Additive numbered migration introduced; broader migration discipline remains ongoing. |
| R15–R18 | Pending | Coach-share fix/hardening, export/import and coach-state sync are not in this slice. |
| R19–R22 | Pending | Today, History, PR and weekly-volume features are not in this slice. |
| R23 | Partial | Upstream storage hardening is present; global ErrorBoundary/export fallback pending. |
| R24–R25 | Pending | Error taxonomy and systematic empty-state verification pending. |
| R26–R31 | Pending | Full accessibility/design-system/responsive/PWA/offline-shell work remains future milestones. |
| R32 | Pending | CI/CD and clean-tree deployment gate are not implemented; this release uses the explicitly authorized manual path. |
| R33–R34 | Pending | Diagnostics/observability and update polling remain pending. |
| R35 | Partial | Lifecycle, atomic sync, duplication and feedback regression tests exist; outbox/timer/helper coverage is incomplete. |
| R36 | Partial | Log-modal lifecycle coverage exists; broader Workouts/coach-gating component coverage remains. |
| R37 | Pending | Full two-device, airplane-mode, share-link and update-banner release checklist is not yet automated/documented. |

## QA evidence

- Automated: 7 suites, 37 tests passing.
- Production compile: passes to a temporary `/tmp` build target; no tracked build output touched.
- Data-integrity defect found and fixed: reopening an active-workout exercise now edits the existing session instead of creating a duplicate; a second session requires explicit action.
- Local browser automation: blocked by browser navigation security policy for localhost. Public browser smoke is required after deployment.
- Supabase migration: additive only; creates `active_sessions`, owner RLS policies and authenticated atomic merge RPC.

## Release decision

The implemented slice is releasable after the additive migration applies successfully and the public deployment passes smoke checks. The full PRD is not complete.
