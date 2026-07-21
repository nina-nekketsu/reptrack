# P2.5 Route-Content Motion Checkpoint

Implemented only the approved restrained route-level content entry. All pre-existing uncommitted motion-system work and existing route definitions were preserved.

## Changed files

- `src/components/RouteContentTransition.js` — derives route identity from the normalized React Router pathname and replaces a single content wrapper synchronously when that identity changes.
- `src/components/RouteContentTransition.test.js` — focused pathname identity, query/hash preservation, focus preservation, back/forward-location, single-wrapper, finite CSS, layout-safety, and reduced-motion contracts.
- `src/App.js` — wraps only the authenticated app's route content; the update banner, global sync indicator, and bottom navigation remain outside the keyed wrapper.
- `src/App.css` — adds the finite 170ms opacity/4px entry and an immediate static reduced-motion state.
- `src/App.routes.test.js` — verifies the existing route table remains in place and global chrome stays outside the route-content wrapper.
- `docs/design-qa/motion-implementation/route-motion-checkpoint.md` — this checkpoint.

## Behavior and safety notes

- Route identity uses `location.pathname` only, with trailing slashes removed except for `/`. Search and hash changes therefore rerender normally without replacing the wrapper, remounting the page, or replaying its entry.
- A genuine normalized pathname change synchronously replaces the one route wrapper. The previous page is not retained, so there is no two-page crossfade or delayed old-route unmount.
- The wrapper does not intercept links, call `navigate`, write browser history, subscribe to browser navigation events, defer rendering, or queue transitions. React Router remains authoritative for links, redirects, and browser back/forward locations.
- No focus is moved for animation. Same-path query/hash updates preserve the mounted content and focused element; pathname changes retain normal unmount behavior.
- Route elements remain inside the existing `Routes` table. Data fetching, component state updates, redirects, and new-route rendering begin under the normal synchronous React Router lifecycle.
- `UpdateBanner`, `SyncIndicator`, and `BottomNav` remain mounted outside the keyed route-content wrapper.
- The entry runs once for 170ms with the enter easing, from `opacity: 0` and `translateY(4px)` to the static final state. It animates only opacity and transform.
- Reduced motion disables the route animation and explicitly leaves content at `opacity: 1` with `transform: none`.
- No infinite animation, `transition: all`, layout animation, dependency, configuration, schema, secret, production operation, commit, push, merge, or deployment was added.

## Commands and exact results

1. `CI=true npm test -- --runInBand src/components/RouteContentTransition.test.js src/App.routes.test.js`
   - RED, exit 1: 2 suites failed. The focused component suite could not resolve the not-yet-created `RouteContentTransition` module, and the new App routing contract failed because App did not yet import or render the wrapper. Existing App route assertions continued to pass.
2. `CI=true npm test -- --runInBand src/components/RouteContentTransition.test.js src/App.routes.test.js`
   - GREEN, exit 0: 2 suites passed; 10 tests passed; 0 snapshots.
3. `CI=true npm test -- --runInBand src/App.routes.test.js src/components/RouteContentTransition.test.js src/components/BottomNav.motion.test.js src/accessibility.dialogs.test.js src/motion.contract.test.js`
   - Exit 0: 5 suites passed; 24 tests passed; 0 snapshots.
4. `npm run lint`
   - Exit 0: ESLint completed with no warnings or errors.
5. `git diff --check`
   - Exit 0 with no output; no whitespace errors found.

Jest emitted the existing Node `DEP0040` punycode deprecation warning; it did not affect test results.
