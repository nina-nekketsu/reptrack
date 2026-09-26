# RepTrack — live-mode automatic rest after a completed set

- [x] Locate the live-log set-completion button and canonical rest timer.
- [x] Add a failing end-to-end test: checking a set green starts the configured countdown in live mode.
- [x] Connect the green set-completion transition to the existing rest timer; preserve manual controls and non-live behavior.
- [x] Cover uncheck/recheck, consecutive sets, alert-phase restart, configured duration, remote deadline sync, persistence, and accessible announcements. Independent read-only review found no blocking issues; both non-blocking issues were fixed.
- [x] Verify lint, full test suite, production build, and PRD/release contracts (62 suites / 351 tests pass; build and contracts pass).
- [ ] Exercise the authenticated live-workout flow in a real browser. The public Pages URL and bundle were verified, but browser automation could not complete an authenticated set click.
- [x] Publish after Lloyd's explicit approval. CI run `36227917150` deployed commit `ddf8082e`; live `build-info.json`, service worker, and main bundle were fetched and matched that release.

Local implementation: `src/components/ExerciseLogModal.js`, `src/components/SetTimer.js`, `src/context/TimerContext.js`; regression tests: `src/components/ExerciseLogModal.autoRest.test.js`.
