# RepTrack Release QA Checklists

Run these gates from the repository root on the exact release candidate SHA. Store command output and screenshots in a release-specific evidence folder such as `docs/release-evidence/<sha>/` only when the evidence was actually generated.

## Automated Source And Build Gates

- [ ] `git rev-parse HEAD`
- [ ] `git status --short`
- [ ] `npm run qa:matrix`
- [ ] `npm run qa:release-contracts`
- [ ] `npm run test:prd`
- [ ] `npm run lint`
- [ ] `CI=true npm test -- --runInBand --watchAll=false`
- [ ] `npm run build`
- [ ] `node scripts/validate-build-metadata.js`
- [ ] `git diff --check`

For a production deployment candidate after Lloyd approves the exact target action, also run:

- [ ] `git fetch origin main`
- [ ] `node scripts/check-clean.js`
- [ ] `node scripts/validate-build-metadata.js --require-origin-main`
- [ ] `curl -fsSL https://nina-nekketsu.github.io/reptrack/build-info.json`

The production `curl` output must show a `commit` equal to the approved SHA and a `buildId` equal to the first eight characters of that commit.

## Route And Viewport Matrix

Generate the canonical route/viewport definition:

```sh
npm run qa:matrix
```

Execute browser evidence for every primary route at these viewports:

- Portrait: `320x568`, `360x800`, `390x844`, `420x900`, `428x926`
- Landscape: `568x320`, `844x390`, `926x428`
- Routes: `/today`, `/workouts`, `/workout/:planId`, `/exercises`, `/history`, `/progress`, `/coach`, `/coach/settings`, `/coach/:token`, `/profile`

Evidence must include signed-out and authenticated real-data states where the matrix marks the route as authenticated. Do not mark this gate complete from the source contract alone; the source contract only proves the matrix exists and the routes are registered.

## Keyboard And Accessibility Smoke

Run keyboard walkthrough and axe/browser checks for:

- Workouts at `/workouts`
- ActiveWorkout at `/workout/:planId`
- ExerciseLogModal opened from `/workout/:planId`
- Profile at `/profile`

Record the browser, viewport, route, account state, pass/fail result, and any exception. This project currently has no dependency-free axe runner; this section is manual/browser evidence until such a runner is added.

## Two-Device Session Lifecycle

- [ ] Sign in on two real devices with the same test account.
- [ ] Device A starts a workout, logs sets, and ends it. Device B syncs and shows no active session.
- [ ] Device B goes offline mid-session. Device A ends the workout. Device B reconnects and converges to ended without resurrecting the session.
- [ ] Device A ends offline, later reconnects, and both devices converge to ended.
- [ ] Timer state and coach-state convergence are checked during the same run.

Record device names, browsers, account identifier redacted to a stable alias, timestamps, and screenshots. Do not store credentials, tokens, workout payload JSON, or secrets.

## Offline And Sync

- [ ] Start a workout online and add one set.
- [ ] Enable airplane mode, add two sets, edit one set, and delete one set.
- [ ] Confirm the queue indicator shows pending local work.
- [ ] Disable airplane mode and wait for sync to complete.
- [ ] Refresh and verify final workout state matches the offline edits.

Also capture reconnect/login/manual flush behavior for log, exercise, plan, settings, and coach-state mutations when those flows are included in the release scope.

## Sharing

- [ ] Generate a coach share link from a real workout.
- [ ] Open the link in a signed-out browser profile.
- [ ] Verify workout summary, exercises, sets, notes, and freshness line render without owner controls.
- [ ] Rotate or revoke the share key and verify the old link no longer opens private data.

Applying or rotating production share-key SQL is approval-gated. Capture only redacted tokens or aliases in evidence.

## PWA Update And Cache

The source contract is executable:

```sh
npm run qa:release-contracts
```

Manual/browser evidence still required:

- [ ] Build and serve the production bundle under `/reptrack/`.
- [ ] Load the app with the service worker installed.
- [ ] Replace `build-info.json` with a newer `buildId` and verify the update banner appears.
- [ ] Activate the waiting update through the banner and verify the new build loads.
- [ ] Disable network and verify cached app shell cold-starts.
- [ ] Re-enable network and verify `build-info.json` is fetched network-first.
- [ ] Confirm iOS Safari and Android Chrome install/update/haptic behavior on real devices.

## Diagnostics

Executable source contract:

```sh
npm run qa:release-contracts
```

Manual/browser evidence:

- [ ] Trigger a handled sync failure and one runtime error in a test account.
- [ ] Open Profile diagnostics and verify build ID, queue depth, last sync, failure counts, and recent errors appear.
- [ ] Confirm diagnostics show sanitized local support data only: no workout payloads, tokens, passwords, email addresses, stacks, or authorization headers.
- [ ] Click refresh and verify diagnostics update without sending data to third-party telemetry.

## Rollback Drill

- [ ] Identify the previous production commit and build ID.
- [ ] Confirm the previous bundle can be rebuilt from a clean checkout.
- [ ] Verify the service-worker kill switch path is documented in `docs/operations/pwa-update-lifecycle.md`.
- [ ] Document the rollback command sequence without executing it during normal QA.

Template command sequence to review with Lloyd before use:

```sh
git fetch origin main gh-pages
git rev-parse HEAD
git status --short
npm run build
node scripts/validate-build-metadata.js --require-origin-main
npm run deploy
```

Do not run deployment or rollback commands that push or alter production until Lloyd approves the exact SHA, target, and action immediately beforehand.
