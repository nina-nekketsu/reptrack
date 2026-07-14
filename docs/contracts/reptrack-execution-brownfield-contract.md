# RepTrack PRD Execution Brownfield Contract

**Date:** 2026-07-14
**Canonical PRD:** `docs/REPTRACK-ACTIVE-UPGRADE-PRD-2026-07-13.md`
**Execution branch:** `work/reptrack-prd-execution`
**Execution worktree:** `/Volumes/Sanctum/Hayato/reptrack-prd-execution`

## Purpose

Lock the safety, source-of-truth, data-lifecycle, and UX rules that implementation must preserve while executing the PRD against the existing React/Supabase/localStorage application.

## Source of truth and preservation

1. Implementation starts from fetched `origin/main` commit `131e494`, not the stale local `main` checkout.
2. The original checkout at `/Volumes/Sanctum/Hayato/reptrack-online` remains untouched. Its modified `src/lib/sync.js`, modified `src/pages/Workouts.js`, and untracked `src/pages/ActiveWorkout.js.backup` are Lloyd-owned evidence, not code to apply blindly.
3. The PRD and current-state audit copied into this execution branch are requirements/evidence artifacts.
4. No production deployment, Supabase migration, destructive git operation, or workout-data mutation is authorized by “start executing.” Those remain separately gated.
5. Existing localStorage keys and existing Supabase rows must remain readable throughout additive changes.

## Active-workout lifecycle contract

1. `activeWorkoutSession` remains the localStorage key for compatibility.
2. Every session record has `planId`, `planName`, `startedAt`, `updatedAt`, `status`, `endedAt`, and `deviceId`.
3. `status` is `active` or `ended`. Ending creates an `ended` tombstone; it does not represent completion by deleting the record immediately.
4. Merge is newest-`updatedAt` wins. When timestamps tie, `ended` wins over `active` so an older/ambiguous active state cannot resurrect a completed workout.
5. UI treats anything except `status: active` as no active workout.
6. All reads/writes flow through one active-session module/API. Pages must not write the key directly.
7. Unrelated settings writes must not overwrite active-session state.
8. A remote or cross-device implementation must be additive and migration-safe; production schema work remains gated until separately approved.

## Exercise-session integrity contract

1. Reopening an exercise already logged in the current workout edits that session; it does not create a duplicate.
2. A remotely inserted session retains its `remoteId` locally so later edits update rather than reinsert it.
3. Offline failures must preserve local data and later retry idempotently.

## Immediate set feedback contract (R10a)

1. Compare the confirmed current set with the same set number from the most recent previous completed session for the same exercise.
2. Compare reps only when current and previous weights are exactly equal after numeric normalization.
3. Same weight + more reps = improved/green.
4. Same weight + fewer reps = regressed/red.
5. Same weight + same reps = neutral.
6. Any weight increase or decrease = neutral, regardless of reps.
7. Missing corresponding previous set or incomplete/non-numeric data = neutral.
8. Feedback appears only after set confirmation/save and is reproducible when reopening saved data.
9. Color is not the only signal: render an icon/text/accessible label.

## Design execution rules

1. Correctness work R1–R5 and R8 precedes design work that depends on session state.
2. Design changes use the PRD’s Chalk & Signal tokens and required component states.
3. No functional emoji remains as the final icon system.
4. Touch targets, keyboard behavior, reduced motion, contrast, and safe areas are release gates, not polish.
5. No fake dashboard/history/progress data may survive the relevant implementation phase.

## Verification contract

Each executable slice requires:

1. A failing test observed before production code.
2. The focused test passing after the minimal implementation.
3. Full Jest suite passing.
4. Production build passing.
5. For UI slices, browser smoke testing and screenshots at the required viewport(s).
6. Spec-compliance review before code-quality review.
7. No deployment until Lloyd explicitly approves the exact release action.
