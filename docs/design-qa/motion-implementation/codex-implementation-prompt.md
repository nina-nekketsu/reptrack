# RepTrack Motion System — Implementation Goal

## Task
Implement the approved RepTrack motion and interaction-feedback system completely on the current feature branch, using the repository-specific execution plan, strict TDD, guarded persistence behavior, mobile/reduced-motion QA, independent-review-ready commits, and hosted CI preparation.

## Authoritative context
- Repository: `https://github.com/nina-nekketsu/reptrack.git`
- Clean implementation worktree: `/Volumes/Sanctum/Boman/reptrack-motion-implementation`
- Branch: `feat/reptrack-motion-system`
- Verified starting `origin/main`: `1aac8654599e692483eabe0fecbaae99e151741e`
- Full motion plan (mandatory source of truth): `/Volumes/Sanctum/Boman/reptrack-animation-analysis/docs/design-qa/animation-plan/reptrack-motion-execution-plan.md`
- Stack: React 19 / Create React App / Jest / ESLint / Supabase.
- Existing CI uses Node 22 and runs `npm ci`, `npm run test:prd`, `npm run lint`, `CI=true npm test -- --runInBand`, production npm audit, and `npm run build`.

Read the full motion plan and relevant source/tests before edits. Validate every plan reference against the current source. Preserve existing product behavior unless the plan explicitly changes interaction feedback or safety.

## Goal boundary
Deliver a complete, locally verified implementation on `feat/reptrack-motion-system`, organized as small coherent commits/slices, with QA evidence ready for a draft PR. Do not merge or deploy. Do not mutate production, Supabase schema/data, GitHub Pages, secrets, or environment configuration.

## Non-negotiable source hierarchy
When requirements conflict, use this order:
1. Existing data-preservation, offline/outbox, and session-conflict tests/invariants.
2. Existing accessibility and product behavior contracts.
3. The motion execution plan.
4. Existing visual styling.
5. Implementation convenience.

Motion must never weaken data safety, truthful sync state, accessibility, focus handling, keyboard behavior, or mobile touch-target geometry.

## Product assumptions
- Preserve the existing exercise-completion predicate and incomplete-workout behavior.
- Preserve current timer auto-start settings/defaults.
- Do not add sound, haptics, notifications, remote config, or a user-level motion preference.
- Use OS/browser `prefers-reduced-motion`.
- Use existing record qualification rules; invent no PR formulas.
- If multiple records occur, animate at most one primary record; list others statically.
- Keep `Saved on this device`, `Waiting to sync`, `Synced`, and `Sync failed` distinct.
- Use CSS/root classes or build-safe constants for optional visual kill switches; no remote flag service.
- Prefer focusing the workout-summary heading when it opens as a new result context, unless existing accessibility contracts require a safer equivalent.

## Scope
### P0 — foundation and safety
- Consolidate/extend motion tokens.
- Replace all `transition: all` with explicit properties.
- Namespace/consolidate duplicate or cross-file keyframes.
- Remove dead/no-op timer, progress, and sync motion CSS.
- Remove infinite active-workout/navigation/success motion.
- Add explicit component-level reduced-motion alternatives while retaining a global safety fallback.
- Add synchronous same-frame guards to non-idempotent save/start/end handlers identified in the plan.
- Add truthful busy/disabled/pending/local-save/sync/error semantics where required.
- Standardize sheet/dialog presence without delaying logic or weakening focus lifecycle.

### P1 — core workout feedback
- Unified press/tap feedback.
- Set checked, locally saved, exercise complete, and Undo feedback.
- Finite rest-timer start/alert/end and duration-sheet feedback.
- Bottom-nav selection and finite active-workout cue.
- Exercise-completion/next-action handoff.
- Guarded workout-completion overlay and summary.

### P2 — secondary surfaces
- Genuine new-record acknowledgement using existing qualification rules.
- Progress-graph reveal/update without delaying data or replaying on ordinary rerenders.
- Toast/sync/offline/error feedback.
- Auth submit/loading/error feedback.
- Coach/onboarding transition cleanup described in the plan.

## Out of scope / prohibited
- Merge, deployment, production writes, schema migration, or data-model changes.
- New animation package unless absolutely required; stop and report before adding one.
- IA redesign, route-tree exit animation, timer-digit animation, confetti, particles, parallax, full-screen flashes, decorative shimmer, or persistent pulses.
- Animating list reflow, `height:auto`, margins, padding, or business-state transitions.
- Save/delete/navigation/sync/timer/undo logic triggered by `animationend` or `transitionend`.
- Weakening/deleting tests to make changes pass.

## Execution method
Use Plan Mode internally before editing. Then execute vertical RED→GREEN→REFACTOR slices. Do not write a horizontal pile of tests.

For every behavioral change:
1. Write one focused failing test.
2. Run it and confirm expected RED caused by the missing behavior.
3. Implement the smallest GREEN change.
4. Rerun focused and directly related regression suites.
5. Refactor only while green.
6. Record concise RED/GREEN commands and outcomes in `docs/design-qa/motion-implementation/qa-log.md`.

Characterization/static baseline tests that pass immediately must be labeled; add a failing prohibited-state assertion where possible.

