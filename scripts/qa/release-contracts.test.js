const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  LANDSCAPE_VIEWPORTS,
  PORTRAIT_VIEWPORTS,
  ROUTES,
  VIEWPORTS,
  evidenceMatrix,
  scanReleaseContracts,
  validateDiagnosticsSnapshot,
} = require('./release-contracts');

function write(root, relativePath, content = '') {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function validFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reptrack-release-contracts-'));
  write(root, 'package.json', JSON.stringify({
    homepage: 'https://nina-nekketsu.github.io/reptrack',
    scripts: {
      prebuild: 'node scripts/write-build-info.js',
      predeploy: 'node scripts/check-clean.js && npm run build && node scripts/validate-build-metadata.js --require-origin-main',
    },
  }));
  write(root, 'public/manifest.json', JSON.stringify({ id: '/reptrack/', start_url: '/reptrack/', scope: '/reptrack/' }));
  write(root, 'public/index.html', '<link rel="manifest" href="%PUBLIC_URL%/manifest.json"><link rel="apple-touch-icon" href="%PUBLIC_URL%/reptrack-192.png">');
  write(root, 'public/service-worker.js', `
    function isApiRequest(request) { return request.headers.has('authorization'); }
    function isHashedAssetRequest() {}
    function isBuildInfoRequest() {}
    async function cacheFirst() {}
    async function networkFirst() {}
    const SHELL_PATHS = ['./', './index.html', './manifest.json', './reptrack-192.png', './reptrack-512.png'];
    self.addEventListener('message', (event) => {
      if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
      if (event.data.type === 'REPTRACK_SW_KILL_SWITCH') event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))).then(() => self.registration.unregister()));
    });
    self.addEventListener('fetch', (event) => {
      if (isHashedAssetRequest(event.request)) event.respondWith(cacheFirst(event.request));
      if (isBuildInfoRequest(event.request)) event.respondWith(networkFirst(event.request));
      if (event.request.mode === 'navigate') event.respondWith(networkFirst(event.request));
    });
  `);
  write(root, 'src/App.js', `
    <Route path="/" element={<Dashboard />} />
    <Route path="/today" element={<Dashboard />} />
    <Route path="/workout/:planId" element={<ActiveWorkout />} />
    <Route path="/workouts" element={<Workouts />} />
    <Route path="/exercises" element={<Exercises />} />
    <Route path="/history" element={<History />} />
    <Route path="/progress" element={<Progress />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/coach" element={<Coach />} />
    <Route path="/coach/settings" element={<CoachSettings />} />
    <Route path="/coach/:token" element={<CoachView />} />
  `);
  for (const route of ROUTES) write(root, route.source, `export default function ${route.id.replace(/-/g, '')}(){}`);
  write(root, 'src/index.js', 'installGlobalDiagnostics(window, clientDiagnostics); registerPwaUpdateController();');
  write(root, 'src/lib/pwaUpdateController.js', `
    export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
    const url = '/reptrack/build-info.json?ts=' + Date.now();
    async function checkNow(){ await fetch(url, { cache: 'no-store' }); }
    async function start(){ document.addEventListener('visibilitychange', checkNow); setInterval(checkNow, CHECK_INTERVAL_MS); await checkNow(); }
    function reload(waitingWorker){ waitingWorker.postMessage({ type: 'SKIP_WAITING' }); }
    async function unregisterPwa(){ registration.active.postMessage({ type: 'REPTRACK_SW_KILL_SWITCH' }); return registration.unregister(); }
  `);
  write(root, 'src/lib/clientDiagnosticsRuntime.js', 'clientDiagnostics.recordError(error);');
  write(root, 'src/lib/clientDiagnostics.js', `
    const MAX_ERRORS = 20;
    function sanitizeMessage(raw) {
      return String(raw)
        .replace(/email/g, '[REDACTED_EMAIL]')
        .replace(/jwt/g, '[REDACTED_JWT]')
        .replace(/bearer/g, 'Bearer [REDACTED]')
        .replace(/password|authorization/g, '[REDACTED]');
    }
    function getSnapshot(){ return { buildId, queueDepth, lastSuccessfulSyncAt, errors: [] }; }
  `);
  write(root, 'src/components/DiagnosticsPanel.js', '<p>Redacted local support data only.</p>');
  write(root, 'docs/qa-checklists.md', 'Previous production commit. Rollback command sequence.');
  write(root, 'docs/operations/pwa-update-lifecycle.md', 'Use REPTRACK_SW_KILL_SWITCH for emergency rollback cache clearing.');
  write(root, 'scripts/validate-build-metadata.js', 'commit must be a full 40-character lowercase git SHA. buildId must exactly match commit prefix.');
  return root;
}

test('defines the canonical route and viewport release evidence matrix', () => {
  assert.deepEqual(PORTRAIT_VIEWPORTS.map((item) => item.label), ['320x568', '360x800', '390x844', '420x900', '428x926']);
  assert.equal(LANDSCAPE_VIEWPORTS.every((item) => item.width > item.height), true);
  assert.equal(VIEWPORTS.length, 8);
  assert.equal(ROUTES.some((route) => route.path === '/workout/:planId'), true);
  assert.equal(evidenceMatrix().manualGates.some((gate) => gate.includes('two-device')), true);
});

test('accepts a fixture that satisfies executable release contracts', () => {
  const root = validFixture();
  assert.deepEqual(scanReleaseContracts(root), []);
});

test('reports subpath, PWA, diagnostics, rollback, and build metadata drift', () => {
  const root = validFixture();
  write(root, 'package.json', JSON.stringify({ homepage: 'https://example.com/', scripts: { predeploy: 'npm run build' } }));
  write(root, 'public/manifest.json', JSON.stringify({ id: '/', start_url: '/', scope: '/' }));
  write(root, 'public/service-worker.js', 'self.addEventListener("fetch", () => {})');
  write(root, 'src/lib/clientDiagnostics.js', 'function getSnapshot(){ return {}; }');
  write(root, 'src/index.js', '');
  write(root, 'docs/qa-checklists.md', 'Manual QA');
  write(root, 'scripts/validate-build-metadata.js', '');

  const rules = new Set(scanReleaseContracts(root).map((item) => item.rule));
  assert.equal(rules.has('subpath-homepage'), true);
  assert.equal(rules.has('subpath-manifest'), true);
  assert.equal(rules.has('pwa-service-worker-contract'), true);
  assert.equal(rules.has('pwa-update-contract'), true);
  assert.equal(rules.has('diagnostics-contract'), true);
  assert.equal(rules.has('rollback-evidence-contract'), true);
  assert.equal(rules.has('build-id-generation-contract'), true);
});

test('validates diagnostics snapshots are fixed-shape and redacted', () => {
  const safe = {
    buildId: '7a200550',
    syncStatus: 'idle',
    queueDepth: 0,
    lastSuccessfulSyncAt: null,
    syncFailures: {},
    errors: [{ source: 'sync', category: 'server', message: 'Bearer [REDACTED]', occurredAt: 1 }],
  };
  assert.deepEqual(validateDiagnosticsSnapshot(safe), []);

  const unsafe = {
    ...safe,
    errors: Array.from({ length: 21 }, (_, index) => ({
      source: 'sync',
      category: 'server',
      message: index === 0 ? 'student@example.com Bearer abc.def.ghi' : 'x',
      occurredAt: index,
    })),
  };
  const violations = validateDiagnosticsSnapshot(unsafe);
  assert.equal(violations.some((item) => item.includes('sensitive data')), true);
  assert.equal(violations.some((item) => item.includes('at most 20')), true);
});
