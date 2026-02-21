# Tasks: Delete sessions from Overview

## Phase 1: UI and delete plumbing
- [ ] 1.1 Add delete affordance + confirm state in `ExerciseLogModal` Overview list — show a 🗑 button per session card (placed near existing Edit button) and render the same confirm overlay currently used by `ExerciseHistoryModal`, reusing copy + styles.
- [ ] 1.2 Wire the delete action to `deleteSession(exercise.id, session.date, user?.id)` so the helper handles local removal + Supabase cleanup, then close the confirm overlay, reset editing state if the deleted session was active, and make sure the modal’s `logs` view refreshes (via `onSaved`/event) immediately.
- [ ] 1.3 Ensure the surrounding UI respects the new state: dispatch `exerciseLogged` or invoke `onSaved` (with the updated logs object) so the parent `logs` state and graphs update, and keep edit mode out of sync when a deleted session was open.

## Phase 2: Verification & cleanup
- [ ] 2.1 Run `npm run build` and `npm run deploy` per instructions, verify the delete path works by logging two sessions, deleting the older one from the Overview tab, and confirming the list/graph/history update without error.
- [ ] 2.2 `git status` to confirm only intended files changed, then commit with message `feat: delete sessions from overview` before pushing (if required).