## Implementation sequence
1. Motion hygiene, tokens, explicit reduced-motion rules, and synchronous action guards.
2. Shared sheet/dialog presence and focus lifecycle.
3. Set completion/local-save/Undo feedback.
4. Finite timer alert and phase feedback.
5. Bottom navigation and exercise handoff.
6. Workout completion and summary.
7. Records and progress graphs.
8. Sync/auth/coach/onboarding feedback.

Keep commits coherent. Do not push, open a PR, merge, or deploy; Boman will independently review before remote side effects.

## Motion rules
Use the plan's values unless current implementation evidence justifies a smaller safe adjustment:
- instant 90ms; fast 120ms; control 160ms; reveal 200ms; sheet 240ms; rare celebration max 560–600ms.
- standard easing `cubic-bezier(.2,0,0,1)`; enter `cubic-bezier(.16,1,.3,1)`; exit `cubic-bezier(.4,0,1,1)`.
- Prefer transform and opacity. Avoid animated box-shadow/filter/blur/width/height in hot paths.
- No permanent `will-change`.
- Every nontrivial animation needs a state trigger, finite count, deterministic interruption, reduced-motion alternative, and no business logic attached to completion.

## Critical data-safety invariants
- Local persistence/tombstone precedes celebration.
- Animation cancellation cannot cancel or duplicate persistence.
- Same-frame repeated taps cause one non-idempotent mutation.
- Delayed remote IDs cannot overwrite newer local edits.
- Undo restores exact rows, ordering, IDs, and parent/child relationships and remains actionable for the full existing window.
- `Synced` appears only after verified remote success.
- Close/navigation/reduced-motion/hidden tab/unmount cannot lose valid data.
- Timer phases derive from timestamps, never animation progress.

Any violation is blocking.

## Accessibility requirements
- Preserve/improve accessible names, focus visibility, keyboard interaction, and target geometry.
- Use ARIA only where semantically correct.
- Dialogs retain labeling, `aria-modal`, initial focus, keyboard loop, Escape, and focus return.
- Announce phase/completion/error transitions once, not animation stages or timer ticks.
- Decorative motion is hidden from assistive technology.
- Reduced motion removes critical spatial/scale/pulse effects while preserving state through text/icon/color/focus.

## Focused tests
Run as relevant during slices:
```bash
CI=true npm test -- --runInBand src/components/ExerciseLogModal.activeWorkout.test.js
CI=true npm test -- --runInBand src/components/SetTimer.test.js
CI=true npm test -- --runInBand src/pages/ActiveWorkout.preservation.test.js
CI=true npm test -- --runInBand src/pages/Workouts.sessionConflict.test.js
CI=true npm test -- --runInBand src/accessibility.dialogs.test.js
CI=true npm test -- --runInBand src/components/SyncIndicator.test.js
CI=true npm test -- --runInBand src/components/p2Features.test.js
CI=true npm test -- --runInBand src/pages/Progress.test.js
CI=true npm test -- --runInBand src/App.routes.test.js
```

## Full verification gate
Run before finalizing:
```bash
npm ci
npm run test:prd
npm run check:schema
npm run lint
CI=true npm test -- --runInBand
npm audit --omit=dev --audit-level=moderate
npm run qa:mobile-readability:static
npm run qa:done-button-readability
npm run build
```
`prebuild` writes build metadata. Remove/restore generated metadata so final `git status` contains only intended source/tests/docs. Do not print `.env` or secret values.

Inspect browser QA scripts before invoking them. If browser QA is runnable locally, collect normal and reduced-motion evidence at 320×568, 360×800, 375×812, 390×844, and 430×932. Store evidence under `docs/design-qa/motion-implementation/`. Clearly label public, fixture-based, or authenticated evidence. Never fabricate unavailable device/manual evidence.

## Acceptance criteria
- Zero `transition: all`.
- Zero infinite critical navigation/workout/timer/success/error motion.
- One owner per keyframe; no dead legacy critical-motion selectors.
- No new animation dependency.
- Explicit reduced alternative for every critical effect.
- No duplicate save/start/end under rapid same-frame activation.
- No persistence/session-conflict/offline/outbox regressions.
- Timer digits and action geometry stable.
- Completion/PR treatments finite and nonblocking.
- Reduced-motion final states clear in static evidence.
- Focused tests, full Jest, PRD/schema contracts, lint, production audit, static mobile QA, and production build pass.
- Final working tree contains only intentional changes.
- No merge or deployment.

## Stop conditions
Stop and write a blocker report instead of guessing if:
- current source materially contradicts the plan;
- a persistence/session-conflict test regresses and cannot be safely fixed within scope;
- schema/data-model changes or a new dependency are needed;
- browser state cannot be honestly labeled;
- implementation would require deployment or production mutation;
- scope must expand materially.

## Output discipline
Work quietly. Save full logs/artifacts to `docs/design-qa/motion-implementation/`; keep terminal excerpts concise. Never expose tokens, cookies, auth files, transient OAuth data, or `.env` contents.

At completion, write `docs/design-qa/motion-implementation/implementation-report.md` containing:
- starting and final SHA;
- changed files grouped by slice;
- RED/GREEN evidence summary;
- complete verification command/results;
- browser/mobile/reduced-motion evidence paths and limitations;
- data-safety/accessibility review notes;
- known risks/blockers;
- explicit statement that nothing was merged or deployed.

Then output a concise final summary with the report path.