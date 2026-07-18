# RepTrack PWA update lifecycle

RepTrack registers `public/service-worker.js` only for production builds. The worker is scoped to `/reptrack/` for GitHub Pages and uses versioned `reptrack-*` caches.

- Hashed CRA assets under `/static/` are runtime cached with cache-first behavior.
- Navigations, `index.html`, and `build-info.json` are network-first so releases are discovered quickly.
- Navigation fallback serves only cached HTML. It does not synthesize a fake offline page.
- Supabase, auth, REST, storage, functions, authorization-bearing, and generic `/api/` requests bypass the worker cache.
- Activating a waiting worker is user controlled through the existing `UpdateBanner` reload action.
- The controller checks for updates on startup, when the tab becomes visible again, and every six hours.

Emergency unregister path: call `unregisterPwa()` from `src/lib/pwaUpdateController`. It posts `REPTRACK_SW_KILL_SWITCH` so the active worker deletes RepTrack caches, then calls `registration.unregister()`.
