# PRD: RepTrack Exercise Log Modal UX

## Goal
Keep the exercise log modal usable on small screens by locking the tab controls and actions in place while making it possible to edit existing entries directly from the overview and still see the history graph.

## Context
Lloyd requested we refresh the modal so the Overview/Log tabs and Cancel action never disappear, add the ability to edit past sessions from the overview, and make sure the volume graph is always visible there. These modal changes are user-facing UI tweaks and data tweaks that should ship together before the next build.

## Requirements
- **Must have**
  - The timer zone, tab bar, and Cancel control remain visible even when the body scrolls; Log tab saves, Overview tab shows Back to Log + Close (Cancel).
  - Body content lives in a scroll container between the sticky header/tabs and sticky footer.
  - Each recent session in the Overview tab gets an Edit action that loads that session into the Log tab, shows an "Editing session: <date>" banner, and saves back to the same session (local storage + Supabase update).
  - Editing cancels when the modal closes or Cancel is tapped.
  - VolumeGraph renders inside Overview whether there are ≥2 sessions or not; when there aren’t, a styled empty state keeps the section present.
- **Nice to have**
  - Graph and history sections keep visually consistent styling with the rest of the modal.
  - Sticky sections have armor (shadows/borders) that separate them from the scrollable body.
- **Out of scope**
  - Changes to workout-day locking or any workflow outside this modal.
  - Editing sessions from screens outside the Overview tab.

## Success Criteria
1. Tabs and Cancel/Close controls are sticky on mobile (iPhone width) and never require scrolling to be tapped.
2. Overview’s Recent Sessions list shows an Edit button that loads a session into Log, displays the editing banner, updates the original session on Save, and keeps Cancel as the exit path.
3. VolumeGraph is always rendered in Overview and falls back to a friendly placeholder when <2 sessions are available.
4. The modal still scrolls only between its sticky header/tabs and footer; timer, tabs, and footer persist while body content scrolls.
5. Build succeeds and the automated deploy runs, ending with the commit message `fix: sticky tabs + editable overview sessions`.

## Constraints
- Work within the existing React + Vite stack (no introducing new dependencies).
- Supabase sync helpers live in `src/lib/sync.js`; editing should reuse the existing push/update flows.
- The modal is reused from Exercises and ActiveWorkout pages, so closing behaviors must stay backwards compatible.

## Open Questions
- None; the spec already covers the necessary states.

## Task List
1. **PRD doc** — add `docs/modal-ux-prd.md` with the above goal/requirements so the rest of the work is tied to this plan (acceptance criteria: file exists and is human-readable).
2. **Sticky tab/footer layout (log modal)** — restructure `ExerciseLogModal` so timer, tabs, and footer are sticky, move action buttons out of the scroll body, and style the new layout in `src/pages/Exercises.css`. Each UI change should be locally testable in the dev server.
3. **Editable overview sessions** — add the Edit control, load the selected session into Log, show the editing banner, update the existing session in localStorage, and call a Supabase update helper when the session has a remote ID. Keep Cancel’s close behavior intact while clearing edit state before closing.
4. **Volume graph resilience** — ensure `VolumeGraph` is always rendered in the Overview tab using `sessionsAsc` data and shows the styled empty state when there are fewer than two sessions.
5. **Validation & release** — run `npm run build`, verify everything still works (logs, Edit, sticky UI), then commit with `fix: sticky tabs + editable overview sessions` and execute `npm run deploy`.
