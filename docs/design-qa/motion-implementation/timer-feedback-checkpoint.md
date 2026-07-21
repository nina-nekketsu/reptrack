# P1.3 Rest Timer Feedback Checkpoint

Implemented only the approved rest-timer visual feedback slice. Existing uncommitted P0/P1.1/P1.2/action-guard work and TimerContext behavior were preserved.

## Changed files

- `src/components/SetTimer.motion.test.js` — focused behavioral and CSS contracts for authoritative phase state, stable digits, one live announcement, alert teardown, the finite pseudo-element ring, and reduced motion.
- `src/components/SetTimer.js` — adds the alert ring hook and visible icon/text container while continuing to derive all feedback directly from `timer.isAlert`.
- `src/motion.contract.test.js` — updates the existing reduced-motion critical-feedback contract from the retired box-shadow pulse to the static alert ring/content treatment.
- `src/pages/Exercises.css` — replaces the alert box-shadow pulse with a transform/opacity pseudo-element ring, adds a 170ms paint-only phase transition, and defines immediate static reduced-motion states.
- `docs/design-qa/motion-implementation/timer-feedback-checkpoint.md` — this checkpoint.

## Behavior and safety notes

- TimerContext, timestamp reconstruction, phase transitions, quick-select, reset/start actions, auto-start, sound/haptics, persistence, and announcements were not changed.
- Timer digits remain in the same DOM node across countdown updates, retain tabular-number styling, and have no animation or transition.
- The alert ring is an `::after` pseudo-element. Its keyframes animate only `transform` and `opacity`, run for 600ms exactly 3 times (about 1.8 seconds total), and finish on a visible static ring.
- Alert feedback classes and visible alert content are derived only from `timer.isAlert`; changing phase removes them immediately and cancels the prior CSS animation naturally.
- The existing `timer-phase--pulse` compatibility class remains in markup so the pre-existing SetTimer test is preserved, but it has no CSS rule or animation. The implemented visual hook is `timer-phase--alert-feedback`.
- Reduced motion disables the ring animation and phase transition, removes transform motion, and immediately shows the static ring and alert content.
- No full-screen flash, tick announcement, infinite animation, `transition: all`, layout animation, dependency, schema, configuration, secret, production operation, commit, push, merge, or deployment was added.

## Commands and exact results

1. `CI=true npm test -- --runInBand src/components/SetTimer.motion.test.js src/motion.contract.test.js`
   - RED, exit 1: 2 suites failed; 5 tests failed and 5 passed; 0 snapshots. Expected failures showed the old `timer-phase--pulse` hook, missing pseudo-element ring/keyframes, and missing static reduced-motion ring/content rules.
2. `CI=true npm test -- --runInBand src/components/SetTimer.motion.test.js src/motion.contract.test.js`
   - GREEN, exit 0: 2 suites passed; 10 tests passed; 0 snapshots.
3. `CI=true npm test -- --runInBand src/components/SetTimer.test.js`
   - Exit 1: 1 suite failed; 1 test failed and 4 passed; 0 snapshots. The pre-existing test still required the legacy `timer-phase--pulse` compatibility class. The class was restored without restoring its retired CSS animation.
4. `CI=true npm test -- --runInBand src/components/SetTimer.motion.test.js src/components/SetTimer.test.js src/motion.contract.test.js`
   - Final GREEN, exit 0: 3 suites passed; 15 tests passed; 0 snapshots.
5. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
6. `CI=true npm test -- --runInBand src/context/TimerContext.test.js`
   - Exit 0: 1 suite passed; 3 tests passed; 0 snapshots.
7. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.
