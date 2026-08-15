# RepTrack — Live Log Sheet Placement and First-Unfinished-Set Positioning PRD

**Status:** Approved for implementation and immediate production release
**Date:** 2026-08-15
**Canonical implementation workspace:** `/Users/poverty/Coding/reptrack-live-log-sheet-position-20260815`
**Feature branch:** `fix/live-log-sheet-expanded-position`

## 1. Product outcome

When the user presses **Log** for an exercise from the exercise overview during an active workout, RepTrack must open one enlarged logging sheet and immediately position its scrollable set list at the first unfinished prescribed set. This includes set 1 when the exercise has no progress in the current live session.

## 2. User problems

### 2.1 Sheet geometry
The live-training logging popup previously opened content-sized and too low, requiring unnecessary dragging and reducing visible set content.

### 2.2 Zero-progress set positioning
When an exercise has not yet been logged in the current active workout, opening **Log** does not reliably position the list at the first set containing the first unfinished `0` state. The existing partial-progress behavior correctly advances to the next unfinished set and must not regress.

## 3. Required behavior

1. **One popup only.** Reuse the existing exercise logging popup; do not add a second modal, nested popup, or replacement screen.
2. **Expanded immediately.** In the live-training overview flow, the popup opens at `height: min(92dvh, 720px)` and is vertically positioned within the viewport without a drag.
3. **First unfinished set is the anchor.** On every exercise open or exercise switch:
   - zero current-session progress → set 1 is the anchor;
   - partial current-session progress → the next unfinished primary set is the anchor;
   - completed planned work → preserve the established completed-row fallback.
4. **Visible positioning, not input focus.** Position the scroll container only. Do not focus a reps/weight input, move keyboard focus, or open the mobile keyboard.
5. **One positioning action per open/switch.** Manual edits and user scrolling must not repeatedly snap the list back.
6. **Reduced motion.** Use immediate/automatic positioning when reduced motion is requested; otherwise the existing smooth behavior may remain only where it is reliable.
7. **Scope.** The taller sheet applies only to the active-workout overview Log flow. Other uses of `ExerciseLogModal` retain their existing geometry.

## 4. State and edge cases

- A prescribed but untouched row with blank internal values or a displayed zero is an unfinished actionable primary set.
- Warm-up rows and dropset children do not replace the primary-set anchor.
- Automatic trailing placeholders are not preferred over an unfinished prescribed/meaningful primary row.
- Switching from an exercise scrolled to a later set to a zero-progress exercise must reset the list to set 1; it must not retain the previous exercise’s scroll offset.
- Reopening the same exercise after saving some sets positions at the next unfinished set.
- The popup’s sticky timer/header must not cover the anchored set.
- Existing save, completion, target-count, session-resume, timer, and persistence behavior must remain unchanged.

## 5. Acceptance criteria

1. At a mobile viewport of **390×844**, opening **Log** for a live-workout exercise renders one sheet at 720 px high with its top edge inside the viewport and no document/modal horizontal overflow.
2. Given a prescribed exercise with no current-session log and at least three sets, opening **Log** marks set 1 as the anchor and positions the scroll body so set 1 is the first intended set visible beneath the sticky header.
3. Given another exercise was previously open and its set list was scrolled down, switching to the untouched exercise resets the new exercise list to set 1.
4. Given sets 1 and 2 are complete and set 3 is unfinished, reopening **Log** anchors set 3 while preserving the existing completed-context behavior when it fits.
5. Given all planned sets are complete, the established last-completed-primary-row fallback still applies.
6. Opening/switching does not focus an input and does not trigger the software keyboard.
7. Editing values after opening does not invoke another automatic positioning action.
8. Reduced-motion users receive non-animated positioning.
9. Non-live-training modal contexts do not receive the live-training height class.
10. Focused regression tests, the full test suite, lint, production build, repository PRD/schema gates, static mobile QA, and browser QA pass.
11. Production is not considered complete until the deployed build identifier matches the released commit and the live route is exercised at the target mobile viewport.

## 6. TDD requirements

The sole implementer must:

1. Add a regression test for the zero-progress/switch-from-scrolled-exercise case.
2. Run it before production changes and capture an expected RED failure caused by the defect.
3. Implement the smallest correction.
4. Prove GREEN with the focused positioning tests.
5. Run nearby tests, then the full quality/release gates.

Tests written only after the implementation do not satisfy this PRD.

## 7. Agent roles and ownership

### Boman — PRD owner, coordinator, integrator, and release owner
- Owns this canonical PRD and requirement interpretation.
- Maintains one-writer file ownership and prevents duplicate implementations.
- Integrates the verified candidate, pushes the branch, opens/reuses the PR, monitors CI, merges, deploys, and verifies the exact production build.
- Does not override a blocking independent QA verdict without Lloyd’s explicit instruction.

### Codex implementation agent — sole code owner
- Works only in `/Users/poverty/Coding/reptrack-live-log-sheet-position-20260815` on `fix/live-log-sheet-expanded-position`.
- Preserves the already committed expanded-sheet change at `59aa6a8`.
- Reproduces the zero-progress defect with strict RED→GREEN TDD, implements the smallest fix, updates focused evidence, and commits locally.
- Reports commit SHA, changed files, RED/GREEN commands, and all test results.
- Must not push, merge, deploy, or edit another worktree.

### Static — visual/product reviewer
- Performs read-only review of the frozen candidate and mobile evidence.
- Confirms popup geometry, first-set visibility, sticky-header clearance, overflow, touch usability, and consistency with the existing RepTrack design system.
- Returns PASS or specific blocking visual findings; does not implement.

### Lektor — independent final QA gate
- Reviews the frozen release candidate after implementation and Static review.
- Independently checks the complete PRD, regression tests, behavior matrix, accessibility/focus behavior, build/CI readiness, and release evidence.
- Returns `LEKTOR QA VERDICT: PASS` or blocking findings with reproduction steps.
- Any blocking finding must be fixed, re-tested, and re-reviewed against a new frozen SHA before release.
- Does not implement, merge, or deploy.

## 8. Release plan

1. Freeze the implementation commit and verify the worktree scope.
2. Obtain Static visual PASS.
3. Obtain `LEKTOR QA VERDICT: PASS` for the exact frozen SHA.
4. Rebase/cherry-pick onto current `origin/main` if main moved; rerun all gates and repeat reviews for any replacement SHA.
5. Push the reviewed branch, open/reuse a PR, and verify hosted CI is attached to the exact head SHA.
6. Merge only the reviewed SHA after CI passes.
7. Monitor the production deployment to success.
8. Confirm production build metadata equals the released commit and exercise the live workflow at 390×844.

## 9. Out of scope

- Redesigning the logging interface.
- Adding another popup or full-screen route.
- Changing set-completion semantics, prescribed target counts, persistence, or sync behavior.
- Autofocusing inputs or intentionally opening the mobile keyboard.
- Broad modal geometry changes outside the live-training overview flow.
