# P2.2 Loading and Retry Feedback Checkpoint

Date: 2026-07-20

## Scope completed

Finished only the already-started P2.2 loading, error, busy, and retry feedback work while preserving the existing P0/P1/P2 implementation:

- `src/components/ErrorBoundary.js` — applies the shared finite error-entry feedback class to the existing recovery card without changing its alert, focus, reload, or retry behavior.
- `src/pages/CoachView.js` — exposes the existing real loading copy as a status and the existing error card as an alert, with the shared loading/error feedback classes. Fetch behavior is unchanged.
- `src/pages/Profile.js` — uses explicit `Syncing…` and `Saving…` labels plus `aria-busy` on the existing disabled controls while their authoritative operations are pending.
- `src/pages/Profile.loadingFeedback.test.js` — waits for the existing coach-share load to settle so the test observes the real async update without an `act` warning.
- `src/App.css` — adds one-iteration opacity loading feedback, one-iteration opacity/`translateY(4px)` error feedback, stable endpoints, and static reduced-motion overrides.
- `src/press-feedback.css` — keeps the existing approved press target contract intact and makes the sync retry and error-boundary retry controls explicitly static under reduced motion.
- `src/components/SyncIndicator.js` — completes the already-covered retry busy state with an immediate synchronous duplicate guard, disabled/`aria-busy` semantics, and `Retrying…` copy while the existing flush promise is pending. Retry and flush operations still start immediately and run once per action.

`AuthScreen` production behavior was left unchanged. Its existing synchronous `pendingActionRef` duplicate guard, action-specific labels, immediate invocation, and disabled behavior remain intact.

## Behavior and motion constraints

- No timeout, artificial delay, fake pending state, animation callback, or fetch/retry sequencing change was added.
- Loading feedback animates only opacity.
- Error feedback animates only opacity and a 4px vertical transform.
- Both animations are finite, run once, and settle at stable endpoints.
- Reduced motion removes loading/error animation and retry transforms with explicit static endpoints.
- No infinite animation or `transition: all` was added.

## RED → GREEN evidence

1. `CI=true npm test -- --runInBand src/components/AuthScreen.loadingFeedback.test.js src/pages/CoachView.loadingFeedback.test.js src/pages/Profile.loadingFeedback.test.js src/loadingRetryFeedback.test.js src/components/ErrorBoundary.test.js`
   - Initial RED, exit 1: the AuthScreen suite passed; six tests failed across ErrorBoundary, CoachView, Profile, and the CSS contract.
   - Final GREEN, exit 0: 5 suites passed; 13 tests passed; 0 snapshots.

2. Related AuthScreen, Profile, CoachView, ErrorBoundary, SyncIndicator, and sync-library regression command:
   - First run, exit 1: 12 suites passed and 1 suite failed; 45 tests passed and 1 failed. The existing SyncIndicator retry-busy test exposed the missing pending state.
   - After the minimal retry-busy completion, exit 0: 13 suites passed; 46 tests passed; 0 snapshots.

3. `CI=true npm test -- --runInBand src/components/SyncIndicator.test.js`
   - Exit 0: 1 suite passed; 11 tests passed; 0 snapshots.

4. Additional motion, press-feedback, routing, mutation-outbox, active-workout-session, and workout-conflict regressions:
   - An initial run caught that adding retry selectors to the established unified press selector changed the exact P1 contract: 6 suites passed, 1 failed; 46 tests passed, 3 failed.
   - The retry reduced-motion override was separated from the approved P1 selector group.
   - Final exit 0: 7 suites passed; 49 tests passed; 0 snapshots.

5. `CI=true npm test -- --runInBand src/pressFeedback.contract.test.js src/loadingRetryFeedback.test.js`
   - Exit 0: 2 suites passed; 7 tests passed; 0 snapshots.

6. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.

7. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect results.

No dependency, schema, configuration, secret, production-data, commit, push, merge, or deploy operation was performed. Existing uncommitted work was preserved.
