# RepTrack canonical feature-preservation manifest — 2026-07-15

Canonical integration branch: `work/reptrack-canonical-integration`
Canonical integration worktree: `/Volumes/Sanctum/Boman/reptrack-canonical-integration`
Architecture baseline: `3bc73c9` (`080d59d` release integrity + verified corrective affordances)
Behavioral donor: July 2 deployed source recovered from `origin/gh-pages@037d129`
Design contract: `docs/REPTRACK-ACTIVE-UPGRADE-PRD-2026-07-13.md`, Part II

## Integration contract

The July 2 source is behavioral evidence, not a file-replacement baseline. Recovery must preserve the dedicated `active_sessions` JSON lifecycle row, atomic advisory-lock merge RPC, ended tombstones, edit-in-place logging, explicit “Log as new session”, returned `remoteId` persistence, delayed-sync edit preservation, and R10a saved rep feedback from `080d59d`/`3bc73c9`.

No deployment, remote migration application, canonical-main edit, or production workout-data mutation is part of this branch.

## Authoritative feature matrix

| Feature | Evidence | Required preserved behavior | Integration decision | Verification |
|---|---|---|---|---|
| Atomic active-session sync | `efc4baa`, migration `20260715125500_active_sessions.sql` | Newest `updatedAt` wins; ended wins equal-time tie; unrelated settings cannot overwrite lifecycle state | Keep current architecture; completion changes use its single mutation API and push the full JSON session | lifecycle unit/integration suites |
| Duplicate-session prevention | `080d59d`, `3bc73c9` | Reopen current-workout log in edit mode; one session remains; new session requires explicit action | Keep current edit identity and `remoteId`; merge recovered row shape into it | component tests |
| Per-set done controls | July 2 deployed source + June 7/11 records | Meaningful parent sets can be checked; `done` persists on edit; old rows default unchecked; previous-workout template resets checks | Restore with backward-compatible additive fields | helper/component tests + mobile screenshot |
| Explicit exercise completion/progress | July 2 deployed source + June 7 records | Completion follows checked meaningful parent sets and explicit completion IDs; states idle/partial/almost/ready/done; dropset children excluded from full-set count | Store `completedExerciseIds` in active-session JSON through the canonical mutation API | utility tests + active-workout component/source contract |
| Previous-training prefill | July 2 deployed source | If no current-workout log exists, use latest prior session as a template, reset done state, preserve a blank trailing row | Restore without entering edit mode or copying remote/session identity | component test |
| Dropset children | July 2 deployed source + July 2 records | D parent creates two children; weights are rounded 70% then 70%; blank reps; included in totals; excluded from full-set progress | Restore additive `setType`/`dropSetChild`; keep sync payload backward compatible | pure helper tests + component test |
| Stable set identity | July 2 deployed source | `clientSetId`, `setIndex`, and `setFingerprint` survive saves and edits | Restore utilities; preserve identities during normalization | utility/component tests |
| Live cloud coaching | July 2 deployed source + existing additive migration | Start/end cloud workout lifecycle; message reuse/idempotency; feedback tied to exact remote log and set; deterministic local fallback remains | Restore client modules and hook; do not apply migrations or deploy functions | mocked unit/source contract; build |
| Compact workout modal | July 2 deployed CSS/source | Tighter sticky timer, six-column set rows, compact N/D and done controls, side-by-side actions, mobile-safe scrolling | Restore only feature-required compact rules before Gym Floor token redesign | screenshots at 390×844 and 360×800 |
| Immediate rep feedback | `080d59d` | Same-weight improved/regressed/neutral feedback, non-color cue, replay after reopen | Preserve current implementation while enriching row model | existing five-outcome tests |

## Milestone order

1. Behavior-preservation baseline: utilities, set row model, progress/completion state, prefill, dropsets, live-coach wiring, compact modal, regression tests.
2. Exact-snapshot verification: focused tests, full suite, safe `/tmp` production build, diff checks, screenshots, spec review, quality review.
3. Gym Floor graphite design system and core screen redesign only after milestone 1 is green and committed.

## Explicit exclusions

- Upper Body Volume Day and exact plan-order mutations remain product candidates unless Lloyd separately approves their content and mutation policy.
- No production Supabase migration/function application.
- No push, merge, Pages deployment, service restart, or canonical dirty-worktree edit.
