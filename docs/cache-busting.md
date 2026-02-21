# Cache busting for RepTrack

## Goal
Give every deployment a traceable build ID, surface that metadata inside the app, and prompt users to reload when a newer version lands on GitHub Pages.

## Context
RepTrack is served as a static Create React App on GH Pages. Because the bundle is cached aggressively, new releases can stay hidden until someone discovers the secret "hard refresh" ritual. We already have a `deploy` workflow, but it never stamps the build with a version or signals the UI that a new artifact is available. The goal is to make each build deterministic, expose metadata to the app, and add a lightweight update banner plus docs describing how to force-refresh when a stale bundle is stuck in the browser.

## Requirements
- Generate build metadata (`buildId`, `version`, `commit`, `builtAt`) at build time and write it to `public/build-info.json` so the same file ends up inside `build/` and is published to GH Pages.
- Persist the metadata to `.env.production.local` every time (`node scripts/write-build-info.js`), ensuring `react-scripts build` can read `REACT_APP_BUILD_*` before bundling.
- Update the React app with an `UpdateBanner` component that fetches `${PUBLIC_URL}/build-info.json?ts=<timestamp>` on load, compares the remote `buildId` to the baked-in `REACT_APP_BUILD_ID`, and shows a reload button when they differ.
- Surface the build stamp (`Build: <shortsha> · <date>`) in the Profile footer and a tiny marker inside the ExerciseLogModal header so testers can see the current bundle.
- Provide deterministic deploy scripts: a `prebuild` hook that runs `node scripts/write-build-info.js`, a `build` script that calls `react-scripts build`, a `predeploy` script that runs `npm run build`, and a `deploy` script that checks for a clean tree before running the build + `gh-pages -d build`.
- Document the change in this file (PRD + acceptance criteria) and update `README.md` with hard-refresh instructions.

## Success criteria
1. `scripts/write-build-info.js` writes `public/build-info.json` and `.env.production.local` with the same metadata every build. The metadata contains `buildId`, `version`, `commit`, and `builtAt`.
2. The bundled app receives `REACT_APP_BUILD_ID` and friends via the `.env.production.local` file so `localBuildInfo` matches `build-info.json`.
3. `UpdateBanner` fetches the remote `build-info.json` (with a cache-busting `?ts` query) and renders a banner + reload button when the remote `buildId` differs from the local one.
4. The Profile footer and ExerciseLogModal header both display the formatted build (commit/date). The UI component does not render in development when no build ID is injected.
5. `npm run build` runs the new metadata generator, and `npm run deploy` enforces a clean tree before publishing `build/` via `gh-pages -d build`.
6. `README.md` explains the cache-busting workflow and how to hard-refresh stale bundles when needed.

## Manual verification
- Run `npm run build` (or `npm run deploy`) and confirm `build-info.json` contains the new fields.
- Visit the built app, open the Profile page, and check that the footer lists the current build stamp and that the Exercise Log modal shows the same marker.
- Open the deploy preview (or `npm start`), fetch `build-info.json`, and ensure the banner appears when the backend says the version is newer.
- With DevTools open, perform a hard refresh (Cmd/Ctrl+Shift+R or Clear Site Data) and report the exact steps in the README for future reference.
