# Tasks: build id + cache-busting prompt

## Phase 1: Build metadata + scripts
- [ ] 1.1 Add Node helpers that write `public/build.json` from git metadata (buildId/version/commit) and expose the buildId for runtime use. This script should be reusable from both the `build` flow and the dedicated `deploy:buildid` step. — test by running the script manually and confirming `public/build.json` is updated.
- [ ] 1.2 Replace `npm run build` with a Node launcher that regenerates `build.json`, injects `REACT_APP_BUILD_ID`, and finally invokes `react-scripts build`. Add `deploy:check-clean`, `deploy:buildid`, and compose `deploy` so it runs the clean check, buildid, the new build flow, and `gh-pages`. Ensure `public/build.json` is ignored so the repo stays clean after building.

## Phase 2: UI + update checker
- [ ] 2.1 Add a shared `buildInfo` helper so React components can read `REACT_APP_BUILD_ID`, and wire the Profile footer and ExerciseLogModal header to show the current build ID (with lightweight styling). — verify visually in Storybook/workspace or running app.
- [ ] 2.2 Create an `UpdatePrompt` component that fetches `build.json` from `PUBLIC_URL` (with `ts` query) and compares the remote `buildId` to the local one. Show a subtle banner in the authenticated shell when they diverge, with a “Reload” button. — test by mocking the fetch response or reading from an intentionally stale `build.json`.

## Phase 3: Docs & verification
- [ ] 3.1 Write `docs/cache-busting.md` summarizing the mini PRD and the workflow, and add a note to `README.md` about the new build guard. — confirm docs render (e.g., `cat docs/cache-busting.md`).
- [ ] 3.2 Run `npm install`, the new `npm run build`, and `npm run deploy` to verify the pipeline, then commit the changes with `chore: add build id + update prompt`. Record the GitHub Pages URL and the published `build.json` URL for the main agent.
