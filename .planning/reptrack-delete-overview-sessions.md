# PRD: Delete sessions from Overview

## Goal
Let trainees delete single sessions directly from the "Recent Sessions" list inside the Exercise Log modal’s Overview tab while keeping local storage and Supabase data in sync.

## Context
The Overview tab already shows recent sessions, but deleting requires going through the history modal. Lloyd wants the same capability inside the modal that opened via the Exercises/ActiveWorkout pages so people can quickly tidy up logs without leaving the context.

## Requirements
- Add a per-session delete (🗑) affordance inside the Overview tab’s Recent Sessions list that sits alongside the existing Edit button.
- Show a native confirm dialog (reuse the pattern from ExerciseHistoryModal) before mutating anything.
- When confirmed, remove the session locally (matching by ISO date) and, if the user is signed in, also delete the Supabase `exercise_sessions`/`exercise_logs` row tied to that session via `remoteId`.
- After deletion, fire the same local refresh logic used after a save so the graph, badges, and history cards immediately reflect the new state; if the deleted session was currently being edited, exit edit mode and reset the log tab.
- Reuse the helper logic in `src/utils/exerciseHelpers.js` or `src/lib/sync.js` so the same Supabase delete code is shared with ExerciseHistoryModal’s delete path.
- Ensure the modal emits changes back to parent via `onSaved` (or new callback) so other parts of the app keep the logs state up to date.

## Success Criteria
- Logged training sessions appear in Overview and can be deleted without leaving the modal.
- Confirm dialog prevents accidental deletes and the UI updates immediately (graph, pagination back to five, etc.).
- Deletion removes the record from `localStorage` and from Supabase when the user is logged in (hint: existing helper already does that). 
- If the deleted session was the one you were editing, the log tab exits editing state so you’re back to a blank log.
- Running the test steps (log two sessions, delete older one, verify list/graph/history update) passes locally.

## Constraints
- Must reuse existing delete helper (`deleteSession`) so Supabase cleanup stays centralized.
- Don’t introduce new backend calls beyond what `deleteSession` already covers (fire-and-forget Supabase delete based on `remoteId`).
- UI is React + localStorage; maintain current event dispatch (e.g., `exerciseLogged`).
- Confirm dialog should be simple; avoid adding a full modal if existing overlay from History modal can be reused.

## Open Questions
- None; requirements are fully specified by Lloyd’s request and the existing delete flow in `ExerciseHistoryModal`.  
