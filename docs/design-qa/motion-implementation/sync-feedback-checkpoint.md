# P2.3 Truthful Sync Feedback Checkpoint

Date: 2026-07-20

## Scope completed

Implemented only the approved P2.3 visual feedback for the existing truthful sync states:

- `src/components/SyncIndicator.js` — preserves the authoritative snapshot/online-state mapping while adding a visual-only cue when the derived state actually changes.
- `src/components/SyncIndicator.css` — adds a bounded 160ms icon opacity/scale cue, 120ms color/background/border transitions, and immediate static reduced-motion endpoints.
- `src/components/SyncIndicator.test.js` — adds focused state-change, live-region stability, immediate retry, finite CSS, and reduced-motion coverage.
- `docs/design-qa/motion-implementation/sync-feedback-checkpoint.md` — this checkpoint.

## Audit and truthfulness notes

- `SyncIndicator` has one application caller in `src/App.js`, inside the authenticated/configured application shell. No caller behavior changed.
- The existing authoritative inputs remain `getSyncSnapshot()`, `onSyncSnapshotChange()`, and `navigator.onLine` plus online/offline events.
- Presentation precedence remains unchanged: offline, authentication error, sync error, syncing, pending, previously synced, then not-yet-synced.
- `lastSuccessfulSyncAt` remains the only path to the `Synced` label. Pending local work, a local-save acknowledgement, or an ordinary idle snapshot cannot claim cloud success.
- The separate `Saved on this device` acknowledgement in `ExerciseLogModal` remains local-only and was not changed.
- Offline remains a readable labeled pill and continues to override transport states without implying successful cloud sync.
- Error retry continues to synchronously retry each retained failed operation once per click and starts the existing single-flight flush immediately. No timeout, animation completion handler, duplicate visual callback, disabled period, or network/state-machine change was added.
- Reconnect behavior, network-failure classification, automatic flush behavior, auth-expired handling, pending mutation storage, and all sync library code remain unchanged.

## Motion and accessibility behavior

- The live-region container remains mounted across ordinary rerenders and authoritative state changes. Only its decorative `aria-hidden` icon subtree is replaced when the derived state changes, so visual animation does not remount the announcement region.
- An ordinary rerender with the same derived state keeps the same icon node and does not restart feedback.
- A real derived-state change gets one 160ms opacity/scale entry cue. The animation has one iteration, uses only composited opacity/transform properties, and settles to a static final state.
- Text changes remain immediate; inherited foreground color plus pill background and border color transition over the existing 120ms fast token.
- Syncing uses the same single finite cue and then stays static. There is no spinner, rotation, pulse loop, or infinite animation.
- Reduced motion removes both the icon animation and color transitions, with explicit final opacity and transform values.
- Existing `status`/`alert` roles, labels, titles, and retry button semantics remain unchanged.

## RED → GREEN evidence

1. `CI=true npm test -- --runInBand src/components/SyncIndicator.test.js`
   - RED, exit 1: 1 suite failed; 4 tests failed and 7 passed.
   - Intended failures covered the missing state-change icon remount/cue, missing bounded CSS feedback, and missing reduced-motion rules.
   - The initial retry assertion also counted the component's existing mount-time flush; the test setup was corrected to clear that pre-existing call before asserting one immediate flush for one click.
2. `CI=true npm test -- --runInBand src/components/SyncIndicator.test.js`
   - GREEN, exit 0: 1 suite passed; 11 tests passed; 0 snapshots.

## Regression and static verification

3. `CI=true npm test -- --runInBand src/components/SyncIndicator.test.js src/components/ExerciseLogModal.setFeedback.test.js src/App.routes.test.js src/lib/sync.exerciseOutbox.test.js src/lib/sync.fullOutbox.test.js src/lib/sync.pushAllStatus.test.js src/lib/sync.storageBlocked.test.js src/lib/mutationOutbox.test.js src/lib/coachStateSync.test.js src/lib/activeWorkoutSession.test.js src/lib/activeWorkoutSession.integration.test.js src/lib/activeWorkoutSessionSync.test.js src/lib/activeWorkoutSessionSync.integration.test.js src/pages/Workouts.sessionConflict.test.js src/motion.contract.test.js`
   - Exit 0: 15 suites passed; 83 tests passed; 0 snapshots.
4. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
5. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.

No dependency, schema, configuration, secret, production operation, commit, push, merge, deploy, layout animation, `transition: all`, or infinite animation was added. Existing uncommitted work was preserved.
