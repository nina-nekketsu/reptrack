# PRD: build id + update prompt for RepTrack

## Goal
Ship a lightweight cache-busting signal so the GitHub Pages build is always tracked, and let returning users know when they are seeing an outdated bundle.

## Context
RepTrack runs as a static React app on GitHub Pages. Because the bundle is heavily cached, users can load stale code and miss new fixes. We need a reproducible build identifier (stored in `public/build.json` and in `REACT_APP_BUILD_ID`) so that both the UI and an automatic updater can detect when a new version is published. The deployment flow should refuse to proceed if the working tree is dirty, and documentation should explain how the cache-busting guard works.

## Requirements
- Must have:
  - A script that writes `public/build.json` containing `{ buildId, version, commit }` and is invoked whenever we build or deploy.
  - The build script must inject `REACT_APP_BUILD_ID` so the React bundle can display the value.
  - The app must fetch `build.json` on load (with a cache-busting timestamp) and show a banner with “New version available” plus a reload button when `buildId` changes.
  - The Profile page footer and ExerciseLogModal header should show the local build ID.
  - Deployment must run `deploy:check-clean`, `deploy:buildid`, `build`, then `gh-pages`, preventing pushes from dirty working trees.
  - Add `docs/cache-busting.md` that captures the mini PRD and update the README to mention the new guard.
- Nice to have:
  - The banner should be subtle and near the top of the authenticated UI so it’s visible but unobtrusive.
- Out of scope:
  - Implementing full service workers or background refresh logic.

## Success Criteria
- `public/build.json` exists in builds and carries the latest commit/version/buildId.
- `REACT_APP_BUILD_ID` is injected into the bundle and shown in the Profile footer and ExerciseLogModal header.
- The authenticated UI shows a banner when the fetched `build.json` buildId differs from the local buildId.
- `npm run deploy` runs clean-check, build-id generation, build, and GH Pages deployment. Dirty trees block deploy with a clear message.
- README and `docs/cache-busting.md` explain the cache-busting workflow in plain language.

## Constraints
- The project uses CRA and must stay cross-platform; avoid shell-only scripts (prefer Node).<br>
- We can’t change the GH Pages domain (`https://nina-nekketsu.github.io/reptrack`).<br>
- Build metadata should not accidentally leak developer machine secrets.

## Open Questions
1. Should the build ID shown to users be the short git SHA, or would a timestamp make more sense? (Assuming short SHA as it is stable per commit.)
2. Should the update checker run in development mode? (Assuming no—only when `REACT_APP_BUILD_ID` exists so dev builds don't fetch a non-existent JSON.)
3. Should `deploy:buildid` also set environment variables for the future build, or is it enough that `npm run build` handles that? (Assuming build-time script sets `REACT_APP_BUILD_ID` before running `react-scripts build`.)
4. Do we need to expose `version`/`commit` in the UI, or just in the JSON file? (Assuming the UI only needs the buildId for now.)
5. Is the banner intended for the authenticated shell only? (Assuming yes, inside the main `app` view.)
