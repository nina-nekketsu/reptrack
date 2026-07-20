# P1.6 Workout End and Summary Handoff Checkpoint

Implemented only the approved guarded workout-completion and summary handoff slice. Existing uncommitted motion-system work was preserved, including the synchronous `endingRef` guard and the local ended-tombstone-before-summary ordering.

## Changed files

- `src/components/WorkoutSummary.motion.test.js` — focused behavior, accessibility, finite-motion, reduced-motion, and no-delayed-interaction contracts.
- `src/components/WorkoutSummary.js` — moves the already-present summary content into the shared `Dialog`, adds an accessible completion check, and initially focuses the immediate Done action.
- `src/components/CoachComponents.css` — adds the finite backdrop, panel, check, and stat reveal treatments plus explicit reduced-motion final states.
- `src/pages/ActiveWorkout.preservation.test.js` — strengthens preservation coverage for the one end mutation, synchronous guard, local tombstone ordering, remote push ordering, immediate summary close, and unchanged navigation timing.
- `docs/design-qa/motion-implementation/workout-summary-checkpoint.md` — this checkpoint.

## Behavior and safety notes

- `ActiveWorkout.js` was not changed. The existing same-frame `endingRef` claim, one `endCoachWorkout` call, local `saveActiveWorkoutSession({ action: 'end' })` tombstone, non-blocking remote push, summary state, fallback end path, and `/workouts` navigation remain in their existing order.
- The summary's heading, description, stats, Share action, and Done action are rendered immediately. No content or close behavior depends on animation completion.
- The shared `Dialog` continues to provide dialog semantics, body scroll lock, focus trapping, Escape dismissal, backdrop dismissal, and focus restoration. Initial focus is explicitly placed on Done.
- Escape closes immediately. The component and parent close handlers contain no timeout, `animationend`, or `transitionend` choreography.
- Motion is simultaneous and finite: backdrop opacity is 180ms; panel opacity plus `translateY(8px)` is 220ms; completion-check opacity plus scale is 260ms; stats use one 220ms fade/settle. No delays or long stagger were added.
- Reduced motion disables all four animations and renders backdrop, panel, check, and stats at stable opacity with `transform: none`.
- The existing workout-summary haptic behavior was left unchanged. No mutation, persistence, sync, route, schema, dependency, configuration, secret, production, commit, push, merge, or deployment work was performed.

## RED → GREEN evidence

1. `CI=true npm test -- --runInBand src/components/WorkoutSummary.motion.test.js src/pages/ActiveWorkout.preservation.test.js`
   - RED, exit 1: the new summary suite had 4 expected failures for missing dialog semantics/focus, Escape handling, finite P1.6 CSS, and reduced-motion final states. The strengthened ActiveWorkout preservation suite passed. Overall: 1 suite failed, 1 passed; 4 tests failed, 8 passed.
2. `CI=true npm test -- --runInBand src/components/WorkoutSummary.motion.test.js src/pages/ActiveWorkout.preservation.test.js`
   - GREEN, exit 0: 2 suites passed; 12 tests passed; 0 snapshots.

## Regression and static verification

3. `CI=true npm test -- --runInBand src/components/WorkoutSummary.motion.test.js src/components/p2Features.test.js src/pages/ActiveWorkout.preservation.test.js src/lib/activeWorkoutSession.test.js src/lib/activeWorkoutSessionSync.test.js src/accessibility.dialogs.test.js src/motion.contract.test.js`
   - Exit 0: 7 suites passed; 43 tests passed; 0 snapshots.
4. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
5. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.
