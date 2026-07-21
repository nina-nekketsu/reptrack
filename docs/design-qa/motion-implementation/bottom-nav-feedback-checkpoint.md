# P1.4 Bottom-Navigation Feedback Checkpoint

Implemented only the approved bottom-navigation selection and finite active-workout feedback slice. All pre-existing uncommitted motion-system work was preserved.

## Changed files

- `src/components/BottomNav.motion.test.js` — focused behavior, accessibility, finite-motion, reduced-motion, rapid-route, storage-event, and 320px geometry contracts.
- `src/components/BottomNav.js` — tracks inactive-to-active transitions during the mounted session while leaving route navigation and stored active-workout state authoritative and immediate.
- `src/components/BottomNav.css` — adds finite selected-indicator/icon feedback, a static ordinary active-workout dot, the two-cycle newly-active cue, and component-specific reduced-motion final states.
- `docs/design-qa/motion-implementation/bottom-nav-feedback-checkpoint.md` — this checkpoint.

## Behavior and safety notes

- `NavLink` remains the route source of truth and retains `aria-current="page"`. There is no transition queue or delayed navigation; rapid route changes settle on the latest route.
- Existing `storage`, `exerciseLogged`, and `activeWorkoutSessionChanged` listeners still synchronously re-read current local state. No active-workout persistence, event, schema, or route logic changed.
- A workout already active when `BottomNav` mounts renders a static dot and does not replay a cue.
- Only an observed `inactive → active` transition during the mounted session adds `nav-active-dot--new`. Its CSS animation runs for 350ms exactly twice, while a 700ms visual-only timeout removes the cue class and leaves the authoritative active dot present and static.
- Ending the workout removes the dot immediately. A later inactive-to-active transition receives a new finite cue; ordinary rerenders and route changes do not replay it.
- The active-workout wording now appears once in the Workouts link accessible name. Both the selected indicator and active dot are decorative and `aria-hidden="true"`.
- Existing tab geometry remains unchanged: 64px minimum width, 56px minimum height, 112px maximum width, and the existing under-359px label treatment remain in place for the 320px floor.
- Selected color changes use the 120ms fast token. Indicator opacity/`scaleX(.35 → 1)` and the optional 1px icon settle use the 160ms control token.
- Reduced motion removes color/indicator transitions, scale, translation, and pulse while preserving immediate selected color/indicator state and a static active dot.
- No infinite animation, `transition: all`, dependency, configuration, schema, secret, production operation, commit, push, merge, or deployment was added.

## Commands and exact results

1. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js`
   - Initial harness attempt exited 1 before tests because CRA/Jest 27 could not resolve the React Router 7 `react-router/dom` package export. The focused test was changed to use a local test-only router mock; application dependencies and configuration were not changed.
2. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js`
   - RED, exit 1: 1 suite failed; 5 tests failed and 1 characterization test passed. Expected failures showed the missing static-on-mount semantics, transition-only cue class, accessible decorative dot treatment, selected-indicator motion, exact two-cycle cue, and reduced-motion rules.
3. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js`
   - Intermediate implementation run, exit 1: all 4 behavior tests passed; 2 CSS tests failed only because the test helper expected spaces after CSS colons. The helper was normalized without weakening the asserted values.
4. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js`
   - GREEN, exit 0: 1 suite passed; 6 tests passed; 0 snapshots.
5. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js src/gymFloor.contract.test.js src/pages/ActiveWorkout.preservation.test.js src/motion.contract.test.js`
   - Exit 0: 4 suites passed; 21 tests passed; 0 snapshots.
6. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
7. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.
8. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js`
   - Final focused run after adding the 320px preservation characterization, exit 0: 1 suite passed; 7 tests passed; 0 snapshots.
9. `CI=true npm test -- --runInBand src/components/BottomNav.motion.test.js src/gymFloor.contract.test.js src/pages/ActiveWorkout.preservation.test.js src/motion.contract.test.js`
   - Final regression run, exit 0: 4 suites passed; 22 tests passed; 0 snapshots.
10. `npm run lint`
    - Final exit 0: ESLint completed with no warnings or errors.
11. `git diff --check`
    - Final exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.
