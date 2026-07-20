# P2.1 Shared Overlay Motion Checkpoint

Date: 2026-07-20

## Scope completed

Implemented only the shared Dialog, Sheet, and Toast motion lifecycle:

- `src/components/ui/ui.css` — shared Dialog backdrop and panel entry motion plus reduced-motion final states.
- `src/components/Sheet.css` — Sheet-specific backdrop and panel timing overrides plus reduced-motion final states.
- `src/components/Toast.js` — controlled semantic visibility with a bounded visual-only exit mount.
- `src/components/ExerciseLogModal.js` — keeps the shared Toast mounted as a controlled primitive while the existing `undoRemoval` state remains authoritative.
- `src/pages/Exercises.css` — Toast enter/exit motion and static reduced-motion endpoints.
- `src/pages/ActiveWorkout.css` — removed the legacy end-dialog backdrop animation so the shared Dialog timing applies; the existing completion-check treatment remains unchanged.
- `src/components/OverlayMotion.test.js` — focused shared overlay behavior, timing, announcement, and reduced-motion coverage.
- `src/components/ExerciseLogModal.setFeedback.test.js` — updated the existing Undo CSS contract for the P2.1 enter/exit lifecycle.
- `docs/design-qa/motion-implementation/overlay-motion-checkpoint.md` — this checkpoint.

## Behavior and safety notes

- Dialog backdrop opacity enters over 160ms. The panel enters over 180ms with opacity and `translateY(6px)`.
- Dialog rendering, focus trap, body lock, Escape dismissal, backdrop dismissal, callbacks, and focus restoration remain controlled by the existing synchronous Dialog lifecycle. No close callback waits for visual completion.
- Sheet backdrop opacity enters over 180ms. The panel enters over 240ms from the existing sheet motion distance token.
- Sheet swipe-to-dismiss thresholds and handlers were not changed. Focus trap/restoration, body lock, panel sizing, safe-area treatment, viewport units, scroll behavior, and destructive parent callback ordering remain unchanged.
- Toast enters over 180ms with opacity and an 8px vertical settle. On semantic expiry, its live region and Undo button disappear immediately while an `aria-hidden`, non-interactive visual copy fades for at most 140ms.
- The existing `undoRemoval` state and four-second timeout remain authoritative. The mounted exit wrapper does not extend Undo availability or delay `undoRemoveSet`.
- Invoking Undo calls the mutation callback immediately. Exit content is suppressed for that action path so the existing immediate removal semantics remain intact.
- The Toast has only one live region while open and no live region during exit, preventing duplicate announcements.
- Reduced motion disables Dialog, Sheet, and Toast animations. Dialog and Sheet render at stable final states; Toast exit cleanup uses a zero-delay bounded task and cannot remain mounted indefinitely.
- No animation completion events, long stagger, infinite animation, `transition: all`, geometry changes, tap-target changes, dependencies, schema/config changes, secrets, production actions, commits, pushes, merges, or deployments were added.
- Existing uncommitted P0/P1 work was retained.

## RED → GREEN evidence

1. `CI=true npm test -- --runInBand src/components/OverlayMotion.test.js`
   - RED, exit 1: 1 suite failed; 6 tests failed and 2 passed. Failures covered missing Dialog/Sheet CSS motion, missing Toast controlled exit semantics, missing bounded cleanup, and missing reduced-motion endpoints.
2. `CI=true npm test -- --runInBand src/components/OverlayMotion.test.js`
   - GREEN, exit 0: 1 suite passed; 8 tests passed.
3. The focused suite was then extended with reduced-motion exit cleanup coverage; it remains green in the final regression run below.

## Regression and static verification

4. `CI=true npm test -- --runInBand src/components/OverlayMotion.test.js src/accessibility.dialogs.test.js src/components/p2Features.test.js src/components/WorkoutSummary.motion.test.js src/pages/Workouts.sessionConflict.test.js src/components/SetTimer.test.js src/components/SetTimer.motion.test.js src/components/ExerciseLogModal.activeWorkout.test.js src/components/ExerciseLogModal.setFeedback.test.js`
   - Initial regression run: 8 suites passed and 1 failed; 52 tests passed and 1 failed. The sole failure was the older P1.2 static Toast selector expectation. It was updated to assert the approved P2.1 enter/exit classes and immediate reduced-motion endpoints.
5. `CI=true npm test -- --runInBand src/components/OverlayMotion.test.js src/accessibility.dialogs.test.js src/components/p2Features.test.js src/components/WorkoutSummary.motion.test.js src/pages/ActiveWorkout.preservation.test.js src/pages/Workouts.sessionConflict.test.js src/components/SetTimer.test.js src/components/SetTimer.motion.test.js src/components/ExerciseLogModal.activeWorkout.test.js src/components/ExerciseLogModal.setFeedback.test.js src/motion.contract.test.js`
   - Final, exit 0: 11 suites passed; 68 tests passed; 0 snapshots.
6. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
7. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.
