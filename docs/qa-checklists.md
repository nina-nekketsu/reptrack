# RepTrack Release QA Checklists

Run these gates before every production release. Record the release commit, build ID, tester, device/browser, and pass/fail evidence in the release notes.

## Automated Gates

- [ ] `git status --short` is empty before deploy.
- [ ] `git rev-parse HEAD` matches `public/build-info.json` `commit`.
- [ ] `git merge-base --is-ancestor HEAD origin/main` exits 0.
- [ ] `npm run test:prd` passes.
- [ ] `CI=true npm test -- --runInBand --watchAll=false` passes.
- [ ] `npm run build` completes without warnings.
- [ ] `node scripts/validate-build-metadata.js --require-origin-main` passes after the production build.
- [ ] `git diff --check` passes.

## Two-Device Session Lifecycle

- [ ] Sign in on desktop and phone with the same account.
- [ ] Start an active workout on desktop and add at least two exercises.
- [ ] Open the workout on phone and verify the active session resumes with the same sets.
- [ ] Add a set on phone, refresh desktop, and verify the set appears once.
- [ ] Finish the workout on phone and verify desktop leaves the active-session state.

## Offline And Sync

- [ ] Start a workout online and add one set.
- [ ] Enable airplane mode, add two more sets, edit one set, and delete one set.
- [ ] Confirm the queue indicator shows pending local work.
- [ ] Disable airplane mode and wait for sync to complete.
- [ ] Refresh and verify the final workout state matches the offline edits.

## Sharing

- [ ] Generate a coach share link from a real workout.
- [ ] Open the link in a signed-out browser profile.
- [ ] Verify workout summary, exercises, sets, and notes render without exposing owner controls.
- [ ] Rotate or revoke the share key and verify the old link no longer opens private data.

## Update Banner And Cache

- [ ] Build and serve a local production bundle.
- [ ] Load the app, then replace `build-info.json` with a newer `buildId`.
- [ ] Verify the update banner appears and reloads into the new build.
- [ ] With the service worker installed, disable the network and verify the cached app shell opens.
- [ ] Re-enable the network and verify `build-info.json` is fetched network-first.

## Diagnostics

- [ ] Trigger a handled sync failure and one runtime error in a test account.
- [ ] Open Profile diagnostics and verify build ID, queue depth, last sync, failure counts, and recent errors appear.
- [ ] Confirm diagnostics show redacted local support data only: no workout payloads, tokens, passwords, email addresses, or stacks.
- [ ] Click refresh and verify diagnostics update without sending data to third-party telemetry.

## Responsive And Accessibility

- [ ] Smoke test Dashboard, Active Workout, Exercise Log, History, Progress, Workouts, Exercises, Coach, and Profile at 320x568, 390x844, 768x1024, and desktop.
- [ ] Verify primary actions are reachable by keyboard and visible focus states are present.
- [ ] Run browser accessibility checks on the main flows and record any exceptions.
- [ ] Verify text does not overlap, truncate critical labels, or occlude controls.

## Rollback Drill

- [ ] Identify the previous production commit and build ID.
- [ ] Confirm the previous bundle can be rebuilt from a clean checkout.
- [ ] Verify the service-worker kill switch path clears RepTrack caches.
- [ ] Document the rollback command sequence without executing it during normal QA.
