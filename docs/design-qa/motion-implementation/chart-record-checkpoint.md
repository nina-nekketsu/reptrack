# P2.4 Chart and Record Reveal Checkpoint

Date: 2026-07-20

## Scope completed

Implemented only the approved P2.4 chart and record reveal behavior:

- `src/components/VolumeGraph.js` — preserves the existing volume/date calculations and SVG geometry while grouping only the plotted area, line, and points behind a meaningful dataset identity.
- `src/components/RecordBadges.js` — preserves record values and labels while tracking committed and previously seen record identities for mounted-session-only cues.
- `src/pages/Exercises.css` — adds one bounded chart reveal, one bounded new-record cue, and explicit reduced-motion endpoints.
- `src/components/VolumeGraph.test.js` — adds focused dataset-identity, interaction stability, no-data, finite CSS, and reduced-motion coverage.
- `src/components/RecordBadges.test.js` — adds focused initial-load, new/increased identity, previously seen identity, empty-state, finite CSS, and reduced-motion coverage.
- `docs/design-qa/motion-implementation/chart-record-checkpoint.md` — this checkpoint.

## Data and record audit

- `VolumeGraph` still derives its plotted volumes from `session.totalVolume`, uses the same min/max/range calculation, and generates the same line, area, point, tick, and date geometry.
- The chart reveal identity is based only on ordered session dates and normalized total-volume values, the inputs that meaningfully define the current plot. Cloned session objects and changes to unrelated session fields do not replace or restart the plot.
- Axes, tick labels, date labels, and the accessible chart label render immediately. The reveal is visual-only and applies to one SVG plot group.
- The existing honest graph placeholder still renders when fewer than two sessions are available; it has no reveal target and no fake plotted data.
- `getRecords` and all Progress analytics/stat calculations remain unchanged.
- Stored record values render immediately on initial mount without a celebration class.
- During the same mounted session, only a positive record value that increases to an identity not previously seen by that component receives the cue. Lower values and a return to an already seen identity remain static.
- The Progress page was inspected and its e1RM and weekly muscle-volume rendering was not changed.

## Motion and accessibility behavior

- The chart plot uses one 300ms opacity plus `clip-path: inset(...)` reveal with one iteration and a static final state.
- The area, line, and all points reveal together. There is no per-point staggering or sequential animation.
- Equivalent rerenders, hover/mouse movement, focus, and resize events keep the existing plot node, so they do not restart the reveal.
- A meaningful date or total-volume dataset change replaces only the plot group once; surrounding chart semantics remain mounted and authoritative.
- A newly increased record identity uses one 180ms opacity/scale cue. Ordinary rerenders remove the cue class without replacing the current identity again.
- Reduced motion disables both animations and explicitly exposes the final visible/static opacity, transform, and clip-path values.
- The chart now has an immediate `role="img"` label summarizing session count and first-to-last volume. Existing record text semantics remain unchanged.
- No tooltip state, hover behavior, focus handler, keyboard handler, timer, animation completion callback, or data-state transition was added.

## RED → GREEN evidence

1. `CI=true npm test -- --runInBand src/components/VolumeGraph.test.js src/components/RecordBadges.test.js`
   - RED, exit 1: 2 suites failed; 8 tests failed and 3 passed.
   - Intended failures covered the missing stable/replaced plot identity hooks, initial/new record distinction, bounded CSS animations, and reduced-motion rules.
2. `CI=true npm test -- --runInBand src/components/VolumeGraph.test.js src/components/RecordBadges.test.js`
   - GREEN, exit 0: 2 suites passed; 11 tests passed; 0 snapshots.

## Regression and static verification

3. `CI=true npm test -- --runInBand src/components/VolumeGraph.test.js src/components/RecordBadges.test.js src/pages/Progress.test.js`
   - Exit 0: 3 suites passed; 13 tests passed; 0 snapshots.
4. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
5. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.

No dependency, schema, configuration, secret, production operation, commit, push, merge, deploy, layout animation, `transition: all`, or infinite animation was added. Existing uncommitted work was preserved.
