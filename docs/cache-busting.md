# Cache busting guard for RepTrack

## Goal
Guarantee that every GitHub Pages deploy publishes a new build identifier and make it easy for users to refresh when they land on stale code.

## Background
RepTrack runs as a static React app on GitHub Pages, which means browsers cache the bundle aggressively. When we ship a fix, a user on another device can open the app and keep seeing the old version for several minutes or even hours without a clear sign that something changed. We need a deterministic build ID so both the UI and the deployment flow can prove what bundle is live.

## Implementation
- `scripts/build-metadata.js` gathers the git commit, the package version, and the build ID (which defaults to the short git SHA or the `REACT_APP_BUILD_ID` environment variable) and writes that data to `public/build.json`.
- `scripts/build.js` reuses that helper, exports the generated `buildId` via `REACT_APP_BUILD_*` variables, and then runs `react-scripts build`. This ensures the bundle can read the same build ID it just wrote to disk.
- `public/build.json` is ignored in git so the working tree stays clean, and `deploy:buildid` will re-run the metadata script as part of deploying.

## Update prompt
- The authenticated shell now renders a banner near the top. On production builds, it fetches `${process.env.PUBLIC_URL}/build.json?ts=<timestamp>` and compares the remote `buildId` to the local one baked in at build time.
- If they differ, the banner says “New version available” alongside a “Reload” button that performs a hard refresh.
- The Profile footer and Exercise log modal header also display the current build ID so that curious users can see exactly what bundle they are running.

## Deploy guard
- `npm run deploy:check-clean` exits early if `git status --porcelain` reports any changes. This keeps us from deploying with stray edits.
- `deploy:buildid` regenerates `build.json` before the build, and `npm run build` now runs the Node wrapper so the bundle and metadata stay in sync.
- `npm run deploy` stitches it all together: clean check → build metadata → build → `gh-pages -d build`. That means every production deploy is reproducible and idempotent.

## Verification steps
- Run `npm run deploy:buildid` and confirm that `public/build.json` contains `buildId`, `version`, and `commit`.
- Run the wrapped `npm run build` to ensure the new `UpdatePrompt` banner does not fetch in development (because `REACT_APP_BUILD_ID` is missing). Observe the build ID in the Profile page and Exercise Log modal.
- Run `npm run deploy` on a clean branch and verify the `gh-pages` branch receives the new `build.json` (e.g., `https://nina-nekketsu.github.io/reptrack/build.json`).
